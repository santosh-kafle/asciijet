// Jet Atlas build: concatenates src/ into one self-contained page.
//   dist/index.html     the website
//   dist/artifact.html  the same page without the document wrapper (for a claude.ai artifact)
//   dist/engine.cjs     the DOM-free engine (geometry, data, renderer) for node tests
// Usage: node build.mjs            (no dependencies; Node 18+)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

// Files named 0x-4x are the engine (no DOM). 5x and up are the page.
const list = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
const engine = list.filter(f => parseInt(f, 10) < 50);
const page = list.filter(f => parseInt(f, 10) >= 50);
const cat = fs => fs.map(f => `\n// ---- ${f}\n` + read(f)).join('');

const js = `(() => {\n'use strict';\n${cat(engine)}${cat(page)}\n})();\n`;
try { new vm.Script(js, { filename: 'jetatlas.js' }); }
catch (e) { console.error('Syntax error in the bundled script:\n' + e.stack.split('\n').slice(0, 6).join('\n')); process.exit(1); }

const head = read('head.html'), body = read('body.html');
const script = `<script>\n/* Jet Atlas ${new Date().toISOString().slice(0, 10)} */\n${js}</script>\n`;
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, 'index.html'),
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${script}</body>\n</html>\n`);
fs.writeFileSync(path.join(DIST, 'artifact.html'), `${head}\n${body}\n${script}`);
fs.writeFileSync(path.join(DIST, 'engine.cjs'),
  `'use strict';\n${cat(engine)}\nmodule.exports = { AIRCRAFT, STORES, buildScene, Renderer, perfAt, loadoutMass, makeCam, fxFor };\n`);
const kb = f => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' KB';
console.log(`built ${list.length} scripts -> dist/index.html (${kb('index.html')}), dist/artifact.html, dist/engine.cjs`);
