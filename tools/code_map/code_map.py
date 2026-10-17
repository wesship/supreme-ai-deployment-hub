"""Offline, read-only source indexing for Hermes. Inspected code is never run."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

EXCLUDED = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', 'dist', 'build',
            'coverage', '.next', '.cache', 'vendor'}
EXTENSIONS = {'.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'}
MAX_FILE_BYTES = 1_000_000


def sources(root):
    files, diagnostics = {}, []
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED and not Path(directory, d).is_symlink())
        for name in sorted(names):
            path = Path(directory, name)
            if path.suffix not in EXTENSIONS or path.is_symlink():
                continue
            relative = path.relative_to(root).as_posix()
            try:
                if path.stat().st_size > MAX_FILE_BYTES:
                    raise ValueError('exceeds source file size limit')
                raw = path.read_bytes()
                files[relative] = {'path': relative, 'source': raw.decode('utf-8-sig'),
                                   'sha256': hashlib.sha256(raw).hexdigest()}
            except (OSError, UnicodeError, ValueError) as error:
                diagnostics.append({'path': relative, 'error': str(error)})
    return files, diagnostics


def module_name(path):
    parts = Path(path).with_suffix('').parts
    return '.'.join(parts[:-1] if parts[-1] == '__init__' else parts)


def python_index(file, modules):
    imports, symbols = [], []
    tree = ast.parse(file['source'], filename=file['path'])
    module = module_name(file['path'])
    package = module if Path(file['path']).name == '__init__.py' else module.rpartition('.')[0]
    for node in ast.walk(tree):
        loc = {'line': node.lineno, 'end_line': node.end_lineno} if hasattr(node, 'lineno') else {}
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            symbols.append({**loc, 'name': node.name, 'kind': type(node).__name__})
        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.append({**loc, 'specifier': alias.name, 'kind': 'import', 'target': modules.get(alias.name)})
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ''
            if node.level:
                parts = package.split('.') if package else []
                if node.level > len(parts):
                    base = '<invalid-relative>.' + base
                else:
                    base = '.'.join(parts[:len(parts) - node.level + 1] + ([base] if base else []))
            for alias in node.names:
                specifier = base + '.' + alias.name if base else alias.name
                imports.append({**loc, 'specifier': specifier, 'kind': 'from-import',
                                'target': modules.get(specifier) or modules.get(base)})
        elif isinstance(node, ast.Call):
            is_dynamic = isinstance(node.func, ast.Name) and node.func.id == '__import__'
            is_dynamic |= (isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name)
                           and node.func.value.id == 'importlib' and node.func.attr == 'import_module')
            if is_dynamic:
                specifier = (node.args[0].value if node.args and isinstance(node.args[0], ast.Constant)
                             and isinstance(node.args[0].value, str) else '<computed>')
                imports.append({**loc, 'specifier': specifier, 'kind': 'dynamic-import',
                                'target': modules.get(specifier)})
    return {'path': file['path'], 'imports': imports, 'symbols': symbols, 'diagnostics': []}


def scan(root):
    root = Path(root).resolve(strict=True)
    files, diagnostics = sources(root)
    modules = {module_name(path): path for path in files if path.endswith('.py')}
    indexed, frontend = [], []
    for file in files.values():
        if file['path'].endswith('.py'):
            try:
                indexed.append(python_index(file, modules))
            except (SyntaxError, ValueError, RecursionError) as error:
                diagnostics.append({'path': file['path'], 'error': str(error)})
        else:
            frontend.append(file)
    if frontend:
        try:
            result = subprocess.run(['node', str(Path(__file__).with_name('typescript.cjs'))],
                                    input=json.dumps({'root': str(root), 'files': frontend}),
                                    capture_output=True, text=True, timeout=120, check=True)
            indexed.extend(json.loads(result.stdout))
        except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
            raise RuntimeError('TypeScript AST parser unavailable or failed. Install the repository dependencies '
                               'or set CODE_MAP_TYPESCRIPT to an installed TypeScript package. No partial map emitted.') from error
    edges = []
    for item in indexed:
        file = files[item['path']]
        file['symbols'] = item['symbols']
        for message in item['diagnostics']:
            diagnostics.append({'path': item['path'], 'error': message})
        for edge in item['imports']:
            target = edge['target'] if edge['target'] in files else None
            lines = file['source'].splitlines(keepends=True)
            edges.append({**edge, 'source': file['path'], 'target': target,
                          'resolution': 'local' if target else 'external-or-unresolved',
                          'sha256': file['sha256'],
                          'quote': ''.join(lines[edge['line'] - 1:edge['end_line']])})
    return {'schema_version': 1, 'mode': 'static-source-only', 'nodes': list(files.values()),
            'edges': edges, 'diagnostics': diagnostics}


def evidence(graph, path, start, end):
    file = next((node for node in graph['nodes'] if node['path'] == path), None)
    if file is None:
        raise ValueError('Path is not an indexed source file')
    lines = file['source'].splitlines(keepends=True)
    if not 1 <= start <= end <= len(lines) or end - start >= 200:
        raise ValueError('Use a valid range of at most 200 lines')
    return {'path': path, 'sha256': file['sha256'], 'line': start, 'end_line': end,
            'quote': ''.join(lines[start - 1:end]), 'mode': graph['mode']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path.cwd())
    commands = parser.add_subparsers(dest='command', required=True)
    build = commands.add_parser('build')
    build.add_argument('--output', type=Path, required=True)
    search = commands.add_parser('search')
    search.add_argument('term')
    quote = commands.add_parser('quote')
    quote.add_argument('path')
    quote.add_argument('start', type=int)
    quote.add_argument('end', type=int)
    args = parser.parse_args()
    try:
        graph = scan(args.root)
        if args.command == 'build':
            template = Path(__file__).with_name('viewer.html').read_text()
            payload = json.dumps(graph, ensure_ascii=True).replace('<', '\\u003c')
            args.output.write_text(template.replace('__GRAPH_JSON__', payload), encoding='utf-8')
            print(json.dumps({'output': str(args.output.resolve()), 'files': len(graph['nodes']),
                              'imports': len(graph['edges']), 'diagnostics': len(graph['diagnostics'])}))
        elif args.command == 'quote':
            print(json.dumps(evidence(graph, args.path, args.start, args.end)))
        else:
            term = args.term.casefold()
            matches = [n for n in graph['nodes'] if term in n['path'].casefold()
                       or any(term in s['name'].casefold() for s in n.get('symbols', []))][:50]
            paths = {n['path'] for n in matches}
            print(json.dumps({'files': [{k: v for k, v in n.items() if k != 'source'} for n in matches],
                              'imports': [e for e in graph['edges'] if e['source'] in paths or e['target'] in paths],
                              'diagnostics': graph['diagnostics'], 'mode': graph['mode']}))
    except (RuntimeError, OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
