import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PROFILE_FINISH_DEFAULT,
  PROFILE_FINISHES,
  isKnownProfileFinish,
  normalizeProfileFinish,
  profileFinishColorCss,
} from '../src/profileFinish.js';
import { validateImportedStandState } from '../src/projectImportValidation.js';

const stand = { standType: 'back-wall', xCm: 500, yCm: 400, itemKey: 'karolaj' };

test('profil rengi: varsayılan katalog rengidir, siyah seçilebilir', () => {
  assert.deepEqual(Object.keys(PROFILE_FINISHES), ['default', 'black']);
  assert.equal(PROFILE_FINISH_DEFAULT, 'default');
  assert.equal(profileFinishColorCss('default'), null);
  assert.match(profileFinishColorCss('black'), /^#[0-9a-f]{6}$/);
});

test('eski ya da bozuk kayıt varsayılan profil rengine düşer', () => {
  assert.equal(normalizeProfileFinish(undefined), 'default');
  assert.equal(normalizeProfileFinish(null), 'default');
  assert.equal(normalizeProfileFinish('mor'), 'default');
  assert.equal(normalizeProfileFinish('__proto__'), 'default');
  assert.equal(normalizeProfileFinish('black'), 'black');
  assert.equal(isKnownProfileFinish('toString'), false);
  assert.equal(profileFinishColorCss('mor'), null);
});

test('içe aktarım: profil rengi alanı yoksa ya da biliniyorsa kabul, bilinmiyorsa ret', () => {
  assert.equal(validateImportedStandState(stand).ok, true);
  assert.equal(validateImportedStandState({ ...stand, profileFinish: 'default' }).ok, true);
  assert.equal(validateImportedStandState({ ...stand, profileFinish: 'black' }).ok, true);
  const rejected = validateImportedStandState({ ...stand, profileFinish: 'mor' });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.message, 'Proje profil rengi geçersiz.');
});

test('profil rengi seçicisi iki işaretlemede de var ve yalnız Gelişmiş modda görünür', async () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const { FAIR_STAND_MARKUP } = await import('../src/configuratorMarkup.js');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  for (const markup of [html, FAIR_STAND_MARKUP]) {
    assert.match(markup, /<select id="profile-finish"><option value="default" selected>Varsayılan \(alüminyum\)<\/option><option value="black">Siyah<\/option><\/select>/);
  }
  assert.match(css, /#app\[data-editor-mode="simple"\] #profile-finish-field,/);
});
