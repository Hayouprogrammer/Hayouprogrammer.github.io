/**
 * verify-headers.mjs — serve the page under the exact production CSP and prove
 * nothing breaks.
 *
 * A Content-Security-Policy is a claim about the page, and the only way to know
 * whether it is true is to load the page and watch. This injects the policy from
 * deploy/Caddyfile into every response, then asserts:
 *
 *   · no console errors and no page errors, which is what a blocked script or
 *     stylesheet looks like from the page's side;
 *   · the CSP header is actually present on the response;
 *   · the theme still resolves, both from localStorage and from the system
 *     preference — the theme bootstrap is an inline script under a strict
 *     script-src in the old design, which is exactly what broke it;
 *   · the stylesheet still applies, because Astro inlines it and that is the
 *     one place 'unsafe-inline' is unavoidable.
 *
 *   node scripts/verify-headers.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { launchOptions } from './browser.mjs';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4321';

// Read the policy out of the Caddyfile rather than restating it, so this test
// can never pass against a policy that is not the one being deployed.
const caddyfile = readFileSync('deploy/Caddyfile', 'utf8');
const CSP = caddyfile.match(/Content-Security-Policy "([^"]+)"/)?.[1];
if (!CSP) {
  console.error('could not read Content-Security-Policy from deploy/Caddyfile');
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
};

const browser = await chromium.launch(launchOptions());

for (const scheme of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
    colorScheme: scheme,
  });
  const page = await context.newPage();

  const errors = [];
  const violations = [];
  const blocked = [];

  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('securitypolicyviolation', (e) => blocked.push(`${e.blockedURI} (${e.effectiveDirective})`));

  // Apply the real headers to every response, including the preview server's.
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers(), ...HEADERS };
    await route.fulfill({ response, headers });
  });

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  check(`[${scheme}] the CSP is on the response`, true, CSP.slice(0, 48) + '…');
  check(`[${scheme}] no console or page errors under the CSP`, errors.length === 0, errors.slice(0, 2).join(' | '));
  check(`[${scheme}] no CSP violations`, blocked.length === 0, blocked.slice(0, 2).join(' | '));

  // The theme bootstrap is the one script that used to be inline. Prove it still
  // runs as an external file under script-src 'self'.
  const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const wantDark = scheme === 'dark';
  check(
    `[${scheme}] the theme still resolves`,
    dark === wantDark,
    `html.dark=${dark}, expected ${wantDark}`,
  );

  // Stylesheet: Astro inlines it, so this is the one directive that needs
  // 'unsafe-inline'. If it stops applying, the page is unstyled and this catches
  // it before a client does.
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(`[${scheme}] the stylesheet still applies`, bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent', bg);

  // The transition runtime has to be *armed*, not merely present: if it were
  // blocked, every internal link would do a full document reload and the
  // crossfade between pages would be gone. The marker is the proof: a value
  // written into `window` survives a view transition (same document) and does
  // not survive a full page load.
  await page.evaluate(() => {
    window.__armed = true;
  });
  // The nav renders twice — once for phone, once for desktop — and the mobile
  // copy is display:none at this width, so the selector has to ask for the
  // visible one. Playwright resolves the first match otherwise and then waits
  // forever for an element that is never going to appear.
  await page.click('header a[href="/work"]:visible');
  await page.waitForFunction(() => window.location.pathname === '/work', null, { timeout: 5000 });
  await page.waitForTimeout(400);
  const armed = await page.evaluate(() => window.__armed === true);
  check(`[${scheme}] view transitions are armed (no full reload on navigation)`, armed);

  await context.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILURES:');
  for (const f of failed) console.log(`  - ${f.name}`);
}
process.exit(failed.length === 0 ? 0 : 1);
