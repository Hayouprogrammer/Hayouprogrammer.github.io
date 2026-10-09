/**
 * optimize-images.mjs — shrink the product captures for the network.
 *
 * The captures are 3200x2000 @2x PNGs, which is right for a source file and
 * wrong for a phone on Ethiopian 4G. This resizes to the plate's real display
 * width and writes WebP with a JPEG fallback, into public/shots/.
 *
 *   node scripts/optimize-images.mjs
 *
 * Source files in public/screens/ are never modified. Re-run after any
 * `npm run capture`.
 */
import { readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public', 'screens');
const OUT = join(ROOT, 'public', 'shots');

// The plate never renders wider than ~1200 CSS px on a 2x display.
const MAX_W = 1600;
const WEBP_Q = 82;
const JPEG_Q = 84;

mkdirSync(OUT, { recursive: true });

const files = existsSync(SRC)
  ? readdirSync(SRC).filter((f) => /\.(png|jpe?g)$/i.test(f) && !f.startsWith('.'))
  : [];

let before = 0;
let after = 0;

for (const f of files) {
  const src = join(SRC, f);
  before += statSync(src).size;
  const stem = basename(f, extname(f));

  // Geometry: scale down only, never up.
  execFileSync(
    'magick',
    [
      src,
      '-resize',
      `${MAX_W}x>`,
      '-strip',
      '-quality',
      String(WEBP_Q),
      '-define',
      'webp:method=6',
      join(OUT, `${stem}.webp`),
    ],
    { stdio: 'pipe' },
  );

  execFileSync(
    'magick',
    [src, '-resize', `${MAX_W}x>`, '-strip', '-quality', String(JPEG_Q), '-sampling-factor', '4:2:0', join(OUT, `${stem}.jpg`)],
    { stdio: 'pipe' },
  );

  const webp = statSync(join(OUT, `${stem}.webp`)).size;
  const jpg = statSync(join(OUT, `${stem}.jpg`)).size;
  after += webp;
  console.log(
    `${stem.padEnd(28)} ${(statSync(src).size / 1024).toFixed(0).padStart(5)} KB  ->  ` +
      `webp ${(webp / 1024).toFixed(0).padStart(4)} KB / jpg ${(jpg / 1024).toFixed(0).padStart(4)} KB`,
  );
}

console.log(
  `\n${files.length} image(s) · ${(before / 1024 / 1024).toFixed(2)} MB -> ` +
    `${(after / 1024 / 1024).toFixed(2)} MB of WebP served (${((1 - after / before) * 100).toFixed(0)}% smaller)`,
);
console.log('source PNGs untouched; re-run after `npm run capture`');
