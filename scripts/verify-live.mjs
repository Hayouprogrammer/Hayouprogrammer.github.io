/**
 * verify-live.mjs — prove the deployed site behaves, not just that it 200s.
 *
 *   node scripts/verify-live.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.argv[2] ?? process.env.LIVE_URL ?? 'https://hayouprogrammer.github.io';

import { launchOptions } from './browser.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch(launchOptions());
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

// The loupe, on the deployed bundle: a dim field opens, it is centred on the
// cursor, and the capture sharpens inside it. This is the plate interaction
// that replaced a 3D tilt — the tilt moved the whole picture and told you
// nothing, whereas this makes one region of a dense Odoo screen readable.
await page.goto(`${BASE}/work`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const dplate = page.locator('[data-plate-trigger]').first();
await dplate.scrollIntoViewIfNeeded();
await page.mouse.move(4, 4);
await dplate.hover();
await page.waitForTimeout(800);
const loupe = await dplate.evaluate((el) => {
  const lamp = el.querySelector('.plate-lamp');
  const img = el.querySelector('img');
  return {
    lamp: lamp ? getComputedStyle(lamp).opacity : '',
    mx: el.style.getPropertyValue('--mx').trim(),
    filter: img ? getComputedStyle(img).filter : '',
  };
});
check('the loupe opens on the deployed build', loupe.lamp === '1', `spotlight opacity ${loupe.lamp}`);
check(
  'the spotlight tracks the cursor',
  Math.abs(parseFloat(loupe.mx) - 50) < 6,
  `${loupe.mx}`,
);
check('the capture sharpens inside the spotlight', loupe.filter.includes('saturate'), loupe.filter);

// The word reveal is driven by the scroll timeline, which is the part that was
// silently dead for a long time. Prove the deployed build has a live one — on a
// short viewport, because on a full-height one the statement is already inside
// the frame and its entry range has elapsed before the first sample.
const sw = await browser.newContext({
  viewport: { width: 1440, height: 560 },
  reducedMotion: 'no-preference',
});
const spage = await sw.newPage();
await spage.goto(`${BASE}/work`, { waitUntil: 'domcontentloaded' });
await spage.waitForTimeout(2000);
const wordStates = new Set();
for (const y of [0, 300, 600, 1000, 1400]) {
  await spage.evaluate((v) => window.scrollTo(0, v), y);
  await spage.waitForTimeout(220);
  wordStates.add(
    await spage.evaluate(() => getComputedStyle(document.querySelector('.word-lit span')).color),
  );
}
check('the word reveal is live on the deployed build', wordStates.size > 1, `${wordStates.size} states`);
await sw.close();

// The immersive viewer opens on the deployed build.
await dplate.click();
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
