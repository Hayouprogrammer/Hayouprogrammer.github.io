/**
 * shot-one.mjs — screenshot a single element for close inspection.
 *   node scripts/shot-one.mjs "/work/imbirt" "figure" gov
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.impeccable', 'review');
const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:4321';
const [route, selector, name] = process.argv.slice(2);

import { launchOptions } from './browser.mjs';

const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
await page.goto(BASE + route, { waitUntil: 'networkidle' });
const el = page.locator(selector);
const n = await el.count();
if (n === 0) {
  console.log(`no element matched ${selector}`);
} else {
  // The governance figure is the second <figure> on the case study.
  const target = (await el.count()) > 1 ? el.nth(1) : el.first();
  await target.screenshot({ path: join(OUT, `${name}.png`) });
  console.log(`wrote ${name}.png`);
}
await browser.close();
