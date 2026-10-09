/**
 * prune-dist.mjs — keep the deploy output lean.
 *
 * public/screens/ holds the 3200px source captures; scripts/optimize-images.mjs
 * turns them into public/shots/ (WebP + JPEG). Nothing in the build references
 * /screens/, so shipping them would add ~1.4 MB of dead weight to every deploy
 * and duplicate the same pixels twice in the repository.
 *
 * Run as a post-build step. Safe to run when dist/ does not exist.
 */
import { rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (!existsSync(DIST)) {
  console.log('no dist/ to prune');
  process.exit(0);
}

const targets = [
  // Raw capture sources — never referenced by the built HTML.
  join(DIST, 'screens'),
];

let removed = 0;
for (const t of targets) {
  if (existsSync(t)) {
    rmSync(t, { recursive: true, force: true });
    removed++;
    console.log(`removed dist/${t.split(/[\\/]/).pop()}/`);
  }
}

if (removed === 0) console.log('nothing to prune');
