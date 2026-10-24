import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('kayıt ve proje açılışı CRM adresini /stand-projects/{id} yapar (yenileyince sihirbaz açılmaz)', () => {
  const persist = main.slice(main.indexOf('async function persistActiveProject('), main.indexOf('async function restoreProject('));
  assert.match(persist, /await refreshProjectList\(stored\.id\);\r?\n  syncHostProjectUrl\(stored\.id\);/);
  const restore = main.slice(main.indexOf('async function restoreProject('));
  assert.match(restore, /activeProjectId = project\.id;\r?\n  syncHostProjectUrl\(project\.id\);/);
  // Yalnız uzak kayıtta ve host adresi stand-projects altındayken; editör yeniden kurulmaz.
  const helper = main.slice(main.indexOf('function syncHostProjectUrl('), main.indexOf('async function persistActiveProject('));
  assert.match(helper, /if \(!projectId \|\| !isProjectRemoteEnabled\(\)\) return;/);
  assert.match(helper, /hostWindow\.history\.replaceState\(/);
  assert.doesNotMatch(helper, /pushState|location\.assign|location\.href =/);
});
