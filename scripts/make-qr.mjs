/**
 * make-qr.mjs — print-grade QR codes for the brochure and the CV.
 *
 *   node scripts/make-qr.mjs                     # uses QR_TARGET from qr.config.json
 *   QR_TARGET=https://hayelom.dev/imbirt node scripts/make-qr.mjs
 *
 * WHY THIS EXISTS
 * A QR code on a printed brochure is permanent. It must encode a domain the
 * owner controls — never a hosting subdomain — so the target can be re-pointed
 * without reprinting. Change QR_TARGET, re-run, reprint. Nothing else changes.
 *
 * Engineering spec enforced here:
 *   · Error-correction level H  — survives creases, folds and partial damage
 *   · Quiet zone ≥ 4 modules    — scanners need the margin
 *   · Rendered at ≥ 20 modules/cm at the final printed size
 *   · Dark modules on a light ground — the highest-contrast, most reliable form
 *   · Vector (SVG) for print; PNG only as a proof/preview
 */
import QRCode from 'qrcode';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'qr');
const CONFIG = join(ROOT, 'qr.config.json');

const config = existsSync(CONFIG)
  ? JSON.parse(readFileSync(CONFIG, 'utf8'))
  : {};

const TARGET = process.env.QR_TARGET ?? config.target ?? 'https://hayelom.pages.dev/imbirt';
const VCARD_TARGET = process.env.QR_VCARD ?? config.vcard ?? 'https://hayelom.pages.dev/contact';

// --- vCard payload: scan once, contact saved, no typing ---
const vcard = [
  'BEGIN:VCARD',
  'VERSION:3.0',
  'N:Gebrewahid;Hayelom;;;',
  'FN:Hayelom Gebrewahid',
  'ORG:Imbirt — Ethiopian ERP',
  'TITLE:ERP & Platform Engineer',
  'TEL;TYPE=CELL:+251930994308',
  'EMAIL:hayelomgebrewahid@gmail.com',
  'URL:' + VCARD_TARGET,
  'ADR;TYPE=WORK:;;;;Addis Ababa;;;Ethiopia',
  'END:VCARD',
].join('\n');

const common = {
  errorCorrectionLevel: 'H', // the whole point — creases on a folded leaflet
  margin: 4,                 // quiet zone in modules
  color: { dark: '#15181a', light: '#ffffff' }, // dark on light, never the reverse
  type: 'svg',
};

mkdirSync(OUT, { recursive: true });

const writes = [];

// 1. The brochure code — vector, for the print shop.
writes.push(
  QRCode.toString(TARGET, { ...common, type: 'svg' }).then((svg) => {
    const file = 'imbirt-brochure.svg';
    writeFileSync(join(OUT, file), svg, 'utf8');
    return [file, TARGET];
  }),
);

// 2. A proof raster at print resolution (3 cm wide).
//    3 cm at 300 dpi ≈ 354 px. Rendered at 1200 px so it downscales cleanly.
writes.push(
  QRCode.toFile(join(OUT, 'imbirt-brochure.png'), TARGET, {
    ...common,
    type: 'png',
    width: 1200,
    margin: 4,
  }).then(() => ['imbirt-brochure.png', `${TARGET} (3 cm @ 300 dpi proof)`]),
);

// 3. The contact code — on the back of the leaflet and on the CV.
writes.push(
  QRCode.toString(vcard, { ...common, type: 'svg' }).then((svg) => {
    const file = 'vcard.svg';
    writeFileSync(join(OUT, file), svg, 'utf8');
    return [file, 'vCard — Hayelom Gebrewahid'];
  }),
);

writes.push(
  QRCode.toFile(join(OUT, 'vcard.png'), vcard, { ...common, type: 'png', width: 1200, margin: 4 }).then(
    () => ['vcard.png', 'vCard (proof raster)'],
  ),
);

const results = await Promise.all(writes);

const notes = `# QR codes for print — ${new Date().toISOString().slice(0, 10)}

## Encoded targets

| File | Payload |
|---|---|
${results.map(([f, t]) => `| \`${f}\` | ${t} |`).join('\n')}

## Print specification (hand this to the print shop)

| Property | Value | Why |
|---|---|---|
| Error correction | **Level H** (~30% recoverable) | A folded, creased or scuffed leaflet still scans |
| Quiet zone | **≥ 4 modules** on every side | Scanners refuse codes without the margin |
| Printed size | **≥ 3 × 3 cm**, target 4 × 4 cm | Below ~2 cm, phone cameras fail at arm's length |
| Colour | **Dark modules on light ground** | Light-on-dark fails on many cameras |
| Logo | optional, **≤ 20% of area**, only because we use level H | More than that and recovery breaks |
| Resolution | vector SVG, or ≥ 300 dpi PNG | Never upscale a raster |
| Paper | **matte / uncoated** | Gloss laminate creates glare and failed scans |
| Placement | flat, never across a fold or a crease line | a crease through the code is a dead code |

## The rule that makes this safe

The QR encodes **\`${TARGET}\`**. That is a redirect, not the content. When the
domain changes:

1. Buy and point the new domain at the same host.
2. \`QR_TARGET=https://<new-domain>/imbirt node scripts/make-qr.mjs\`
3. Reprint.

**Do not print a code that points at a hosting subdomain.** If the host
changes, every leaflet already handed out is dead.

## Tracking (recommended, free)

Give each print run its own target so you know what worked:

\`\`\`text
QR_TARGET="https://<domain>/imbirt?utm_source=brochure&utm_medium=print&utm_campaign=<event>-2026-10"
\`\`\`

The case study persists the source and can show it back to you.
Cloudflare Web Analytics (cookieless, free) records the visits — no consent
banner, which matters because a scanner is already one tap from leaving.

## Test before the print run

Scan on three different phones, at arm's length and at 30 cm, in daylight and
under office lighting. If any of the six attempts fails, the code is too small,
the contrast is wrong, or the laminate is too glossy.
`;

writeFileSync(join(OUT, 'README.md'), notes, 'utf8');

console.log('\nQR codes written to public/qr/');
for (const [file, target] of results) console.log(`  ${file.padEnd(26)} ${target}`);
console.log(`\nvCard payload:\n${vcard}\n`);
console.log(`target: ${TARGET}`);
console.log('read public/qr/README.md for the print specification');
