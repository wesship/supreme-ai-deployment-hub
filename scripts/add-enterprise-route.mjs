import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/App.tsx';
let source = readFileSync(path, 'utf8');
const route = '                <Route path="/security" element={<Security />} />';
const replacement = `${route}\n                <Route path="/enterprise" element={<Security />} />`;

if (!source.includes(route)) throw new Error('Expected /security route was not found.');
if (!source.includes('path="/enterprise"')) source = source.replace(route, replacement);
writeFileSync(path, source);
