/**
 * contrast.mjs — WCAG contrast audit that reads the REAL tokens from
 * src/styles/global.css, so it can never drift from what the site ships.
 *
 *   node scripts/contrast.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(ROOT, 'src', 'styles', 'global.css'), 'utf8');

/** Pull `--token: value` out of a CSS block. */
function tokensOf(selector) {
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector ${selector} not found in global.css`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const block = css.slice(open + 1, close);
  const out = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = tokensOf(':root {');
const dark = tokensOf('.dark {');

const lin = (c) => {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
};
const hex = (h) => {
  const s = h.replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
};
const lum = (h) => {
  const [r, g, b] = hex(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const R = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Every pair the site actually renders, with the token names it uses.
const checks = [
  ['light', 'ink-900 on paper', R(light['ink-900'], light.paper), 'body text'],
  ['light', 'ink-700 on paper', R(light['ink-700'], light.paper), 'body secondary'],
  ['light', 'ink-700 on paper-raised', R(light['ink-700'], light['paper-raised']), 'cards'],
  ['light', 'ink-500 on paper', R(light['ink-500'], light.paper), 'labels'],
  ['light', 'ink-500 on paper-raised', R(light['ink-500'], light['paper-raised']), 'labels on cards'],
  ['light', 'ink-300 on paper', R(light['ink-300'], light.paper), 'captions, footers'],
  ['light', 'brass-600 on paper', R(light['brass-600'], light.paper), 'serials, accents'],
  ['light', 'brass-600 on paper-raised', R(light['brass-600'], light['paper-raised']), 'serials on cards'],
  ['light', 'oxblood on paper', R(light.oxblood, light.paper), 'exception text'],
  ['light', 'bone on ledger-900', R(light.bone, light['ledger-900']), 'contact band'],
  ['light', 'brass-400 on ledger-900', R(light['brass-400'], light['ledger-900']), 'band accents'],
  ['light', 'ledger-900 on brass-400', R(light['ledger-900'], light['brass-400']), 'primary button'],
  ['light', 'ink-900 on brass-200', R(light['ink-900'], light['brass-200']), 'highlighted figure row'],
  ['dark', 'ink-900 on paper', R(dark['ink-900'], dark.paper), 'body text'],
  ['dark', 'ink-700 on paper', R(dark['ink-700'], dark.paper), 'body secondary'],
  ['dark', 'ink-700 on paper-raised', R(dark['ink-700'], dark['paper-raised']), 'cards'],
  ['dark', 'ink-500 on paper', R(dark['ink-500'], dark.paper), 'labels'],
  ['dark', 'ink-300 on paper', R(dark['ink-300'], dark.paper), 'captions, footers'],
  ['dark', 'brass-600 on paper', R(dark['brass-600'], dark.paper), 'serials, accents'],
  ['dark', 'brass-600 on paper-raised', R(dark['brass-600'], dark['paper-raised']), 'serials on cards'],
  ['dark', 'oxblood on paper', R(dark.oxblood, dark.paper), 'exception text'],
  ['dark', 'bone on ledger-900', R(dark.bone, dark['ledger-900']), 'contact band'],
  ['dark', 'brass-400 on ledger-900', R(dark['brass-400'], dark['ledger-900']), 'band accents'],
  ['dark', 'ledger-900 on brass-400', R(dark['ledger-900'], dark['brass-400']), 'primary button'],
  ['dark', 'ink-900 on brass-200', R(dark['ink-900'], dark['brass-200']), 'highlighted figure row'],
];

const MIN = 4.5;
let fails = 0;
for (const [scheme, name, ratio, where] of checks) {
  const pass = ratio >= MIN;
  if (!pass) fails++;
  console.log(
    `${pass ? 'PASS' : 'FAIL'}  ${scheme.padEnd(5)} ${name.padEnd(28)} ${ratio.toFixed(2).padStart(6)}:1   ${where}`,
  );
}
console.log(`\n${fails} failing pair(s) of ${checks.length}`);
process.exit(fails === 0 ? 0 : 1);
