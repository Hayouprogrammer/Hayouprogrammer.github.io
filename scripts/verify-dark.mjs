/**
 * verify-dark.mjs — the Sheet/Binding pair, side by side.
 *
 * The dark scheme was reported as "not working", and it was: `.dark .sheet` was
 * a rule with nothing to attach to, so the sheet had no depth at all and the two
 * schemes were just colour inversions of each other.
 *
 * This captures the same two moments of the same routes in both schemes, so the
 * difference is visible rather than asserted. Written to output/verify/.
 *
 *   node scripts/verify-dark.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { launchOptions } from './browser.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4321';
const OUT = 'output/verify';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch(launchOptions());

const captures = [
  ['home', '/', 0],
  ['work', '/work', 0],
  ['work-scope', '/work', 1500],
  ['imbirt', '/work/imbirt', 0],
];

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    reducedMotion: 'no-preference',
    colorScheme: scheme,
  });
  const page = await context.newPage();
  await page.addInitScript(
    (s) => localStorage.setItem('hg-theme', s),
    scheme === 'dark' ? 'dark' : 'light',
  );

  for (const [name, path, y] of captures) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    if (y) await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(1400);
    await page.screenshot({ path: `${OUT}/${name}-${scheme}.png` });
    console.log(`      ${name}-${scheme}.png`);
  }

  // One hover shot per scheme: the loupe is the new plate interaction and it
  // must read in both materials.
  await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(500);
  const plate = page.locator('[data-plate-trigger]').first();
  const box = await plate.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.32, box.y + box.height * 0.4);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/loupe-${scheme}.png` });
    console.log(`      loupe-${scheme}.png`);
  }

  await context.close();
}

await browser.close();
console.log('\nSheet and Binding captured in output/verify/.');
