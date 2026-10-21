import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('package exposes universal change-gate and Playwright E2E commands', () => {
  assert.equal(packageJson.scripts['contract:verify'], 'node scripts/verify-change-contract.mjs');
  assert.equal(packageJson.scripts['e2e:deps'], 'npm install --no-save --no-package-lock @playwright/test@1.62.1');
  assert.equal(packageJson.scripts.e2e, 'playwright test');
});

test('canonical CI runs on PRs to main only; no post-merge push rerun', () => {
  assert.doesNotMatch(ciWorkflow, /^\s*push:/m);
  assert.match(ciWorkflow, /pull_request:\s*\n\s*branches: \[main\]/);
  assert.doesNotMatch(ciWorkflow, /git fetch origin Version2/);
  assert.doesNotMatch(ciWorkflow, /CHANGE_GATE_BASE:/);
  assert.doesNotMatch(ciWorkflow, /branches: \[ROG\]/);
  assert.doesNotMatch(ciWorkflow, /branches: \[RefactorItem, Version2\]/);
});

test('canonical CI enforces gate, unit tests, catalog API tests, build and real-browser E2E in order', () => {
  const gateIndex = ciWorkflow.indexOf('run: npm run contract:verify');
  const testIndex = ciWorkflow.indexOf('run: npm test');
  const apiTestIndex = ciWorkflow.indexOf('python -m pytest');
  const buildIndex = ciWorkflow.indexOf('run: npm run build');
  const e2eDepsIndex = ciWorkflow.indexOf('run: npm run e2e:deps');
  const chromiumIndex = ciWorkflow.indexOf('run: npx playwright install --with-deps chromium');
  const e2eIndex = ciWorkflow.indexOf('run: npm run e2e\n');

  assert.ok(ciWorkflow.includes('fetch-depth: 0'));
  assert.ok(gateIndex >= 0, 'CI must run the change contract gate');
  assert.ok(testIndex > gateIndex, 'unit/integration tests must run after the change contract gate');
  assert.ok(apiTestIndex > testIndex, 'catalog API pytest must run after npm test');
  assert.ok(buildIndex > apiTestIndex, 'build must run after catalog API tests');
  assert.ok(e2eDepsIndex > buildIndex, 'Playwright runner install must happen after build');
  assert.ok(chromiumIndex > e2eDepsIndex, 'Chromium must be installed after the Playwright runner');
  assert.ok(e2eIndex > chromiumIndex, 'E2E must run after Chromium is installed');
  assert.ok(ciWorkflow.includes('actions/upload-artifact@v4'), 'CI must retain browser failure evidence');
  assert.ok(ciWorkflow.includes('playwright-report/'));
  assert.ok(ciWorkflow.includes('test-results/'));
  assert.ok(ciWorkflow.includes('actions/setup-python@v5'), 'CI must install Python for catalog API tests');
});
