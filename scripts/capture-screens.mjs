// Imbirt ERP - real control-plane screenshot capture (portfolio). 1600x1000 @ dsf2 (mobile 420x900 @ dsf2).
// The backend SPA is served under /imbirt and deep-link menu URLs fall back to the
// console, so navigation is by CLICKING the top-nav menus (honest UI driving).
// Run: NODE_PATH=C:\Users\hayel\AppData\Roaming\npm\node_modules node capture-screens.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const OUT = "C:/src/portfolio/public/screens";
const BASE = "http://localhost:8069";
const DB = "imbirt_ops";
const ADMIN = { login: "admin", password: process.env.ADMIN_PASSWORD || "" }; // set the dev admin pw via the documented command; never hardcode secrets
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function dismissOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => document.querySelectorAll(".o_tour,.o_onboarding,.o_tutorial_pos,.o_command_palette,el_tour").forEach((e) => e.remove())).catch(() => {});
}
async function settle(page, ms = 900) { await page.waitForTimeout(ms); }
async function bodyHas(page, n) { return ((await page.locator("body").innerText().catch(() => "")) || "").includes(n); }
async function clickMenu(page, label) {
  const nav = page.locator(".o_main_navbar");
  await nav.getByText(label, { exact: true }).first().click({ timeout: 15000 })
    .catch(() => page.getByText(label, { exact: true }).first().click({ timeout: 8000 }).catch(() => {}));
  await settle(page, 2000);
}
async function shot(page, name, opts = {}) {
  await dismissOverlays(page);
  await settle(page, opts.settleMs ?? 1000);
  const file = `${OUT}/${name}`;
  await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  const bytes = fs.statSync(file).size;
  results.push({ name, bytes, ...(opts.note ? { note: opts.note } : {}) });
  log(`SHOT ${name} -> ${(bytes / 1024).toFixed(1)} KB ${opts.note ? "| " + opts.note : ""}`);
}
async function login(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ignoreHTTPSErrors: true, locale: "en-US" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/web/login?db=${DB}`, { waitUntil: "domcontentloaded" });
  await page.fill("input#login", ADMIN.login);
  await page.fill("input#password", ADMIN.password);
  await page.click("button[type='submit'].btn-primary", { force: true });
  await page.waitForSelector(".o_main_navbar", { timeout: 90000 }).catch(() => {});
  await settle(page, 2500);
  return { ctx, page };
}

const browser = await chromium.launch({ headless: true });

// 1) login.png (pre-auth, white-labelled) - fresh context, before logging in
log("== login ==");
const loginCtx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, locale: "en-US" });
const loginPage = await loginCtx.newPage();
await loginPage.goto(`${BASE}/web/login?db=${DB}`, { waitUntil: "domcontentloaded" });
await settle(loginPage, 1600);
log(`  'Powered by Imbirt'=${await bodyHas(loginPage, "Powered by Imbirt")}`);
await shot(loginPage, "login.png", { settleMs: 1200 });
await loginCtx.close();

// authenticated session
const { ctx, page } = await login({ width: 1600, height: 1000 });
log(`  authed url=${page.url().replace(BASE, "")}`);

// 2) tenant-ops-tenants.png -> Tenants list (standard list view)
log("== Tenants list ==");
await clickMenu(page, "Tenants");
await page.waitForSelector(".o_list_view", { timeout: 30000 }).catch(() => {});
await settle(page, 1500);
log(`  list visible=${await page.locator(".o_list_view").first().isVisible().catch(() => false)} merkato=${await bodyHas(page, "Merkato Negade")} console?${await bodyHas(page, "NEEDS ATTENTION")}`);
await shot(page, "tenant-ops-tenants.png");

// 3) tenant-provision.png -> Skyline Hotel draft form (Provision button + Draft badge)
log("== Skyline provision form ==");
await clickMenu(page, "Tenants");
await page.waitForSelector(".o_data_row").catch(() => {});
try {
  await page.locator(".o_data_row", { hasText: "Skyline Hotel" }).first().dblclick({ timeout: 20000 });
  await page.locator("button[name='action_provision']").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
} catch (e) { log("  dblclick failed:", String(e).split("\n")[0]); }
await settle(page, 1800);
const provVisible = await page.locator("button[name='action_provision']").first().isVisible().catch(() => false);
log(`  provision button=${provVisible}`);
await shot(page, "tenant-provision.png", { note: `provision_btn=${provVisible}` });

// 10) apps-picker.png -> Application Catalog (real, 28 apps)
log("== Application Catalog ==");
await clickMenu(page, "Application Catalog");
await settle(page, 1800);
log(`  'Hotel Management'=${await bodyHas(page, "Hotel Management")}`);
await shot(page, "apps-picker.png");

// 9) dashboard.png -> Imbirt Ops fleet console (home action, real fleet data)
log("== fleet console (dashboard) ==");
await clickMenu(page, "Dashboard");
await settle(page, 1800);
log(`  'NEEDS ATTENTION'=${await bodyHas(page, "NEEDS ATTENTION")}`);
await shot(page, "dashboard.png");

// 13) mobile-dashboard.png -> fleet console @ 420x900 (responsive shell)
log("== fleet console (mobile) ==");
const { ctx: mctx, page: mpage } = await login({ width: 420, height: 900 });
await settle(mpage, 2500);
if (!(await bodyHas(mpage, "NEEDS ATTENTION"))) {
  // try opening the app menu via hamburger then Dashboard
  await mpage.locator(".o_main_navbar .o_menu_toggle, .o-navbar-menu, button[aria-label*='menu' i]").first().click({ timeout: 8000 }).catch(() => {});
  await settle(mpage, 800);
  await mpage.getByText("Dashboard", { exact: true }).first().click({ timeout: 8000 }).catch(() => {});
  await settle(mpage, 1500);
}
log(`  mobile console=${await bodyHas(mpage, "NEEDS ATTENTION")} merkato=${await bodyHas(mpage, "Merkato")}`);
await shot(mpage, "mobile-dashboard.png", { settleMs: 1200 });

await browser.close();
log("== SUMMARY ==");
for (const r of results) console.log(`${r.name}\t${r.bytes}\t${r.note ?? ""}`);
