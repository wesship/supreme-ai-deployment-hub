import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('code_map', Path(__file__).with_name('code_map.py'))
code_map = importlib.util.module_from_spec(spec)
spec.loader.exec_module(code_map)


class CodeMapTests(unittest.TestCase):
    def test_import_resolution_quotes_and_no_execution(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'pkg').mkdir()
            (root / 'pkg/__init__.py').write_text('')
            source = 'from . import helper\nimport os\nraise RuntimeError("must not execute")\n'
            (root / 'pkg/main.py').write_text(source)
            (root / 'pkg/helper.py').write_text('def greet():\n    return "hello"\n')
            graph = code_map.scan(root)
            self.assertEqual(graph['edges'][0]['target'], 'pkg/helper.py')
            self.assertEqual(graph['edges'][0]['quote'], source.splitlines(keepends=True)[0])
            self.assertIsNone(graph['edges'][1]['target'])
            quote = code_map.evidence(graph, 'pkg/main.py', 1, 2)
            self.assertEqual(quote['quote'], 'from . import helper\nimport os\n')
            self.assertEqual(len(quote['sha256']), 64)
            with self.assertRaises(ValueError):
                code_map.evidence(graph, '../secret.py', 1, 1)
            with self.assertRaises(ValueError):
                code_map.evidence(graph, 'pkg/main.py', 0, 2)

    def test_symlinks_exclusions_and_syntax_errors(self):
        with tempfile.TemporaryDirectory() as directory, tempfile.TemporaryDirectory() as outside:
            root = Path(directory)
            secret = Path(outside, 'secret.py')
            secret.write_text('SECRET = "outside"')
            (root / 'leak.py').symlink_to(secret)
            (root / 'outside').symlink_to(outside, target_is_directory=True)
            (root / 'node_modules').mkdir()
            (root / 'node_modules/hidden.py').write_text('')
            (root / 'bad.py').write_text('def broken(')
            graph = code_map.scan(root)
            self.assertEqual([n['path'] for n in graph['nodes']], ['bad.py'])
            self.assertEqual(len(graph['diagnostics']), 1)

    def test_typescript_ast_ignores_comments_and_resolves_alias(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'package.json').write_text('{}')
            (root / 'tsconfig.app.json').write_text('{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}')
            (root / 'src').mkdir()
            (root / 'src/helper.ts').write_text('export const value = 1;')
            (root / 'src/main.ts').write_text('// import "fake";\nimport { value } from "@/helper";\nconst lazy = import("./helper");\nconst unknown = import(something);\nthrow new Error("not executed");')
            graph = code_map.scan(root)
            self.assertEqual(len(graph['edges']), 3)
            self.assertEqual(graph['edges'][0]['target'], 'src/helper.ts')
            self.assertEqual(graph['edges'][1]['kind'], 'dynamic-import')
            self.assertEqual(graph['edges'][2]['specifier'], '<computed>')
            self.assertEqual(graph['edges'][0]['line'], 2)


if __name__ == '__main__':
    unittest.main()
