import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/App.tsx';
let source = readFileSync(path, 'utf8');

const importBefore = 'const FilmPage = lazy(() => import("./pages/Film"));';
const importAfter = 'const FilmPage = lazy(() => import("./pages/AIFilms"));';
const routeBefore = '                <Route path="/film" element={<FilmPage />} />';
const routeAfter = '                <Route path="/film" element={<FilmPage />} />\n                <Route path="/ai-films" element={<FilmPage />} />';

if (!source.includes(importBefore)) {
  throw new Error('Expected Film page lazy import was not found.');
}
if (!source.includes(routeBefore)) {
  throw new Error('Expected /film route was not found.');
}

source = source.replace(importBefore, importAfter).replace(routeBefore, routeAfter);
writeFileSync(path, source);
