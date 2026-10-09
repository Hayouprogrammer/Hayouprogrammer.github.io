/**
 * verify-qr.mjs — decode the generated QR rasters back to text and prove they
 * carry the intended payload. A QR nobody can read is worse than no QR.
 *
 *   node scripts/verify-qr.mjs
 */
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const QR_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'qr');
const expect = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'qr.config.json'), 'utf8'),
);

const cases = [
  { file: 'imbirt-brochure.png', expect: expect.target, label: 'brochure URL' },
  { file: 'vcard.png', expect: 'BEGIN:VCARD', label: 'vCard' },
];

let bad = 0;
for (const c of cases) {
  const png = PNG.sync.read(readFileSync(join(QR_DIR, c.file)));
  const result = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  if (!result) {
    console.log(`FAIL  ${c.file.padEnd(24)} could not decode`);
    bad++;
    continue;
  }
  const ok = result.data.startsWith(c.expect);
  if (!ok) bad++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.file.padEnd(24)} ${c.label}`);
  console.log(`      ${result.data.replace(/\n/g, ' / ').slice(0, 160)}`);
  if (!ok) console.log(`      expected something starting: ${c.expect}`);
}
console.log(`\n${bad === 0 ? 'All QR codes decode to the intended payload.' : `${bad} QR code(s) failed.`}`);
process.exit(bad === 0 ? 0 : 1);
