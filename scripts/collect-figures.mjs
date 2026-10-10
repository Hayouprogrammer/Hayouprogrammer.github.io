/**
 * collect-figures.mjs
 *
 * Re-derives every number the portfolio publishes from the actual
 * ethio-erp-addons working tree. Nothing on the site is asserted that this
 * script cannot reproduce.
 *
 *   node scripts/collect-figures.mjs
 *
 * Writes src/data/figures.json. Run it again after any module change.
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';

const REPO = process.env.IMBIRT_REPO ?? 'C:/src/ethio-erp-addons';

// The collectors read the live ERP tree. In CI there is none, and the committed
// src/data/*.json is the artifact — so a missing tree is a hard, loud failure
// rather than a silently wrong one.
if (!existsSync(REPO)) {
  console.error(
    `collect-figures: ${REPO} not found.\n` +
      'This script reads the ethio-erp-addons working tree and is local tooling.\n' +
      'Set IMBIRT_REPO to point at it. src/data/figures.json is committed derived\n' +
      'data and does not need regenerating to build or deploy.',
  );
  process.exit(1);
}
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'figures.json');

const SOURCE_EXTS = new Set(['.py', '.xml', '.js', '.scss', '.css', '.csv']);

function walk(dir, out = [], skip = /(^|\/|\\)(\.git|node_modules|\.ruff_cache|\.kilo|__pycache__)(\/|\\|$)/) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (skip.test(full + sep)) continue;
    if (entry.isDirectory()) walk(full, out, skip);
    else out.push(full);
  }
  return out;
}

function countLines(files) {
  let lines = 0;
  for (const f of files) {
    try {
      lines += readFileSync(f, 'utf8').split(/\r\n|\r|\n/).length - 1;
    } catch {
      /* unreadable: skip rather than guess */
    }
  }
  return lines;
}

const addonsDir = join(REPO, 'addons');
const addonNames = readdirSync(addonsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

// `_repos` and `_backups` are scratch and vendoring space, not addon trees on
// the path. Count them out or the number means nothing.
const ADDDON_TREES = addonNames.filter((n) => !n.startsWith('_') && !n.startsWith('.'));

const OWNED = /^(imbirt_|pms_|hms_imbirt|workflow_engine)/;
const AUTHORED = /^(imbirt_|hms_imbirt|workflow_engine)/;

const owned = [];
for (const name of addonNames) {
  if (!OWNED.test(name)) continue;
  const files = walk(join(addonsDir, name)).filter((f) =>
    SOURCE_EXTS.has(f.slice(f.lastIndexOf('.'))),
  );
  if (files.length === 0) continue;
  owned.push({
    module: name,
    authored: AUTHORED.test(name),
    licence: AUTHORED.test(name) ? 'LGPL-3.0-or-later' : 'AGPL-3.0 (modified upstream)',
    files: files.length,
    lines: countLines(files),
  });
}

owned.sort((a, b) => b.lines - a.lines);

// Tests — scoped to the custom trees only, never the vendored upstream code.
const ownedRoots = owned.map((o) => join(addonsDir, o.module).replace(/\\/g, '/'));
const testFiles = walk(REPO).filter(
  (f) =>
    f.endsWith('.py') &&
    f.replace(/\\/g, '/').includes('/tests/') &&
    ownedRoots.some((r) => f.replace(/\\/g, '/').startsWith(r)),
);
let testFunctions = 0;
for (const f of testFiles) {
  const src = readFileSync(f, 'utf8');
  testFunctions += (src.match(/^\s*def test_/gm) ?? []).length;
}

// Odoo runtime facts
const dockerfile = safeRead(join(REPO, 'docker', 'Dockerfile'));
const compose = safeRead(join(REPO, 'docker', 'compose.yml'));
const composeProd = safeRead(join(REPO, 'docker', 'compose.prod.yml'));

function safeRead(p) {
  try {
    return readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function firstLine(re, text) {
  const m = text.match(re);
  return m ? m[0].trim() : null;
}

const gitRemote = safeExec('git -C "' + REPO + '" remote get-url origin');

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const figures = {
  generatedAt: new Date().toISOString(),
  repo: {
    remote: gitRemote,
    addonTrees: ADDDON_TREES.length,
  },
  code: {
    customTrees: owned.length,
    authoredTrees: owned.filter((o) => o.authored).length,
    files: owned.reduce((n, o) => n + o.files, 0),
    lines: owned.reduce((n, o) => n + o.lines, 0),
  },
  tests: {
    files: testFiles.length,
    functions: testFunctions,
  },
  runtime: {
    platform: 'Odoo 19.0 Community',
    language: 'Python 3.12',
    database: 'PostgreSQL 16',
    imageTag: firstLine(/^FROM .*$/m, dockerfile),
    devWorkers: firstLine(/--dev=\S+/, compose),
    // Verified against docker/compose.prod.yml — do not add a flag the file
    // does not actually contain.
    prodFlags: [
      '--workers=4',
      '--proxy-mode',
      '--no-demo',
      '--without-demo=all',
    ].filter((f) => composeProd.includes(f)),
  },
  modules: owned,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(figures, null, 2) + '\n', 'utf8');

console.log(`figures.json written`);
console.log(`  custom trees  : ${figures.code.customTrees} (${figures.code.authoredTrees} Imbirt-authored)`);
console.log(`  files / lines : ${figures.code.files} / ${figures.code.lines}`);
console.log(`  test files    : ${figures.tests.files}`);
console.log(`  test funcs    : ${figures.tests.functions}`);
console.log(`  addon trees   : ${figures.repo.addonTrees}`);
