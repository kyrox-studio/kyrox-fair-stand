import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import {
  GOVERNANCE_DOCUMENT_REQUIRED_DOMAINS,
  SOURCE_FILE_REQUIRED_DOMAINS,
  SYSTEM_BROWSER_E2E_DOMAINS,
  SYSTEM_IMPACT_DOMAINS,
  isGuardedChangeFile,
  requiredDomainsForFile,
  requiresBrowserE2E,
  validateSystemChangeContract,
} from '../src/systemChangeContract.js';

const currentContract = JSON.parse(readFileSync(new URL('../.github/change-contract.json', import.meta.url), 'utf8'));

function validContract(overrides = {}) {
  return {
    schemaVersion: 2,
    id: 'example-change',
    kind: 'bugfix',
    summary: 'Example guarded change.',
    owners: ['src/example.js'],
    sourceOfTruth: ['PROJECT_RULES.md'],
    impact: Object.fromEntries(SYSTEM_IMPACT_DOMAINS.map((domain) => [domain, domain === 'tests' ? 'affected' : 'not-applicable'])),
    impactAnalysis: {
      mode: 'full-system',
      affectedFiles: [],
      affectedTests: ['test/example.test.js'],
      affectedDocs: [],
      relatedFindings: {
        affected: [],
        reviewedNotAffected: [],
      },
      notes: 'All discovered dependents were reviewed.',
    },
    tests: {
      targeted: ['test/example.test.js'],
      fullSuite: true,
      build: true,
      e2e: {
        required: false,
        targeted: [],
        reason: 'This fixture has no browser-impacting domain.',
      },
    },
    risk: {
      level: 'low',
      notes: 'Example risk declaration.',
    },
    migration: {
      required: false,
      notes: 'No migration.',
    },
    rollback: 'Revert the change.',
    ...overrides,
  };
}

test('current repository change declaration satisfies the universal schema', () => {
  assert.deepEqual(validateSystemChangeContract(currentContract), []);
});

test('every impact domain requires an explicit decision', () => {
  const contract = validContract();
  delete contract.impact.security;

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('Missing impact decisions: security')));
});

test('every change must mark tests as affected', () => {
  const contract = validContract({
    impact: {
      ...validContract().impact,
      tests: 'not-applicable',
    },
  });

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('All changes must mark tests as affected')));
});

test('every change must declare a full-system impact analysis', () => {
  const contract = validContract();
  delete contract.impactAnalysis;

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('impactAnalysis is required for every change')));
});

test('impact analysis must explicitly inventory code, tests, docs and finding review', () => {
  const contract = validContract({
    impactAnalysis: {
      mode: 'partial',
      affectedFiles: 'src/main.js',
      affectedTests: [],
      affectedDocs: [],
      relatedFindings: {
        affected: ['F-28'],
        reviewedNotAffected: [],
      },
      notes: '',
    },
  });

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('impactAnalysis.mode must be full-system')));
  assert.ok(errors.some((error) => error.includes('impactAnalysis.affectedFiles must be an array')));
  assert.ok(errors.some((error) => error.includes('invalid finding id: F-28')));
  assert.ok(errors.some((error) => error.includes('impactAnalysis.notes is required')));
});

test('every change must name at least one non-empty targeted regression test', () => {
  for (const targeted of [[], ['   ']]) {
    const contract = validContract({
      tests: {
        ...validContract().tests,
        targeted,
      },
    });

    const errors = validateSystemChangeContract(contract);
    assert.ok(errors.some((error) => error.includes('tests.targeted must contain at least one targeted regression test')));
  }
});

test('targeted regressions must be part of the reviewed affected-test inventory', () => {
  const contract = validContract({
    impactAnalysis: {
      ...validContract().impactAnalysis,
      affectedTests: [],
    },
  });

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('Targeted tests must also appear in impactAnalysis.affectedTests')));
});

test('browser-impacting domains automatically require E2E coverage', () => {
  for (const domain of SYSTEM_BROWSER_E2E_DOMAINS) {
    const contract = validContract({
      impact: {
        ...validContract().impact,
        [domain]: 'affected',
      },
    });

    assert.equal(requiresBrowserE2E(contract.impact), true, `${domain} must trigger browser E2E`);
    const errors = validateSystemChangeContract(contract);
    assert.ok(
      errors.some((error) => error.includes('Browser-impacting changes must require E2E coverage')),
      `${domain} must be rejected without E2E`,
    );
  }
});

test('required E2E must name real e2e paths in the reviewed affected-test inventory', () => {
  const contract = validContract({
    impact: {
      ...validContract().impact,
      ui: 'affected',
    },
    tests: {
      ...validContract().tests,
      e2e: {
        required: true,
        targeted: ['test/not-e2e.test.js', 'e2e/missing-review.spec.mjs'],
        reason: 'Browser-visible behavior changed.',
      },
    },
  });

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('E2E targeted tests must live under e2e/')));
  assert.ok(errors.some((error) => error.includes('E2E targeted tests must also appear in impactAnalysis.affectedTests')));
});

test('non-browser governance changes may explicitly declare E2E not required', () => {
  const contract = validContract({
    kind: 'architecture',
    impact: {
      ...validContract().impact,
      architecture: 'affected',
    },
  });

  assert.equal(requiresBrowserE2E(contract.impact), false);
  assert.deepEqual(validateSystemChangeContract(contract), []);
});

test('UI controls cannot declare UI as not applicable', () => {
  const contract = validContract({
    kind: 'ui-control',
    impact: {
      ...validContract().impact,
      tests: 'affected',
      ui: 'not-applicable',
    },
  });

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('ui-control changes must mark ui as affected')));
});

test('architecture changes must declare architecture impact', () => {
  const contract = validContract({
    kind: 'architecture',
    impact: {
      ...validContract().impact,
      tests: 'affected',
      architecture: 'not-applicable',
    },
  });

  const errors = validateSystemChangeContract(contract);
  assert.ok(errors.some((error) => error.includes('architecture changes must mark architecture as affected')));
});

test('guarded paths cover runtime, UI, assets, unit tests, E2E, governance docs, catalog API and delivery infrastructure', () => {
  assert.equal(isGuardedChangeFile('src/main.js'), true);
  assert.equal(isGuardedChangeFile('backend/app/main.py'), true);
  assert.equal(isGuardedChangeFile('backend/tests/test_health.py'), true);
  assert.equal(isGuardedChangeFile('index.html'), true);
  assert.equal(isGuardedChangeFile('public/models/example.glb'), true);
  assert.equal(isGuardedChangeFile('scripts/verify-change-contract.mjs'), true);
  assert.equal(isGuardedChangeFile('test/systemChangeGate.test.js'), true);
  assert.equal(isGuardedChangeFile('tests/legacy-regression.test.js'), true);
  assert.equal(isGuardedChangeFile('e2e/smoke.spec.mjs'), true);
  assert.equal(isGuardedChangeFile('playwright.config.mjs'), true);
  assert.equal(isGuardedChangeFile('.github/workflows/ci.yml'), true);
  assert.equal(isGuardedChangeFile('README.md'), true);
  assert.equal(isGuardedChangeFile('AGENTS.md'), true);
  assert.equal(isGuardedChangeFile('ITEM_CONTRACT.md'), true);
  assert.equal(isGuardedChangeFile('SYSTEM_CHANGE_GATE.md'), true);
  assert.equal(isGuardedChangeFile('SYSTEM_IMPACT_SWEEP.md'), true);
  assert.equal(isGuardedChangeFile('PROJECT_RULES.md'), true);
  assert.equal(isGuardedChangeFile('ROADMAP.md'), false);
});

test('all test surfaces require explicit tests impact', () => {
  for (const path of ['test/systemChangeGate.test.js', 'tests/legacy-regression.test.js', 'e2e/smoke.spec.mjs']) {
    assert.equal(isGuardedChangeFile(path), true, `${path} must be guarded`);
    assert.deepEqual(requiredDomainsForFile(path), ['tests'], `${path} must require tests impact`);
  }
  assert.deepEqual(requiredDomainsForFile('playwright.config.mjs').sort(), ['architecture', 'tests']);
  assert.deepEqual(
    requiredDomainsForFile('backend/tests/test_health.py').sort(),
    ['architecture', 'tests'],
  );
  assert.deepEqual(
    requiredDomainsForFile('backend/app/main.py').sort(),
    ['architecture', 'security', 'tests'],
  );
});

test('canonical governance documents are guarded architecture surfaces', () => {
  const expected = [
    'AGENTS.md',
    'ITEM_CONTRACT.md',
    'README.md',
    'PROJECT_RULES.md',
    'ARCHITECTURE_RULES.md',
    'SYSTEM_DEVELOPMENT_CONTRACT.md',
    'SYSTEM_CHANGE_GATE.md',
    'SYSTEM_IMPACT_SWEEP.md',
    'MODULE_BEHAVIOR_STANDARD.md',
    'SYSTEM_AUDIT_CHECKLIST.md',
  ].sort();

  assert.deepEqual(Object.keys(GOVERNANCE_DOCUMENT_REQUIRED_DOMAINS).sort(), expected);

  for (const path of expected) {
    assert.equal(isGuardedChangeFile(path), true, `${path} must be guarded`);
    assert.deepEqual(requiredDomainsForFile(path), ['architecture'], `${path} must require architecture impact`);
  }
});

test('every current src file has an explicit non-empty impact-domain ownership mapping', () => {
  const sourceFiles = readdirSync(new URL('../src/', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => `src/${entry.name}`)
    .sort();
  const mappedFiles = Object.keys(SOURCE_FILE_REQUIRED_DOMAINS).sort();

  assert.deepEqual(mappedFiles, sourceFiles, 'SOURCE_FILE_REQUIRED_DOMAINS must classify every current src file exactly once');

  for (const path of sourceFiles) {
    const domains = requiredDomainsForFile(path);
    assert.ok(domains.length > 0, `${path} must require at least one impact domain`);
    assert.ok(domains.every((domain) => SYSTEM_IMPACT_DOMAINS.includes(domain)), `${path} contains an unknown impact domain`);
  }
});

test('high-risk canonical paths derive ownership-appropriate mandatory impact domains', () => {
  assert.deepEqual(requiredDomainsForFile('src/catalog.js'), ['catalog']);
  assert.deepEqual(requiredDomainsForFile('src/designState.js').sort(), ['persistence', 'state']);
  assert.deepEqual(requiredDomainsForFile('src/moduleRecipes.js'), ['bom']);
  assert.deepEqual(requiredDomainsForFile('src/autosaveController.js'), ['persistence']);
  assert.deepEqual(
    requiredDomainsForFile('src/projectRemote.js').sort(),
    ['assets', 'importExport', 'persistence', 'security', 'storage'],
  );
  assert.deepEqual(requiredDomainsForFile('src/items.js').sort(), ['architecture', 'bom', 'catalog']);
  assert.deepEqual(requiredDomainsForFile('src/viewKeyboardShortcuts.js').sort(), ['accessibility', 'behavior', 'ui']);
  assert.deepEqual(requiredDomainsForFile('src/wall.js').sort(), ['composition', 'placement']);
  assert.deepEqual(requiredDomainsForFile('src/groundLayout.js').sort(), ['placement', 'renderer']);
  assert.deepEqual(requiredDomainsForFile('public/models/example.glb'), ['assets']);
  assert.deepEqual(requiredDomainsForFile('index.html'), ['ui']);
});

test('central orchestration cannot hide its known cross-domain responsibilities', () => {
  const domains = new Set(requiredDomainsForFile('src/main.js'));
  for (const domain of [
    'architecture',
    'catalog',
    'behavior',
    'state',
    'placement',
    'renderer',
    'persistence',
    'ui',
    'composition',
    'assets',
    'storage',
    'importExport',
  ]) {
    assert.equal(domains.has(domain), true, `src/main.js must require ${domain}`);
  }
});

test('placement core changes require both behavior and placement declarations', () => {
  assert.deepEqual(requiredDomainsForFile('src/modulePlacement.js').sort(), ['behavior', 'placement']);
});
