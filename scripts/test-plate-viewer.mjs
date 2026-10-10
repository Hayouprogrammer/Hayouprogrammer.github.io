/**
 * test-plate-viewer.mjs — behavioural test for the plate lightbox.
 *
 * The viewer is the one piece of real interaction on the site, so it gets a
 * test that drives the browser rather than a screenshot that only proves it
 * rendered.
 *
 *   node scripts/test-plate-viewer.mjs
 */
import { chromium } from 'playwright';
import { existsSync } from 'node:fs';

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:4321';

const exe = [
  process.env.PLAYWRIGHT_CHROMIUM,
  'C:/Users/hayel/AppData/Local/ms-playwright/chromium-1247/chrome-win64/chrome.exe',
].find((p) => p && existsSync(p));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

await page.goto(`${BASE}/work/imbirt`, { waitUntil: 'networkidle' });

const triggers = page.locator('[data-plate-trigger]');
const count = await triggers.count();
check('plates exist on the case study', count >= 8, `${count} triggers`);

check('no page errors on load', pageErrors.length === 0, pageErrors.join(' | '));

// ---- open the first plate ----
const first = triggers.first();
const beforeSrc = await first.locator('img').getAttribute('src');
await first.click();

const dialog = page.locator('#plate-lightbox');
check('dialog opens', await dialog.evaluate((d) => d.open), 'open property');

const imgSrc = await dialog.locator('[data-plate-image]').getAttribute('src');
const beforeCurrent = await first.locator('img').evaluate((el) => el.currentSrc);
check(
  'dialog shows the same image',
  !!imgSrc && beforeCurrent.endsWith(imgSrc),
  `${imgSrc} vs ${beforeCurrent}`,
);

const caption = await dialog.locator('[data-plate-caption]').textContent();
check('caption is populated', (caption ?? '').trim().length > 0, caption?.trim().slice(0, 60));

// ---- focus is inside the dialog ----
const focusedId = await page.evaluate(() => document.activeElement?.closest('dialog')?.id ?? null);
check('focus moved into the dialog', focusedId === 'plate-lightbox', String(focusedId));

// ---- zoom ----
await page.keyboard.press('+');
const zoomed = await dialog.locator('[data-plate-zoom-label]').textContent();
check('zoom in works', zoomed !== '100%', `${zoomed}`);

await page.keyboard.press('0');
const reset = await dialog.locator('[data-plate-zoom-label]').textContent();
check('reset to fit works', reset === '100%', `${reset}`);

// ---- next ----
const plateBefore = await dialog.locator('[data-plate-plate]').textContent();
await page.keyboard.press('ArrowRight');
const plateAfter = await dialog.locator('[data-plate-plate]').textContent();
check('next plate works', plateBefore !== plateAfter, `${plateBefore} -> ${plateAfter}`);

// ---- close returns focus ----
await page.keyboard.press('Escape');
check('dialog closes on Escape', !(await dialog.evaluate((d) => d.open)));

const focusedTag = await page.evaluate(() => document.activeElement?.getAttribute('data-plate-trigger') !== null);
check('focus returned to a plate trigger', focusedTag);

// ---- stage click closes ----
await triggers.nth(1).click();
check('reopens', await dialog.evaluate((d) => d.open));
await page.locator('[data-plate-stage]').click({ position: { x: 12, y: 12 } });
check('clicking the stage closes', !(await dialog.evaluate((d) => d.open)));

// ---- clicking the image toggles zoom ----
await triggers.nth(2).click();
check('reopens for zoom', await dialog.evaluate((d) => d.open));
await dialog.locator('[data-plate-image]').click();
const zoomed2 = await dialog.locator('[data-plate-zoom-label]').textContent();
check('clicking the image zooms', zoomed2 !== '100%', `${zoomed2}`);

// Click the centre of the stage, which the image covers at any scale. A plain
// locator.click() resolves to the element's clipped box and becomes unreliable
// once the image is larger than the stage, so drive the mouse directly.
await page.mouse.click(720, 423);
const back = await dialog.locator('[data-plate-zoom-label]').textContent();
check('clicking again returns to fit', back === '100%', `${back}`);
await page.keyboard.press('Escape');
check('closed after zoom toggle', !(await dialog.evaluate((d) => d.open)));

// ---- hover: the plate comes toward the viewer ----
// Its own context with motion allowed: the page above emulates
// prefers-reduced-motion, and that path is asserted separately at the end.
const motion = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'no-preference',
});
const mpage = await motion.newPage();
await mpage.goto(`${BASE}/work/imbirt`, { waitUntil: 'networkidle' });
const target = mpage.locator('[data-plate-trigger]').nth(2);
await target.scrollIntoViewIfNeeded();
await mpage.mouse.move(2, 2);
await target.hover();
await mpage.waitForTimeout(600);

const hoverState = await target.locator('img').evaluate((el) => {
  const cs = getComputedStyle(el);
  const frame = getComputedStyle(el.parentElement.parentElement);
  return {
    transform: cs.transform,
    tz: cs.getPropertyValue('--tz').trim(),
    sc: cs.getPropertyValue('--sc').trim(),
    perspective: frame.perspective,
  };
});
check('hover applies a 3D perspective', hoverState.perspective === '1400px', hoverState.perspective);
check('hover lifts the plate toward the viewer', hoverState.tz === '44px', `translateZ ${hoverState.tz}`);
check('hover scales the plate', hoverState.sc === '1.035', `scale ${hoverState.sc}`);
check('hover produces a 3D matrix', hoverState.transform.startsWith('matrix3d'), hoverState.transform.slice(0, 40));

// Off-centre pointer tilts; a centred one does not.
await target.hover({ position: { x: 8, y: 8 } });
await mpage.waitForTimeout(500);
const tilted = await target.locator('img').evaluate((el) => ({
  rx: parseFloat(getComputedStyle(el).getPropertyValue('--rx')),
  ry: parseFloat(getComputedStyle(el).getPropertyValue('--ry')),
}));
check('off-centre pointer tilts the plate', Math.abs(tilted.ry) > 3, `ry ${tilted.ry.toFixed(2)}deg rx ${tilted.rx.toFixed(2)}deg`);

// Leaving resets it.
await mpage.mouse.move(2, 2);
await mpage.waitForTimeout(500);
const relaxed = await target.locator('img').evaluate((el) => ({
  tz: getComputedStyle(el).getPropertyValue('--tz').trim(),
  ry: getComputedStyle(el).getPropertyValue('--ry').trim(),
}));
check('pointer leaving resets the plate', relaxed.tz === '' && relaxed.ry === '', JSON.stringify(relaxed));
await motion.close();

// ---- reduced motion suppresses the effect entirely ----
const calm = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
});
const cpage = await calm.newPage();
await cpage.goto(`${BASE}/work/imbirt`, { waitUntil: 'networkidle' });
const ctarget = cpage.locator('[data-plate-trigger]').first();
await ctarget.scrollIntoViewIfNeeded();
await ctarget.hover();
await cpage.waitForTimeout(400);
const calmTransform = await ctarget.locator('img').evaluate((el) => getComputedStyle(el).transform);
check('reduced motion suppresses the 3D lift', calmTransform === 'none', calmTransform.slice(0, 30));
await calm.close();

// ---- the plates on the home page too ----
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
const homeCount = await page.locator('[data-plate-trigger]').count();
check('home page plates are wired', homeCount >= 1, `${homeCount} triggers`);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length === 0 ? 0 : 1);
