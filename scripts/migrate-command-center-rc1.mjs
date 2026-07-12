import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/App.tsx';
let source = readFileSync(path, 'utf8');

const replacements = [
  [
    'const CommandCenter = lazy(() => import("./pages/CommandCenter"));',
    'const CommandCenter = lazy(() => import("./pages/CommandCenterRC1"));',
  ],
  [
    'return import("./pages/OperatorCommandCenter").then(occMod => ({',
    'return import("./pages/OperatorCommandCenterRC1").then(occMod => ({',
  ],
  [
    '                <Route path="/command-center" element={<CommandCenter />} />',
    '                <Route path="/command-center" element={<CommandCenter />} />\n                <Route path="/operations" element={<CommandCenter />} />',
  ],
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) {
    throw new Error(`Expected App.tsx fragment was not found: ${before}`);
  }
  source = source.replace(before, after);
}

writeFileSync(path, source);
