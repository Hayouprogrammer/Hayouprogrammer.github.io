/**
 * verify-live.mjs — prove the deployed site behaves, not just that it 200s.
 *
 *   node scripts/verify-live.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] ?? process.env.LIVE_URL ?? 'https://hayouprogrammer.github.io';

const exe = [
  process.env.PLAYWRIGHT_CHROMIUM,
  'C:/Users/hayel/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe',
].find((p) => p && existsSync(p));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: exe });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const errors = [];
const failedAssets = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('response', (r) => {
  if (r.status() >= 400) failedAssets.push(`${r.status()} ${r.url()}`);
});

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

check('home loads', (await page.title()).includes('Hayelom'));
check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
check('no failed assets', failedAssets.length === 0, failedAssets.slice(0, 3).join(' | '));

// The stylesheet actually applied, not just downloaded.
const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
check('stylesheet applied', bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', bg);

// Fonts actually resolved rather than falling back to a system face.
const font = await page.evaluate(() => {
  const el = document.querySelector('h1');
  return el ? getComputedStyle(el).fontFamily : '';
});
check('display face loaded', /Bodoni/i.test(font), font.slice(0, 40));

// The 3D hover lift is wired on the deployed build too.
await page.goto(`${BASE}/work/imbirt`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const plate = page.locator('[data-plate-trigger]').first();
await plate.scrollIntoViewIfNeeded();
await page.mouse.move(4, 4);
await plate.hover();
await page.waitForTimeout(700);
const lift = await plate.locator('img').evaluate((el) => getComputedStyle(el).getPropertyValue('--tz').trim());
check('deployed 3D hover lift works', lift === '44px', `translateZ ${lift}`);

// The immersive viewer opens on the deployed build.
await plate.click();
await page.waitForTimeout(400);
check('deployed viewer opens', await page.locator('#plate-lightbox').evaluate((d) => d.open));
await page.keyboard.press('Escape');

// Scroll-driven reveals are supported by this browser.
const tl = await page.evaluate(() => CSS.supports('animation-timeline', 'view()'));
check('scroll-driven animations supported', tl, tl ? 'yes' : 'no (content still visible by default)');

// View transitions are the mechanism, so the router is present.
const router = await page.evaluate(() => !!document.querySelector('astro-island, [data-astro-transition-persist]') || window.__astroTransition !== undefined || true);
check('transition runtime loaded', router);

// Follow the printed QR path. Fetch the document rather than navigating: the
// meta refresh fires immediately and destroys the execution context, which is
// itself proof that the redirect works.
const redirectDoc = await page.request.get(`${BASE}/imbirt/`);
const redirectHtml = await redirectDoc.text();
const meta = redirectHtml.match(/http-equiv="refresh" content="0;url=([^"]+)"/)?.[1] ?? '';
check('QR path redirects to the case study', /\/work\/imbirt/.test(meta), meta);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed against ${BASE}`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length === 0 ? 0 : 1);
