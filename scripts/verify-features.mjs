/**
 * verify-features.mjs — prove the new motion and navigation actually happen,
 * in a real browser, and capture what the page looks like while it happens.
 *
 * The unit tests in test-plate-viewer.mjs prove the plate viewer behaves. This
 * proves the things that only exist once a page is scrolled, themed and
 * clicked, which is where the previous round failed silently: the CSS was
 * correct but nothing had ever watched it run.
 *
 *   node scripts/verify-features.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4321';
const OUT = 'output/verify';
mkdirSync(OUT, { recursive: true });

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
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// ---------------------------------------------------------------- work page
await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

check('the work page loads', (await page.title()).includes('Work'));

// The sheet is a real object with real depth, in both schemes.
const sheet = await page.evaluate(() => {
  const el = document.querySelector('.sheet');
  if (!el) return null;
  const cs = getComputedStyle(el);
  return { shadow: cs.boxShadow, bg: cs.backgroundImage.slice(0, 20) };
});
check('the sheet has depth in light mode', !!sheet && sheet.shadow !== 'none', sheet ? sheet.shadow.slice(0, 40) : 'missing');

await page.evaluate(() => document.documentElement.classList.add('dark'));
await page.waitForTimeout(300);
const sheetDark = await page.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.sheet'));
  return cs.boxShadow;
});
check('the sheet reads as an object in dark mode', sheetDark.split('rgba').length > 2, `${sheetDark.split('rgba').length - 1} shadow layers`);
await page.evaluate(() => document.documentElement.classList.remove('dark'));

// The reading rail is driven by the scroll timeline and its fill grows.
const rail = await page.evaluate(() => {
  const el = document.querySelector('.reading-rail');
  const fill = el?.querySelector('i');
  return {
    present: !!el,
    timeline: fill ? getComputedStyle(fill).animationTimeline : '',
    transform: fill ? getComputedStyle(fill).transform : '',
  };
});
check('the reading rail is present', rail.present);
check('the rail fill is scroll-driven', rail.timeline.includes('scroll'), rail.timeline);
// scaleY(0) serialises as matrix(1, 0, 0, 0, 0, 0) — the vertical scale is the
// fourth component. Asserting on scaleX(0) instead is the classic mistake.
check('the rail fill starts empty', rail.transform === 'matrix(1, 0, 0, 0, 0, 0)', rail.transform);

// Scrolling fills it. This is the assertion that matters: a rail that is
// scroll-driven but never moves is indistinguishable from a broken one.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.6));
await page.waitForTimeout(400);
const railFilled = await page.evaluate(
  () => getComputedStyle(document.querySelector('.reading-rail i')).transform,
);
check('the rail fills as you read', railFilled !== 'matrix(1, 0, 0, 0, 0, 0)', railFilled);
await page.evaluate(() => window.scrollTo(0, 0));

// Word-by-word reveal: the ranges are authored per word, and the colour moves.
const words = await page.evaluate(() => {
  const el = document.querySelector('.word-lit');
  if (!el) return null;
  const spans = Array.from(el.querySelectorAll('span'));
  return {
    count: spans.length,
    ranges: spans.slice(0, 3).map((s) => s.style.animationRange),
    supports: CSS.supports('animation-timeline', 'view()'),
  };
});
check('the word reveal is present', words && words.count > 8, `${words?.count} words`);
check('word ranges are authored, not delayed', words && /entry \d/.test(words.ranges[0]), words ? words.ranges[0] : '');
check('scroll-driven animations are supported', words && words.supports);

// The statement resolves word by word as it crosses the reading band.
//
// This needs a *short* viewport and its own page: on a full-height viewport the
// statement is already inside the frame at scroll position zero, so its entry
// range has already elapsed and every sample reads the final state. With a short
// viewport it begins below the fold, and scrolling through its entry range is
// the only way to watch it resolve. What proves the reveal is live is that the
// colour varies with scroll position — a stuck animation could not do that.
const short = await browser.newContext({
  viewport: { width: 1600, height: 560 },
  reducedMotion: 'no-preference',
});
const spage = await short.newPage();
await spage.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
const startTop = await spage.evaluate(() => document.querySelector('.word-lit').getBoundingClientRect().top);
check('the statement begins below the fold', startTop > 300, `top ${Math.round(startTop)}px in a 560px viewport`);

const wordSamples = [];
for (const y of [0, 250, 500, 750, 1100]) {
  await spage.evaluate((v) => window.scrollTo(0, v), y);
  await spage.waitForTimeout(200);
  wordSamples.push(
    await spage.evaluate(() => getComputedStyle(document.querySelector('.word-lit span')).color),
  );
}
const distinctWords = new Set(wordSamples).size;
check(
  'the words resolve as you scroll',
  distinctWords > 1,
  `${distinctWords} states: ${wordSamples.join(' → ')}`,
);
await short.close();

// ------------------------------------------------- the path explorer
const tabCount = await page.locator('[data-explorer-tab]').count();
check('the path explorer has four paths', tabCount === 4, `${tabCount} tabs`);

const firstPanel = page.locator('[data-explorer-panel]').first();
check('the first panel is open', await firstPanel.isVisible());

// Clicking a path swaps the panel and the screenshot.
const firstShot = await firstPanel.locator('img').first().getAttribute('src');
await page.locator('[data-explorer-tab]').nth(2).click();
await page.waitForTimeout(500);
const thirdPanel = page.locator('[data-explorer-panel]').nth(2);
const thirdShot = await thirdPanel.locator('img').first().getAttribute('src');
check('choosing a path swaps the screen', firstShot !== thirdShot, `${firstShot?.split('/').pop()} → ${thirdShot?.split('/').pop()}`);
check('the previous panel is hidden', !(await page.locator('[data-explorer-panel]').first().isVisible().catch(() => false)));
check(
  'the chosen tab is marked selected',
  (await page.locator('[data-explorer-tab]').nth(2).getAttribute('aria-selected')) === 'true',
);

// Arrow keys move between paths.
await page.locator('[data-explorer-tab]').nth(2).focus();
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(300);
const afterArrow = await page.evaluate(() => {
  const t = Array.from(document.querySelectorAll('[data-explorer-tab]'));
  return { index: t.findIndex((x) => x.getAttribute('aria-selected') === 'true'), total: t.length };
});
check('arrow keys move between paths', afterArrow.index === 3, `now on ${afterArrow.index + 1} of ${afterArrow.total}`);

// ------------------------------------------------- the catalog
// `.label` uppercases, so the rendered text is the module name in caps. Match
// case-insensitively — what matters is that the exact module identifier is on
// the page and therefore checkable against the repository.
const scopeRaw = await page.locator('.scope').first().innerText();
check('the catalog names the social module in plain language', /Social media, email & SMS marketing/i.test(scopeRaw));
check('the catalog still shows the module name', /imbirt_social/i.test(scopeRaw));
check('the catalog shows 35 applications', /35/.test(scopeRaw));

// ------------------------------------------------- the contents bar
await page.goto(`${BASE}/work/imbirt`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
const contents = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('[data-contents-link]'));
  const targets = links.map((l) => document.querySelector(l.hash)).filter(Boolean);
  return { links: links.length, targets: targets.length, first: links[0]?.getAttribute('href') };
});
check('the contents bar has all ten sections', contents.links === 10 && contents.targets === 10, `${contents.links} links, ${contents.targets} targets`);

// Scrolling a section into view marks it current in the bar.
await page.evaluate(() => document.querySelector('#ai')?.scrollIntoView({ block: 'start' }));
await page.waitForTimeout(900);
const current = await page.evaluate(() => {
  const el = document.querySelector('[data-contents-link][aria-current="true"]');
  return el ? el.getAttribute('href') : '(none)';
});
check('the contents bar tracks where you are', current === '#ai', current);

// ------------------------------------------------- proof of the visual result
const shots = [
  ['work-top', `${BASE}/work`, 0],
  ['work-explorer', `${BASE}/work`, 900],
  ['work-scope', `${BASE}/work`, 1900],
  ['imbirt-top', `${BASE}/work/imbirt`, 0],
  ['imbirt-ai', `${BASE}/work/imbirt`, 0],
];
for (const [name, url, y] of shots) {
  await page.goto(url, { waitUntil: 'networkidle' });
  if (y) await page.evaluate((v) => window.scrollTo(0, v), y);
  if (name === 'imbirt-ai') await page.evaluate(() => document.querySelector('#ai')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`      shot → output/verify/${name}.png`);
}

// Hover proof: the loupe, mid-hover, so the spotlight is visible in the shot.
await page.goto(`${BASE}/work`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.scrollTo(0, 400));
await page.waitForTimeout(500);
const plate = page.locator('[data-plate-trigger]').first();
const box = await plate.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/work-loupe.png` });
  console.log('      shot → output/verify/work-loupe.png');
}

check('no console or page errors across the whole run', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length === 0 ? 0 : 1);
