/**
 * repair-encoding.mjs
 *
 * PowerShell's `Set-Content -Encoding utf8` on Windows PowerShell 5.1 writes a
 * UTF-8 BOM, and `Get-Content -Raw` reads with the machine's ANSI codepage
 * (cp1252 on this box). Every non-ASCII character in files edited that way was
 * therefore double-encoded: an em-dash (UTF-8 bytes E2 80 94) came back as the
 * three characters U+00E2 U+20AC U+201D, which is the classic "a-hat euro
 * right-quote" corruption.
 *
 * The repair re-encodes the current text as cp1252 to recover the original
 * bytes, then decodes those bytes as UTF-8. It also strips any BOM.
 *
 *   node scripts/repair-encoding.mjs --dry-run
 *   node scripts/repair-encoding.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY = process.argv.includes('--dry-run');
const EXTS = new Set(['.astro', '.mjs', '.cjs', '.ts', '.css', '.md', '.json', '.txt', '.svg', '.html']);
const SKIP = /(^|\/|\\)(node_modules|dist|\.astro|\.git|\.impeccable|\.github)(\/|\\|$)/;

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (SKIP.test(full)) continue;
    if (e.isDirectory()) walk(full, out);
    else if (EXTS.has(extname(e.name))) out.push(full);
  }
  return out;
}

/** The cp1252 upper half. Code points outside it map to themselves. */
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

/** Encode a string as cp1252. Returns null if a character has no mapping. */
function cp1252Encode(s) {
  const out = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp < 0x100) out.push(cp);
    else if (CP1252[cp] !== undefined) out.push(CP1252[cp]);
    else return null;
  }
  return Buffer.from(out);
}

/** True when the text carries the signature of a round-tripped high byte. */
function looksMangled(text) {
  return /[\u00c2-\u00c3][\u0080-\u00bf]/.test(text)
    || /[\u00e2][\u20ac\u201a-\u201e\u2026\u2020-\u2022\u2039\u203a\u0152-\u0178\u2122]/.test(text);
}

let repaired = 0;
let cleaned = 0;
let ok = 0;

for (const file of walk(ROOT)) {
  let buf = readFileSync(file);
  const hadBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  if (hadBom) buf = buf.subarray(3);

  const text = buf.toString('utf8');
  if (!looksMangled(text)) {
    if (hadBom) {
      if (!DRY) writeFileSync(file, buf);
      cleaned++;
      console.log(`BOM   ${file.replace(ROOT + '\\', '')}`);
    } else {
      ok++;
    }
    continue;
  }

  const bytes = cp1252Encode(text);
  if (!bytes) {
    console.log(`SKIP  ${file.replace(ROOT + '\\', '')}  (character with no cp1252 mapping)`);
    continue;
  }

  let fixed;
  try {
    fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    console.log(`SKIP  ${file.replace(ROOT + '\\', '')}  (recovered bytes are not valid UTF-8)`);
    continue;
  }

  const stillMangled = looksMangled(fixed);
  repaired++;
  if (!DRY) writeFileSync(file, Buffer.from(fixed, 'utf8'));
  console.log(
    `${stillMangled ? 'WARN' : 'FIX '} ${file.replace(ROOT + '\\', '')}  bom=${hadBom}  ` +
      `e.g. ${JSON.stringify(fixed.match(/.{0,14}[—–·→…“”].{0,14}/)?.[0] ?? '(none left)')}`,
  );
}

console.log(
  `\n${DRY ? 'would repair' : 'repaired'} ${repaired} file(s), stripped BOM from ${cleaned}, ${ok} already clean.`
  + (DRY ? '\nre-run without --dry-run to apply.' : ''),
);
