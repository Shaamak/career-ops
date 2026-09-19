/**
 * updater-local-overlay.test.mjs — coverage for the local overlay declaration file (#4326).
 *
 * Verifies that the system overlay configuration correctly parses, validates, and
 * rejects improper paths, similar to updater-local-paths.test.mjs but for system files.
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { pass, fail } from './helpers.mjs';
import {
  LOCAL_OVERLAY_FILE,
  LOCAL_PATHS_FILE,
  localOverlayPaths
} from '../update-system.mjs';

function makeRoot(contents) {
  const dir = mkdtempSync(join(tmpdir(), 'co-local-overlay-'));
  if (contents !== undefined) {
    mkdirSync(join(dir, 'config'), { recursive: true });
    writeFileSync(join(dir, LOCAL_OVERLAY_FILE), contents);
  }
  return dir;
}

const roots = [];
function root(contents) {
  const dir = makeRoot(contents);
  roots.push(dir);
  return dir;
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\n🧪 Local system overlay declaration file (#4326)\n');

// ── 1. Absent file is a no-op ──
{
  const got = localOverlayPaths(root(undefined));
  if (eq(got, [])) {
    pass('no overlay declaration file → no overlay paths');
  } else {
    fail(`#1 absent file returned ${JSON.stringify(got)}`);
  }
}

// ── 2. An empty / comments-only file is also a no-op ──
{
  const got = localOverlayPaths(root('# just a comment\n\n   \n'));
  if (eq(got, [])) {
    pass('comments and blank lines only → no overlay paths');
  } else {
    fail(`#2 comments-only returned ${JSON.stringify(got)}`);
  }
}

// ── 3. A user layer file is refused ──
{
  let threw = null;
  try {
    localOverlayPaths(root('cv.md\n'));
  } catch (err) {
    threw = err;
  }
  if (threw && threw.message.includes('cv.md')) {
    pass('declaring a non-system layer file throws and names the path');
  } else {
    fail(`#3 expected a throw naming cv.md, got ${threw ? threw.message : 'no throw'}`);
  }
}

// ── 4. A system file is accepted ──
{
  const got = localOverlayPaths(root('update-system.mjs\n'));
  if (eq(got, ['update-system.mjs'])) {
    pass('declaring a system file is accepted');
  } else {
    fail(`#4 expected update-system.mjs, got ${JSON.stringify(got)}`);
  }
}

// ── 5. The declaration file itself and local-paths are refused ──
{
  for (const bad of [LOCAL_OVERLAY_FILE, LOCAL_PATHS_FILE]) {
    let threw = null;
    try {
      localOverlayPaths(root(`${bad}\n`));
    } catch (err) {
      threw = err;
    }
    if (threw && threw.message.includes(bad)) {
      pass(`cannot list config file itself: ${bad}`);
    } else {
      fail(`#5 expected a throw naming ${bad}, got ${threw ? threw.message : 'no throw'}`);
    }
  }
}

// ── 6. Absolute paths and parent-directory escapes are refused ──
{
  for (const bad of ['/etc/passwd', '../outside.txt', 'C:\\Windows\\system.ini']) {
    let threw = null;
    try {
      localOverlayPaths(root(`${bad}\n`));
    } catch (err) {
      threw = err;
    }
    if (threw) {
      pass(`escaping path refused: ${bad}`);
    } else {
      fail(`#6 accepted an escaping path: ${bad}`);
    }
  }
}

// ── 7. Non-canonical spellings of a system path are refused ──
{
  const nonCanonical = [
    ['./update-system.mjs', 'a leading ./'],
    ['dashboard/./main.go', 'an interior . segment'],
    ['dashboard//main.go', 'a repeated separator'],
    ['dashboard\\main.go', 'a backslash separator'],
  ];
  const survivors = [];
  for (const [path, shape] of nonCanonical) {
    let threw = null;
    try {
      localOverlayPaths(root(`${path}\n`));
    } catch (err) {
      threw = err;
    }
    if (!threw || !threw.message.includes(path)) survivors.push(`${shape} → ${path}`);
  }
  if (survivors.length === 0) {
    pass('non-canonical path spellings are refused and named');
  } else {
    fail(`#7 these non-canonical forms were accepted: ${survivors.join('; ')}`);
  }
}

for (const dir of roots) rmSync(dir, { recursive: true, force: true });
