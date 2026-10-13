/**
 * audit.mjs — build-time quality gate for the portfolio.
 *
 *   node scripts/audit.mjs            # desktop + mobile, a11y, console, timing
 *   node scripts/audit.mjs --quick    # skip full-page captures (faster loop)
 *
 * Requires the production build to be running:
 *   npx astro build && npx astro preview --port 4321
 */
import { chromium } from 'playwright';
import axe from 'axe-core';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REVIEW = join(ROOT, '.impeccable', 'review');
const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:4321';
const QUICK = process.argv.includes('--quick');

const ROUTES = [
  { path: '/', name: 'home' },
  { path: '/work/imbirt', name: 'imbirt' },
  { path: '/work', name: 'work' },
  { path: '/about', name: 'about' },
  { path: '/contact', name: 'contact' },
  { path: '/cv', name: 'cv' },
];

import { resolveChromium } from './browser.mjs';

mkdirSync(REVIEW, { recursive: true });

/**
 * Wait for every image on the page to finish decoding. Full-page captures
 * expand the viewport, which triggers lazy loads mid-flight; without this the
 * captures show empty plates and the audit lies about the build.
 *
 * Bounded: an image that already errored before the listener attached would
 * otherwise never resolve, and the whole audit would hang.
 */
async function settleImages(page, budgetMs = 12000) {
  // Walk the page first. A `loading="lazy"` image below the fold never starts
  // fetching until the browser decides it is near the viewport, and a
  // beyond-viewport capture does not scroll — so without this pass the plates
  // come back blank and the audit lies about the build.
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight * 0.8);
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });

  await page.evaluate(async (budget) => {
    const deadline = Date.now() + budget;
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise((resolve) => {
              const done = () => resolve();
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
              // Belt and braces: never block the run on one stubborn asset.
              setTimeout(done, Math.max(0, deadline - Date.now()));
            }),
      ),
    );
    // Let the decoder catch up before the pixel capture.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }, budgetMs);
}

const results = [];
const problems = [];

const browser = await chromium.launch({
  executablePath: resolveChromium(),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const consoleErrors = [];
    const failedRequests = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('requestfailed', (r) => failedRequests.push(`${r.url()} — ${r.failure()?.errorText}`));
    page.on('response', (r) => {
      if (r.status() >= 400) failedRequests.push(`${r.url()} — HTTP ${r.status()}`);
    });

    const started = Date.now();
    await page.goto(BASE + route.path, { waitUntil: 'networkidle' });
    const loadMs = Date.now() - started;

    // ---- axe accessibility ----
    await page.evaluate(axe.source);
    const axeResult = await page.evaluate(async () => {
      // @ts-ignore
      return window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      });
    });
    const violations = (axeResult.violations ?? []).map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length,
      sample: v.nodes[0]?.html?.slice(0, 120) ?? '',
    }));

    // ---- overflow / horizontal scroll ----
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const offenders = [];
      if (de.scrollWidth > de.clientWidth + 1) {
        for (const el of document.querySelectorAll('*')) {
          const r = el.getBoundingClientRect();
          if (r.right > de.clientWidth + 2 && r.width > 0) {
            offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 60)}`);
          }
        }
      }
      return { has: de.scrollWidth > de.clientWidth + 1, offenders: offenders.slice(0, 6) };
    });

    if (scheme === 'light') {
      const shot = join(REVIEW, `${route.name}-desktop.png`);
      if (!QUICK) {
        await settleImages(page);
        await page.screenshot({ path: shot, fullPage: true });
      }
      results.push({ route: route.name, scheme, loadMs, violations, overflow, consoleErrors, failedRequests, shot });
    } else {
      const shot = join(REVIEW, `${route.name}-dark.png`);
      if (!QUICK) {
        await settleImages(page);
        await page.screenshot({ path: shot, fullPage: true });
      }
      results.push({ route: route.name, scheme, loadMs, violations, overflow, consoleErrors, failedRequests, shot });
    }

    if (violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length) {
      problems.push(`${route.path} [${scheme}] ${violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length} serious/critical a11y violations`);
    }
    if (overflow.has) problems.push(`${route.path} [${scheme}] horizontal overflow: ${overflow.offenders.join(' | ')}`);
    if (consoleErrors.length) problems.push(`${route.path} [${scheme}] console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    if (failedRequests.length) problems.push(`${route.path} [${scheme}] failed requests: ${failedRequests.slice(0, 3).join(' | ')}`);

    await page.close();
  }

  await context.close();
}

// ---- mobile pass (light only, one page is enough for overflow/a11y) ----
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  for (const route of ROUTES) {
    const page = await context.newPage();
    await page.goto(BASE + route.path, { waitUntil: 'networkidle' });
    await page.evaluate(axe.source);
    const r = await page.evaluate(async () => {
      // @ts-ignore
      return window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    });
    const violations = (r.violations ?? []).map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }));
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const offenders = [];
      if (de.scrollWidth > de.clientWidth + 1) {
        for (const el of document.querySelectorAll('*')) {
          const b = el.getBoundingClientRect();
          if (b.right > de.clientWidth + 2 && b.width > 0) offenders.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().slice(0, 50)}`);
        }
      }
      return { has: de.scrollWidth > de.clientWidth + 1, offenders: offenders.slice(0, 6) };
    });
    const shot = join(REVIEW, `${route.name}-mobile.png`);
    if (!QUICK) {
      await settleImages(page);
      await page.screenshot({ path: shot, fullPage: true });
    }
    results.push({ route: route.name, scheme: 'mobile', violations, overflow, shot });
    if (violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length)
      problems.push(`${route.path} [mobile] ${violations.filter((v) => v.impact === 'critical' || v.impact === 'serious').length} serious/critical a11y violations`);
    if (overflow.has) problems.push(`${route.path} [mobile] horizontal overflow: ${overflow.offenders.join(' | ')}`);
    await page.close();
  }
  await context.close();
}

await browser.close();

// ---- report ----
console.log('\n================ AUDIT REPORT ================\n');
for (const r of results) {
  const v = r.violations ?? [];
  const crit = v.filter((x) => x.impact === 'critical' || x.impact === 'serious');
  const line = [
    `${r.route.padEnd(10)} ${r.scheme.padEnd(6)}`,
    `load=${String(r.loadMs ?? '—').padStart(5)}ms`,
    `a11y=${String(v.length).padStart(2)} (crit ${crit.length})`,
    `overflow=${r.overflow?.has ? 'YES' : 'no'}`,
    `consoleErr=${(r.consoleErrors ?? []).length}`,
    `reqFailed=${(r.failedRequests ?? []).length}`,
  ].join('  ');
  console.log(line);
  for (const x of crit) console.log(`      ! ${x.impact} ${x.id} (${x.nodes} nodes) ${x.sample ?? ''}`);
}

console.log(`\n${problems.length === 0 ? 'PASS — no blocking problems' : `${problems.length} PROBLEM(S):`}`);
for (const p of problems) console.log(`  - ${p}`);

const summary = { results, problems };
writeFileSync(join(REVIEW, 'audit.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`\nscreens + report written to ${REVIEW}`);
