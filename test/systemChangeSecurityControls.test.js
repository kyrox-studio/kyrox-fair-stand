import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SECURITY_CONTROL_IDS,
  SYSTEM_IMPACT_DOMAINS,
  securityTestReferenceError,
  securityTestReferences,
  validateSystemChangeContract,
} from '../src/systemChangeContract.js';

// Statik gate yalnız kayıt bütünlüğünü ve test referansının varlığını kanıtlar;
// testin geçmesi npm test / pytest adımlarının, güvenlik ise negatif testlerin işidir.

const THIS_TEST = 'test/systemChangeSecurityControls.test.js';
const VERIFY_SCRIPT = fileURLToPath(new URL('../scripts/verify-change-contract.mjs', import.meta.url));

function securityControls() {
  return Object.fromEntries(SECURITY_CONTROL_IDS.map((id) => [
    id,
    id === 'SEC-10'
      ? { status: 'required', tests: [`${THIS_TEST}::missing control fails`] }
      : { status: 'na', reason: `Fixture change has no ${id} surface in this example.` },
  ]));
}

function contractWithSecurity(overrides = {}) {
  return {
    schemaVersion: 2,
    id: 'security-fixture',
    kind: 'tooling',
    summary: 'Security fixture change.',
    owners: ['scripts/example.mjs'],
    sourceOfTruth: ['SYSTEM_CHANGE_GATE.md'],
    impact: Object.fromEntries(SYSTEM_IMPACT_DOMAINS.map((domain) => [
      domain,
      ['tests', 'architecture', 'security'].includes(domain) ? 'affected' : 'not-applicable',
    ])),
    impactAnalysis: {
      mode: 'full-system',
      affectedFiles: [],
      affectedTests: [THIS_TEST],
      affectedDocs: [],
      relatedFindings: { affected: [], reviewedNotAffected: [] },
      notes: 'Fixture.',
    },
    tests: {
      targeted: [THIS_TEST],
      fullSuite: true,
      build: true,
      e2e: { required: false, targeted: [], reason: 'No browser domain in fixture.' },
    },
    risk: { level: 'low', notes: 'Fixture.' },
    migration: { required: false, notes: 'No migration.' },
    rollback: 'Revert.',
    security: { controls: securityControls() },
    ...overrides,
  };
}

const readFromRepo = (path) => {
  try {
    return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  } catch {
    return null;
  }
};

test('valid security classification passes', () => {
  assert.deepEqual(validateSystemChangeContract(contractWithSecurity()), []);
});

test('impact.security=affected without security block fails', () => {
  const contract = contractWithSecurity();
  delete contract.security;
  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('impact.security=affected requires security.controls')), errors.join('\n'));
});

test('impact.security=not-applicable without security block stays valid', () => {
  const contract = contractWithSecurity();
  delete contract.security;
  contract.impact.security = 'not-applicable';
  assert.deepEqual(validateSystemChangeContract(contract), []);
});

test('missing control fails', () => {
  const contract = contractWithSecurity();
  delete contract.security.controls['SEC-07'];
  assert.ok(validateSystemChangeContract(contract).some((error) => error.includes('security.controls missing: SEC-07')));
});

test('unknown control fails', () => {
  const contract = contractWithSecurity();
  contract.security.controls['SEC-99'] = { status: 'na', reason: 'x'.repeat(30) };
  assert.ok(validateSystemChangeContract(contract).some((error) => error.includes('unknown ids: SEC-99')));
});

test('invalid status fails', () => {
  const contract = contractWithSecurity();
  contract.security.controls['SEC-03'] = { status: 'skip' };
  assert.ok(validateSystemChangeContract(contract).some((error) => error.includes('SEC-03.status must be')));
});

test('na without concrete reason fails', () => {
  for (const reason of [undefined, '', 'No auth.']) {
    const contract = contractWithSecurity();
    contract.security.controls['SEC-14'] = reason === undefined ? { status: 'na' } : { status: 'na', reason };
    assert.ok(
      validateSystemChangeContract(contract).some((error) => error.includes('SEC-14=na requires a concrete')),
      `reason=${reason}`,
    );
  }
});

test('na with rejected rationale fails', () => {
  for (const reason of [
    'UI gizli olduğu için bu kontrol gerekmez.',
    'Testler yeşil, ek kontrol gerekmiyor.',
    'Sonra bakarız, şimdilik kapsam dışı.',
    'Endpoint is hidden in the UI for normal users.',
    'TBD after the release is finished.',
  ]) {
    const contract = contractWithSecurity();
    contract.security.controls['SEC-14'] = { status: 'na', reason };
    assert.ok(
      validateSystemChangeContract(contract).some((error) => error.includes('SEC-14=na reason is not an accepted')),
      reason,
    );
  }
});

test('required without tests fails', () => {
  const contract = contractWithSecurity();
  contract.security.controls['SEC-10'] = { status: 'required', tests: [] };
  assert.ok(validateSystemChangeContract(contract).some((error) => error.includes('SEC-10=required requires at least one test')));
});

test('required control while impact.security is not-applicable fails', () => {
  const contract = contractWithSecurity();
  contract.impact.security = 'not-applicable';
  assert.ok(validateSystemChangeContract(contract).some((error) => error.includes('impact.security is not affected')));
});

test('broken test reference fails', () => {
  const cases = [
    ['test/doesNotExist.test.js', 'does not exist'],
    [`${THIS_TEST}::a test title that is nowhere in the file ${'z'.repeat(3)}`.replace('zzz', 'q'), 'is not found'],
    ['../outside.test.js', 'repository-relative'],
    ['backend/tests/test_health.py::not-a-name', 'not a valid Python test name'],
  ];
  for (const [reference, expected] of cases) {
    const problem = securityTestReferenceError(reference, readFromRepo);
    assert.ok(problem?.includes(expected), `${reference} -> ${problem}`);
  }
});

test('existing test references resolve', () => {
  assert.equal(securityTestReferenceError(`${THIS_TEST}::missing control fails`, readFromRepo), null);
  assert.equal(securityTestReferenceError(THIS_TEST, readFromRepo), null);
  assert.equal(securityTestReferenceError('backend/tests/test_health.py::test_health', readFromRepo), null);
  assert.match(
    securityTestReferenceError('backend/tests/test_health.py::test_health_gone', readFromRepo),
    /is not defined/,
  );
  for (const { reference } of securityTestReferences(contractWithSecurity())) {
    assert.equal(securityTestReferenceError(reference, readFromRepo), null, reference);
  }
});

function runVerifyIn(contract) {
  const dir = mkdtempSync(join(tmpdir(), 'stand-sec-gate-'));
  try {
    mkdirSync(join(dir, '.github'), { recursive: true });
    mkdirSync(join(dir, 'test'), { recursive: true });
    writeFileSync(join(dir, '.github', 'change-contract.json'), JSON.stringify(contract));
    writeFileSync(join(dir, THIS_TEST), readFromRepo(THIS_TEST));
    const env = { ...process.env, CHANGE_GATE_FILES: 'notes/unguarded.txt' };
    delete env.GITHUB_EVENT_NAME;
    delete env.GITHUB_EVENT_PATH;
    delete env.CHANGE_GATE_BASE;
    return spawnSync(process.execPath, [VERIFY_SCRIPT], { cwd: dir, env, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('verify CLI exits non-zero for a broken security test reference', () => {
  const contract = contractWithSecurity();
  contract.security.controls['SEC-10'].tests = [`${THIS_TEST}::qqq-no-such-title-qqq`.replace(/q/g, 'x')];
  const result = runVerifyIn(contract);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /Security control test references do not resolve/);
});

test('verify CLI exits non-zero when affected security has no classification', () => {
  const contract = contractWithSecurity();
  delete contract.security;
  const result = runVerifyIn(contract);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /impact\.security=affected requires security\.controls/);
});

test('verify CLI accepts a valid security classification', () => {
  const result = runVerifyIn(contractWithSecurity());
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
