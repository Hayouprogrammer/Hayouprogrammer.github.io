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

import { launchOptions } from './browser.mjs';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const browser = await chromium.launch(launchOptions());
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

// ---- hover: the loupe ----
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
await mpage.waitForTimeout(700);

// The spotlight, the ring and the rule are all driven by two custom properties
// the trigger writes on pointermove. What is asserted here is the *effect*, not
// the implementation: that a dim field opens, that it is centred on the cursor,
// that the engagement rule draws, and that the capture sharpens inside the
// spotlight. Those are the four things a reader actually sees.
const loupe = await target.evaluate((el) => {
  const lamp = el.querySelector('.plate-lamp');
  const ring = el.querySelector('.plate-ring');
  const rule = el.querySelector('.plate-rule');
  const img = el.querySelector('img');
  return {
    mx: el.style.getPropertyValue('--mx').trim(),
    my: el.style.getPropertyValue('--my').trim(),
    lampOpacity: lamp ? getComputedStyle(lamp).opacity : '',
    lampBg: lamp ? getComputedStyle(lamp).backgroundImage.slice(0, 24) : '',
    ringOpacity: ring ? getComputedStyle(ring).opacity : '',
    ringTop: ring ? getComputedStyle(ring).top : '',
    ruleTransform: rule ? getComputedStyle(rule).transform : '',
    imgFilter: img ? getComputedStyle(img).filter : '',
    lift: getComputedStyle(el).transform,
  };
});
check('hover opens the spotlight', loupe.lampOpacity === '1', loupe.lampOpacity);
check('spotlight is a radial hole in a dim field', loupe.lampBg.includes('radial-gradient'), loupe.lampBg);
check('the brass ring appears with it', loupe.ringOpacity === '1', loupe.ringOpacity);
// `hover()` parks the pointer at the element's centre, so the spotlight should
// be centred too. Parsed, not string-matched: the script writes the exact
// sub-pixel ratio, and `50.0000%` is not a value it can produce.
check(
  'the spotlight follows the cursor',
  Math.abs(parseFloat(loupe.mx) - 50) < 6 && Math.abs(parseFloat(loupe.my) - 50) < 6,
  `${loupe.mx}, ${loupe.my}`,
);
// The ring is positioned by the same two properties, so its centre must land on
// the cursor. Compared in pixels against the trigger's own box, because a
// computed `top` is always a resolved length and never the percentage set.
const ringCentre = await target.evaluate((el) => {
  const ring = el.querySelector('.plate-ring').getBoundingClientRect();
  const t = el.getBoundingClientRect();
  return { cx: ((ring.left + ring.right) / 2 - t.left) / t.width * 100,
           cy: ((ring.top + ring.bottom) / 2 - t.top) / t.height * 100 };
});
check(
  'the ring sits on the cursor',
  Math.abs(ringCentre.cx - 50) < 6 && Math.abs(ringCentre.cy - 50) < 6,
  `cx ${ringCentre.cx.toFixed(1)}% cy ${ringCentre.cy.toFixed(1)}%`,
);
check('the engagement rule draws across', loupe.ruleTransform.startsWith('matrix'), loupe.ruleTransform);
check('the capture sharpens inside the spotlight', loupe.imgFilter.includes('saturate'), loupe.imgFilter);
check('the plate lifts off the page', loupe.lift.startsWith('matrix') && loupe.lift !== 'none', loupe.lift.slice(0, 30));

// Off-centre, the spotlight moves with the pointer rather than staying put.
const box = await target.boundingBox();
await mpage.mouse.move(box.x + box.width * 0.22, box.y + box.height * 0.7);
await mpage.waitForTimeout(400);
const off = await target.evaluate((el) => ({
  mx: parseFloat(el.style.getPropertyValue('--mx')),
  my: parseFloat(el.style.getPropertyValue('--my')),
}));
check(
  'an off-centre pointer moves the spotlight',
  off.mx > 15 && off.mx < 32 && off.my > 60 && off.my < 80,
  `mx ${off.mx.toFixed(1)}% my ${off.my.toFixed(1)}%`,
);

// Leaving resets it.
await mpage.mouse.move(2, 2);
await mpage.waitForTimeout(500);
const relaxed = await target.evaluate((el) => ({
  mx: el.style.getPropertyValue('--mx').trim(),
  lamp: getComputedStyle(el.querySelector('.plate-lamp')).opacity,
}));
check('pointer leaving closes the spotlight', relaxed.mx === '' && relaxed.lamp === '0', JSON.stringify(relaxed));
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
const calmLamp = await ctarget.evaluate((el) => ({
  lamp: getComputedStyle(el.querySelector('.plate-lamp')).opacity,
  ring: getComputedStyle(el.querySelector('.plate-ring')).opacity,
  lift: getComputedStyle(el).transform,
}));
check(
  'reduced motion suppresses the spotlight and the lift',
  calmLamp.lamp === '0' && calmLamp.ring === '0' && calmLamp.lift === 'none',
  JSON.stringify(calmLamp),
);
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
