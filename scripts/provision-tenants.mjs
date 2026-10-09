// Imbirt ERP - drive the REAL Provision flow on the two vertical draft tenants
// (Skyline Hotel / hospitality, Adama Properties / property) from the control
// plane UI, capture the chatter notes + the state transition, and wait for the
// job worker to finish. Shares the conventions of capture-screens.mjs.
//
// Run: NODE_PATH=C:\Users\hayel\AppData\Roaming\npm\node_modules node provision-tenants.mjs
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

// Playwright's bundled browsers get upgraded under us; fall back to the newest
// chromium actually present on disk.
function resolveExecutable() {
  const root = path.join(process.env.LOCALAPPDATA, "ms-playwright");
  try {
    const candidates = fs
      .readdirSync(root)
      .filter((d) => /^chromium-\d+$/.test(d) || /^chromium_headless_shell-\d+$/.test(d))
      .sort((a, b) => parseInt(b.split("-").pop(), 10) - parseInt(a.split("-").pop(), 10));
    for (const dir of candidates) {
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
      log("launch with executablePath failed, falling back:", String(e).split("\n")[0]);
    }
  }
  return chromium.launch({ headless: true });
}

const OUT = "C:/src/portfolio/public/screens";
const BASE = "http://localhost:8069";
const DB = "imbirt_ops";
const ADMIN = { login: "admin", password: process.env.ADMIN_PASSWORD || "" };
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function dismissOverlays(page) {
  await page.keyboard.press("Escape").catch(() => {});
  await page.evaluate(() => document.querySelectorAll(".o_tour,.o_onboarding,.o_tutorial_pos,.o_command_palette,el_tour").forEach((e) => e.remove())).catch(() => {});
}
const settle = (page, ms = 900) => page.waitForTimeout(ms);
const bodyHas = async (page, n) => ((await page.locator("body").innerText().catch(() => "")) || "").includes(n);

async function clickMenu(page, label) {
  const nav = page.locator(".o_main_navbar");
  await nav.getByText(label, { exact: true }).first().click({ timeout: 20000 })
    .catch(() => page.getByText(label, { exact: true }).first().click({ timeout: 8000 }).catch(() => {}));
  await settle(page, 2000);
}

async function login(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ignoreHTTPSErrors: true, locale: "en-US" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`${BASE}/web/login?db=${DB}`, { waitUntil: "domcontentloaded" });
  await page.fill("input#login", ADMIN.login);
  await page.fill("input#password", ADMIN.password);
  await page.click("button[type='submit'].btn-primary", { force: true });
  await page.waitForSelector(".o_main_navbar", { timeout: 90000 }).catch(() => {});
  await settle(page, 3000);
  return { ctx, page };
}

async function readTenantForm(page) {
  return page.evaluate(() => {
    const badge = document.querySelector(".o_field_widget[name='state'] .badge, .o_field_widget[name='state'] .o_badge");
    let stateText = badge ? (badge.textContent || "").trim() : "";
    if (!stateText) {
      const sel = document.querySelector("select[name='state'], .o_field_widget[name='state']");
      if (sel) stateText = (sel.value || sel.textContent || "").trim();
    }
    const notes = Array.from(document.querySelectorAll(".o-mail-Message-body, .o_mail_thread_message_content"))
      .map((e) => (e.innerText || "").trim()).filter(Boolean);
    return { stateText, notes };
  }).catch(() => ({ stateText: "", notes: [] }));
}

const browser = await launchBrowser();
const { ctx, page } = await login({ width: 1600, height: 1000 });

const targets = (process.argv.slice(2).length ? process.argv.slice(2) : ["Skyline Hotel", "Adama Properties"]).map(
  (name) => ({ name, expectDb: "t_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_") })
);

for (const target of targets) {
  log(`== PROVISION ${target.name} ==`);
  await clickMenu(page, "Tenants");
  await page.waitForSelector(".o_data_row").catch(() => {});
  await settle(page, 1500);
  try {
    await page.locator(".o_data_row", { hasText: target.name }).first().dblclick({ timeout: 30000 });
  } catch (e) {
    log("  dblclick failed:", String(e).split("\n")[0]);
  }
  await settle(page, 2500);

  const before = await readTenantForm(page);
  log(`  before: state=${before.stateText}`);

  const headerBtns = await page.locator(".o_form_view header button, .o_statusbar_buttons button")
    .evaluateAll((els) => els.map((e) => e.getAttribute("name") + ":" + (e.innerText || "").trim() + ":" + (e.offsetParent === null ? "hidden" : "shown")))
    .catch(() => []);
  log(`  header buttons: ${JSON.stringify(headerBtns)}`);

  page.on("dialog", (d) => d.accept().catch(() => {}));
  const btn = page
    .locator("button[name='action_retry_provision'], button[name='action_provision']")
    .filter({ visible: true })
    .first();
  const visible = await btn.count().then((c) => c > 0).catch(() => false);
  log(`  visible provision/retry buttons=${visible}`);
  if (visible) {
    await btn.click({ timeout: 30000 });
    await settle(page, 3000);
    const toast = (await page.locator(".o_notification, .o_notification_manager .alert").allInnerTexts().catch(() => []))[0] || "";
    log(`  toast: ${toast.replace(/\s+/g, " ").slice(0, 200)}`);
    await dismissOverlays(page);
  } else {
    log("  !! no visible provision/retry button found");
  }

  // follow the job/tenant state until it settles
  const deadline = Date.now() + 45 * 60 * 1000;
  let last = "";
  let lastNote = "";
  while (Date.now() < deadline) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await settle(page, 2200);
    const form = await readTenantForm(page);
    last = form.stateText;
    const note = (form.notes || []).join(" | ").replace(/\s+/g, " ").slice(0, 200);
    if (note !== lastNote) {
      log(`  state=${form.stateText} notes=${note}`);
      lastNote = note;
    }
    if (["active", "archived", "suspended"].includes(form.stateText.toLowerCase())) break;
    if (form.stateText.toLowerCase() === "quarantined") break;
    await settle(page, 8000);
  }
  log(`  final state=${last}`);
  const after = await readTenantForm(page);
  log(`  chatter notes (${after.notes.length}):`);
  for (const n of after.notes.slice(0, 12)) log(`    * ${n.replace(/\s+/g, " ").slice(0, 300)}`);
  fs.writeFileSync(
    `C:/src/portfolio/public/screens/.chatter-${target.expectDb}.json`,
    JSON.stringify({ tenant: target.name, db: target.expectDb, state: after.stateText, notes: after.notes }, null, 2)
  );
  await page.screenshot({ path: `${OUT}/.provisioned-${target.expectDb}.png` });
}

await browser.close();
log("== DONE ==");
