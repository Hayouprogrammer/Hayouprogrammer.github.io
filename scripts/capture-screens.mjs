// Imbirt ERP - portfolio screenshot capture.
//   control plane (imbirt_ops):  login, tenant-ops-tenants, tenant-provision, apps-picker
//   hospitality tenant (t_skyline_hotel):  hotel-frontdesk, housekeeping, pos, dashboard, mobile-dashboard
//   property tenant (t_adama_properties):  property-portfolio, lease, report-rent-roll
// The backend SPA is served under /imbirt and deep-link menu URLs fall back to the
// console, so navigation is by CLICKING the top-nav menus (honest UI driving).
// Run: NODE_PATH=C:\Users\hayel\AppData\Roaming\npm\node_modules node capture-screens.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const OUT = "C:/src/portfolio/public/screens";
const BASE = "http://localhost:8069";
const DB = "imbirt_ops";
const ADMIN = { login: "admin", password: process.env.ADMIN_PASSWORD || "" }; // set the dev admin pw via the documented command; never hardcode secrets
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Playwright's bundled browsers get upgraded under us; fall back to the newest
// chromium actually present on disk.
function resolveExecutable() {
  const root = path.join(process.env.LOCALAPPDATA, "ms-playwright");
  try {
    const dirs = fs
      .readdirSync(root)
      .filter((d) => /^chromium-\d+$/.test(d) || /^chromium_headless_shell-\d+$/.test(d))
      .sort((a, b) => parseInt(b.split("-").pop(), 10) - parseInt(a.split("-").pop(), 10));
    for (const dir of dirs) {
      for (const rel of ["chrome-win64/chrome.exe", "chrome-headless-shell-win64/chrome-headless-shell.exe"]) {
        const p = path.join(root, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  } catch {}
  return undefined;
}
async function launchBrowser() {
  const executablePath = resolveExecutable();
  if (executablePath) {
    try {
      return await chromium.launch({ headless: true, executablePath });
    } catch (e) {
      log("launch with explicit chromium failed, falling back to bundled:", String(e).split("\n")[0]);
    }
  }
  return chromium.launch({ headless: true });
}

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
async function screenReport(page) {
  return page.evaluate(() => {
    const txt = document.body.innerText || "";
    return {
      url: location.pathname + location.search,
      listRows: document.querySelectorAll(".o_data_row").length,
      kanban: document.querySelectorAll(".o_kanban_record").length,
      view: document.querySelector(".o_list_view") ? "list"
        : document.querySelector(".o_kanban_view") ? "kanban"
        : document.querySelector(".o_form_view") ? "form"
        : document.querySelector(".o_control_panel") ? "other" : "none",
      head: txt.replace(/\s+/g, " ").slice(0, 260),
    };
  }).catch(() => ({ url: "", listRows: 0, kanban: 0, view: "?", head: "" }));
}
async function shot(page, name, opts = {}) {
  await dismissOverlays(page);
  await settle(page, opts.settleMs ?? 1000);
  const file = `${OUT}/${name}`;
  await page.screenshot({ path: file, fullPage: !!opts.fullPage });
  const bytes = fs.statSync(file).size;
  const rep = await screenReport(page).catch(() => ({}));
  results.push({ name, bytes, view: rep.view || "?", rows: rep.listRows ?? 0, kanban: rep.kanban ?? 0, note: opts.note });
  log(`SHOT ${name} -> ${(bytes / 1024).toFixed(1)} KB | view=${rep.view} listRows=${rep.listRows} kanban=${rep.kanban} | ${rep.head || ""}`);
}
async function login(viewport, db = DB, creds = ADMIN) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ignoreHTTPSErrors: true, locale: "en-US" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/web/login?db=${db}`, { waitUntil: "domcontentloaded" });
  await page.fill("input#login", creds.login);
  await page.fill("input#password", creds.password);
  await page.click("button[type='submit'].btn-primary", { force: true });
  await page.waitForSelector(".o_main_navbar", { timeout: 90000 }).catch(() => {});
  await settle(page, 3000);
  return { ctx, page };
}

// The tenant login password is the throwaway one provisioning staged in
// /var/lib/odoo/tenant-passwords/tenant_<record-id>.pw; handed to this script
// via the environment only (never written to a file or logged).
// Skyline Hotel = tenant record 9, Adama Properties = tenant record 10.
const HOTEL_CREDS = { login: "admin", password: process.env.HOTEL_TENANT_ADMIN_PASSWORD || "" };
const PROP_CREDS = { login: "admin", password: process.env.PROPERTY_TENANT_ADMIN_PASSWORD || "" };

const visibleFirst = (loc) => loc.filter({ visible: true }).first();
async function openHomeMenu(page) {
  // desktop: the oi-apps button; narrow shell: the fa-bars toggle
  const btn = page.locator(".o_navbar_apps_menu button").first();
  if (await btn.isVisible().catch(() => false)) {
    await btn.click({ timeout: 25000 }).catch(() => {});
  } else {
    await page.locator("a.o_menu_toggle, .o_main_navbar .o_menu_toggle").first().click({ timeout: 25000 }).catch(() => {});
  }
  await settle(page, 1500);
}

async function openMenu(page, appLabel, sectionLabel, subLabel) {
  await openHomeMenu(page);
  const appItem = visibleFirst(
    page.locator(".dropdown-menu a, .o_menu_sections a").getByText(appLabel, { exact: true })
  );
  await appItem.click({ timeout: 25000 }).catch((e) => log(`  app ${appLabel} click failed:`, String(e).split("\n")[0]));
  await settle(page, 3000);
  const bar = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".o_main_navbar a, .o_main_navbar button.dropdown-toggle"))
      .map((a) => `${(a.textContent || "").trim()}${a.getAttribute("href") ? " :: " + a.getAttribute("href") : ""}`)
      .filter((s) => s.length > 3)
  ).catch(() => []);
  log(`  ${appLabel} bar: ${bar.slice(0, 12).join(" | ")}`);
  let target = subLabel;
  if (sectionLabel) {
    const sec = visibleFirst(
      page.locator(".o_main_navbar button.dropdown-toggle").getByText(sectionLabel, { exact: true })
    );
    if (await sec.count().catch(() => 0)) {
      await sec.click({ timeout: 25000 }).catch((e) => log("  section click failed:", String(e).split("\n")[0]));
      await settle(page, 1800);
    } else {
      // Odoo inlines a single-child section onto the app bar, so the submenu
      // is usually reachable directly; try the submenu name as well as a
      // root-level entry.
      log(`  section '${sectionLabel}' not on the bar, trying the submenu directly`);
      target = subLabel || sectionLabel;
    }
  }
  if (target) {
    const subItem = visibleFirst(
      page.locator(".dropdown-menu a, .o_main_navbar a, .o_menu_sections a").getByText(target, { exact: true })
    );
    const n = await subItem.count().catch(() => 0);
    log(`  sub '${target}' matches=${n}`);
    await subItem.click({ timeout: 25000 }).catch((e) => log("  sub click failed:", String(e).split("\n")[0]));
    await settle(page, 4000);
  }
}

const browser = await launchBrowser();

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

// ======================================================================
// TENANT VERTICALS (real provisioned tenant databases, seeded data)
// ======================================================================

// ---- hospitality tenant: Skyline Hotel (t_skyline_hotel) -------------
const HOTEL_DB = process.env.HOTEL_DB || "t_skyline_hotel";
const PROP_DB = process.env.PROPERTY_DB || "t_adama_properties";

// Direct action navigation: the exact URL the menu entry's own <a href> points
// at (e.g. /odoo/action-552 for Reservations), so it opens the identical Odoo
// view. Used only when a section of the app bar cannot be expanded by click.
async function openAction(page, db, actionId) {
  await page.goto(`${BASE}/imbirt/action-${actionId}?db=${db}`, { waitUntil: "domcontentloaded" }).catch(() => {});
  await settle(page, 5000);
}

// 14) hotel-frontdesk.png -> reservations list (Hotel Management > Reservations)
log("== hotel: reservations ==");
const hotel = await login({ width: 1600, height: 1000 }, HOTEL_DB, HOTEL_CREDS);
const hp = hotel.page;
await settle(hp, 2500);
await openMenu(hp, "Hotel Management", null, "Reservations");
await hp.waitForSelector(".o_list_view", { timeout: 40000 }).catch(() => {});
await settle(hp, 2500);
log(`  rows=${await hp.locator(".o_data_row").count().catch(() => 0)} hotelName=${await bodyHas(hp, "Skyline Hotel")}`);
await shot(hp, "hotel-frontdesk.png", { note: `rows=${await hp.locator(".o_data_row").count().catch(() => 0)}` });

// 15) housekeeping.png -> housekeeping board (checkout-triggered + inspected)
log("== hotel: housekeeping board ==");
await openMenu(hp, "Hotel Management", null, "Housekeeping");
await hp.waitForSelector(".o_kanban_view, .o_list_view", { timeout: 40000 }).catch(() => {});
await settle(hp, 3000);
log(`  needs_inspection=${await bodyHas(hp, "Needs Inspection")} todo=${await bodyHas(hp, "To Do")}`);
await shot(hp, "housekeeping.png", {
  note: `inspecting=${await bodyHas(hp, "Needs Inspection")}`,
});

// 16) pos.png -> white-labelled Point of Sale: the open F&B till's orders
log("== hotel: point of sale ==");
await openMenu(hp, "Point of Sale", "Orders", "Orders");
await hp.waitForSelector(".o_list_view", { timeout: 40000 }).catch(() => {});
await settle(hp, 3000);
log(`  pos rows=${await hp.locator(".o_data_row").count().catch(() => 0)}`);
await shot(hp, "pos.png", { note: `rows=${await hp.locator(".o_data_row").count().catch(() => 0)}` });

// 17) dashboard.png -> the TENANT executive dashboard (occupancy/collections/delinquency)
log("== hotel: tenant executive dashboard ==");
await openMenu(hp, "Properties", null, "Dashboard");
await hp.waitForSelector(".imbirt-exec, .ie-header", { timeout: 40000 }).catch(() => {});
await settle(hp, 3500);
const execTxt = await hp.locator("body").innerText().catch(() => "");
log(`  exec=${execTxt.includes("Executive Overview")} occupancy=${execTxt.includes("Occupancy")} collected=${execTxt.includes("Collected this month")}`);
await shot(hp, "dashboard.png", {
  note: `exec=${execTxt.includes("Executive Overview")} occupancy=${execTxt.includes("Occupancy")}`,
});

// 18) mobile-dashboard.png -> same tenant dashboard at 420x900
log("== hotel: tenant dashboard (mobile) ==");
const mhotel = await login({ width: 420, height: 900 }, HOTEL_DB, HOTEL_CREDS);
const mhp = mhotel.page;
await settle(mhp, 3500);
await openMenu(mhp, "Properties", null, "Dashboard");
await mhp.waitForSelector(".imbirt-exec, .ie-header", { timeout: 30000 }).catch(() => {});
if (!(await bodyHas(mhp, "Executive Overview"))) {
  // the narrow shell keeps the app list in a drawer that Playwright cannot
  // open; the Properties > Dashboard action URL is the same route the menu's
  // own <a href> points at.
  log("  narrow shell menu did not open, opening Properties > Dashboard directly");
  await openAction(mhp, HOTEL_DB, 573);
}
await mhp.waitForSelector(".imbirt-exec, .ie-header", { timeout: 60000 }).catch(() => {});
await settle(mhp, 5000);
log(`  mobile exec=${await bodyHas(mhp, "Executive Overview")}`);
await shot(mhp, "mobile-dashboard.png", { settleMs: 2000 });
await mhotel.ctx.close();

// ---- property tenant: Adama Properties (t_adama_properties) ----------
// 19) property-portfolio.png -> units list / kanban
log("== property: portfolio ==");
const prop = await login({ width: 1600, height: 1000 }, PROP_DB, PROP_CREDS);
const pp = prop.page;
await settle(pp, 3000);
await openMenu(pp, "Properties", null, "Portfolio");
await pp.waitForSelector(".o_list_view, .o_kanban_view", { timeout: 40000 }).catch(() => {});
await settle(pp, 3000);
log(`  units=${await pp.locator(".o_data_row, .o_kanban_record").count().catch(() => 0)} kazanchis=${await bodyHas(pp, "Kazanchis")}`);
await shot(pp, "property-portfolio.png", {
  note: `units=${await pp.locator(".o_data_row, .o_kanban_record").count().catch(() => 0)}`,
});

// 20) lease.png -> a lease contract form showing its rent schedule
log("== property: lease form ==");
await openMenu(pp, "Properties", "Leasing", "Leases");
let leaseRows = await pp.locator(".o_data_row").count().catch(() => 0);
if (!leaseRows) {
  // the Leasing section of the app bar cannot be expanded by click; fall back
  // to the action URL the menu entry itself points at (imbirt_lease.action_pms_lease)
  log("  lease list empty, opening imbirt_lease.action_pms_lease directly");
  await openAction(pp, PROP_DB, 406);
}
await pp.waitForSelector(".o_list_view", { timeout: 40000 }).catch(() => {});
await settle(pp, 3000);
leaseRows = await pp.locator(".o_data_row").count().catch(() => 0);
try {
  await pp.locator(".o_data_row").first().dblclick({ timeout: 25000 });
} catch (e) { log("  dblclick failed:", String(e).split("\n")[0]); }
await pp.waitForSelector(".o_form_view", { timeout: 40000 }).catch(() => {});
await settle(pp, 3000);
// the rent schedule lives on its own notebook tab
const schedTab = visibleFirst(
  pp.locator(".o_notebook .nav-link, .o_notebook a").getByText("Rent Schedule", { exact: true })
);
if (await schedTab.count().catch(() => 0)) {
  await schedTab.click({ timeout: 20000 }).catch(() => {});
  await settle(pp, 2500);
}
const schedCells = await pp.locator("td.o_data_cell").count().catch(() => 0);
log(`  rentSchedule=${await bodyHas(pp, "Rent Schedule")} cells=${schedCells} rows=${leaseRows}`);
if (!(await bodyHas(pp, "Rent Schedule"))) {
  log("  lease form did not open, falling back to the lease list action");
  await openAction(pp, PROP_DB, 406);
  await pp.waitForSelector(".o_list_view", { timeout: 40000 }).catch(() => {});
  await settle(pp, 3000);
  try {
    await pp.locator(".o_data_row").first().dblclick({ timeout: 25000 });
    await pp.waitForSelector(".o_form_view", { timeout: 30000 }).catch(() => {});
    await settle(pp, 3000);
  } catch (e) { log("  dblclick retry failed:", String(e).split("\n")[0]); }
}
await shot(pp, "lease.png", { note: `schedule=${await bodyHas(pp, "Rent Schedule")}` });

// 21) report-rent-roll.png -> the rent roll report
log("== property: rent roll ==");
await openMenu(pp, "Properties", "Reporting", "Rent Roll");
await pp.waitForSelector(".o_list_view", { timeout: 40000 }).catch(() => {});
await settle(pp, 3500);
log(`  rentroll rows=${await pp.locator(".o_data_row").count().catch(() => 0)} dueNow=${await bodyHas(pp, "Due Now")}`);
await shot(pp, "report-rent-roll.png", {
  note: `rows=${await pp.locator(".o_data_row").count().catch(() => 0)}`,
});

await hotel.ctx.close();
await prop.ctx.close();
await browser.close();
log("== SUMMARY ==");
for (const r of results) console.log(`${r.name}\t${r.bytes}\t${r.view}\t${r.rows}\t${r.kanban}\t${r.note ?? ""}`);
