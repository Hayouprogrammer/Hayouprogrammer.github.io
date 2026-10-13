/**
 * browser.mjs — resolve a Chromium to drive, once, for every verification
 * script in this repo.
 *
 * The scripts used to hardcode a versioned path
 * (`ms-playwright/chromium-1247/chrome-win64/chrome.exe`). That path is
 * rewritten by every Playwright upgrade and by every rebuild of the machine, so
 * the verification suite broke in a way that looked like a browser problem and
 * was really a stale constant. Now the cache is globbed, and the versions are
 * whatever happens to be installed.
 *
 * Falls back to Playwright's own resolution when nothing is found, which is the
 * right default: `chromium.launch()` with an undefined executablePath looks in
 * the same place `npx playwright install` writes to.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const CACHE = process.env.PLAYWRIGHT_BROWSERS_PATH ?? join(homedir(), 'AppData', 'Local', 'ms-playwright');

const CANDIDATES = [
  // Full Chromium, when installed.
  'chromium-*/chrome-win64/chrome.exe',
  // Headless shell, the default for `npx playwright install chromium`.
  'chromium_headless_shell-*/chrome-headless-shell-win64/chrome-headless-shell.exe',
  // Chrome for Testing, when downloaded from the Google mirror directly.
  'chromium-*/chrome-linux/chrome',
  'chromium-*/chrome-mac/Chromium.app/Contents/MacOS/Chromium',
];

function findIn(dir) {
  for (const rel of CANDIDATES) {
    // Glob is shallow on purpose: one level of version directory.
    const [head, ...rest] = rel.split('/');
    if (!head.includes('*')) {
      const p = join(dir, rel);
      if (existsSync(p)) return p;
      continue;
    }
    const [prefix, suffix] = head.split('*');
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return undefined;
    }
    const versions = entries
      .filter((e) => e.isDirectory() && e.name.startsWith(prefix) && e.name.endsWith(suffix ?? ''))
      .map((e) => e.name)
      // Highest version last: readdir is alphabetical, so sort descending and
      // take the last match to prefer the newest build.
      .sort();
    for (const version of [...versions].reverse()) {
      const p = join(dir, version, ...rest);
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

/**
 * @returns {string | undefined} A path to a Chromium executable, or undefined
 * to let Playwright resolve its own install.
 */
export function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  return findIn(CACHE);
}

/** Launch options every verification script shares. */
export function launchOptions(extra = {}) {
  return { executablePath: resolveChromium(), ...extra };
}
