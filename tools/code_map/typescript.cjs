// Parses source text only. Never imports or executes the inspected project.
const fs = require('node:fs');
const path = require('node:path');
const {createRequire} = require('node:module');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const projectRequire = createRequire(path.join(input.root, 'package.json'));
const ts = process.env.CODE_MAP_TYPESCRIPT
  ? require(process.env.CODE_MAP_TYPESCRIPT) : projectRequire('typescript');
const configPath = ts.findConfigFile(input.root, ts.sys.fileExists, 'tsconfig.app.json');
let options = {};
if (configPath) {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  options = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options;
}
const output = input.files.map(file => {
  const filename = path.join(input.root, file.path);
  const source = ts.createSourceFile(filename, file.source, ts.ScriptTarget.Latest, true);
  const imports = [], symbols = [], diagnostics = [];
  const location = node => ({line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    end_line: source.getLineAndCharacterOfPosition(node.end).line + 1});
  function add(node, literal, kind) {
    const loc = location(node);
    let target = null;
    if (literal && ts.isStringLiteralLike(literal)) {
      const result = ts.resolveModuleName(literal.text, filename, options, ts.sys).resolvedModule;
      if (result) {
        const relative = path.relative(input.root, result.resolvedFileName).split(path.sep).join('/');
        if (!relative.startsWith('../') && !path.isAbsolute(relative)) target = relative;
      }
      imports.push({...loc, specifier: literal.text, kind, target});
    } else imports.push({...loc, specifier: '<computed>', kind, target});
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) add(node, node.moduleSpecifier, 'import');
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node, node.moduleSpecifier, 're-export');
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      add(node, node.arguments[0], node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic-import' : 'require');
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
      || ts.isTypeAliasDeclaration(node) || ts.isVariableDeclaration(node)) && node.name && ts.isIdentifier(node.name)) {
      symbols.push({...location(node), name: node.name.text, kind: ts.SyntaxKind[node.kind]});
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  for (const error of source.parseDiagnostics) diagnostics.push(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
  return {path: file.path, imports, symbols, diagnostics};
});
process.stdout.write(JSON.stringify(output));
