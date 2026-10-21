import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const README_URL = new URL('../README.md', import.meta.url);
const CONTRACT_URL = new URL('../SYSTEM_DEVELOPMENT_CONTRACT.md', import.meta.url);
const ITEM_CONTRACT_URL = new URL('../docs/items/contract/ITEM_CONTRACT.md', import.meta.url);
const AGENTS_URL = new URL('../AGENTS.md', import.meta.url);
const PROJECT_RULES_URL = new URL('../PROJECT_RULES.md', import.meta.url);
const ARCHITECTURE_RULES_URL = new URL('../ARCHITECTURE_RULES.md', import.meta.url);

test('README documents the universal impact sweep and canonical browser CI order', async () => {
  const source = await readFile(README_URL, 'utf8');

  assert.match(source, /SYSTEM_CHANGE_GATE\.md/);
  assert.match(source, /SYSTEM_IMPACT_SWEEP\.md/);
  assert.match(source, /SYSTEM_DEVELOPMENT_CONTRACT\.md/);
  assert.match(source, /SYSTEM_AUDIT_CHECKLIST\.md/);
  assert.match(source, /\.github\/change-contract\.json/);
  assert.match(source, /SYSTEM_IMPACT_DOMAINS/);
  assert.match(source, /SYSTEM_BROWSER_E2E_DOMAINS/);
  assert.match(source, /npm run contract:verify/);
  assert.match(source, /contract:verify[\s\S]*npm ci[\s\S]*npm test[\s\S]*python -m pytest[\s\S]*npm run build[\s\S]*Chromium[\s\S]*npm run e2e/);
  assert.match(source, /targeted regression/);
  assert.match(source, /targeted E2E/);
  assert.match(source, /main`?'de (CI )?tekrar koş/);
  assert.doesNotMatch(source, /post-merge main CI/);
});

test('SYSTEM_DEVELOPMENT_CONTRACT hands off to the dynamic universal gate and browser E2E policy', async () => {
  const source = await readFile(CONTRACT_URL, 'utf8');

  assert.match(source.slice(0, 2200), /SYSTEM_CHANGE_GATE\.md/);
  assert.match(source.slice(0, 2400), /SYSTEM_IMPACT_SWEEP\.md/);
  assert.match(source.slice(0, 2600), /\.github\/change-contract\.json/);
  assert.match(source.slice(0, 2800), /ITEM_CONTRACT\.md/);
  assert.match(source, /SYSTEM_IMPACT_DOMAINS/);
  assert.doesNotMatch(source, /tüm 17 impact domain/);
  assert.match(source, /SYSTEM_BROWSER_E2E_DOMAINS/);
  assert.match(source, /npm run contract:verify/);
  assert.match(source, /contract:verify → npm ci → npm test → python -m pytest → npm run build[\s\S]*npm run e2e/);
  assert.match(source, /main`?'de (CI )?tekrar koş/);
  assert.doesNotMatch(source, /post-merge main CI/);
});

test('repository agent and architecture entrypoints require the canonical Item contract', async () => {
  const [itemContract, agents, projectRules, architectureRules] = await Promise.all([
    readFile(ITEM_CONTRACT_URL, 'utf8'),
    readFile(AGENTS_URL, 'utf8'),
    readFile(PROJECT_RULES_URL, 'utf8'),
    readFile(ARCHITECTURE_RULES_URL, 'utf8'),
  ]);

  assert.match(agents, /ITEM_CONTRACT\.md/);
  assert.match(agents, /itemKey/);
  assert.match(agents, /BOM recipe\/resolver/);

  assert.match(projectRules, /ITEM_CONTRACT\.md/);
  assert.match(architectureRules, /ITEM_CONTRACT\.md/);

  assert.match(itemContract, /kök sistem `Item`/i);
  assert.match(itemContract, /kanonik `itemKey`/);
  assert.match(itemContract, /Item davranışı `type` seviyesinde/);
  assert.match(itemContract, /quantity/);
  assert.match(itemContract, /recursive BOM/);
  assert.match(itemContract, /BOM ile maliyet\/fiyatlandırma ayrıdır/);
});
