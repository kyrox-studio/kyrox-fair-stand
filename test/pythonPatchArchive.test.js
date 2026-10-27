import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const ARCHIVED = [
  'scripts/archive/add-tv-sizes.py',
  'scripts/archive/add-video-wall-2x2.py',
  'scripts/archive/fix-tv-screen-face.py',
  'scripts/archive/scrub-legacy-dimensions-in-docs.py',
  'scripts/archive/refresh-item-ozellik-matrix-whd.py',
];

const ACTIVE_STALE_PATHS = [
  'scripts/add-tv-sizes.py',
  'scripts/add-video-wall-2x2.py',
  'scripts/fix-tv-screen-face.py',
  'scripts/scrub-legacy-dimensions-in-docs.py',
  'scripts/refresh-item-ozellik-matrix-whd.py',
];

test('F-045 Python patch scripts live under scripts/archive and are not package scripts', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const scriptText = JSON.stringify(pkg.scripts ?? {});

  for (const path of ARCHIVED) {
    assert.equal(existsSync(path), true, path);
    assert.equal(scriptText.includes(path.replace('scripts/archive/', '')), false, path);
  }

  for (const path of ACTIVE_STALE_PATHS) {
    assert.equal(existsSync(path), false, path);
  }

  const readme = readFileSync(new URL('../scripts/archive/README.md', import.meta.url), 'utf8');
  assert.match(readme, /aktif tooling değildir/i);
});
