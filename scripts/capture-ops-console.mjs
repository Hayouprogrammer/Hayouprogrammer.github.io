/**
 * capture-ops-console.mjs — the control-plane operations console as a plate.
 *
 * The tenant dashboard overwrote `dashboard.png`, so the fleet console needed
 * its own capture. This drives the control-plane database (`imbirt_ops`) and
 * writes `public/screens/ops-console.png`.
 *
 *   $env:ADMIN_PASSWORD="..." ; node scripts/capture-ops-console.mjs
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'screens');
const URL = process.env.OPS_URL ?? 'http://localhost:8069';
const ADMIN = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_PW ?? 'Portfolio2026!';

mkdirSync(OUT, { recursive: true });

import { launchOptions } from './browser.mjs';

const browser = await chromium.launch(launchOptions());
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
});

await page.goto(`${URL}/web/login?db=imbirt_ops`, { waitUntil: 'domcontentloaded' });
await page.fill('input[name="login"]', 'admin');
await page.fill('input[name="password"]', ADMIN);
await page.click('button[type="submit"]');
await page.waitForLoadState('networkidle');

// The Ops home action is the console: overview, needs-attention, health.
await page.goto(`${URL}/odoo/imbirt-tenant-ops`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.o_control_panel, .o_content', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);

await page.screenshot({ path: join(OUT, 'ops-console.png') });
console.log('wrote public/screens/ops-console.png');

await browser.close();
