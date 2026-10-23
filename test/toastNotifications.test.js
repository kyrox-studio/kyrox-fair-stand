import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { reportError, showToast, TOAST_KINDS } from '../src/toastNotifications.js';

const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('reportError hatayı konsola ayrıntısıyla yazar; DOM yoksa bildirim sessizce atlanır', () => {
  const warned = [];
  const shown = reportError('Proje kaydedilemedi', new Error('ağ'), { warn: (...args) => warned.push(args) });
  assert.equal(warned.length, 1);
  assert.equal(warned[0][0], 'Proje kaydedilemedi:');
  assert.equal(warned[0][1].message, 'ağ');
  assert.equal(shown, false);
  assert.equal(showToast('   '), false);
  assert.deepEqual([...TOAST_KINDS], ['error', 'info', 'success']);
});

test('main hataları bildirimle gösterir; hata için alert ve yalnız-konsol uyarısı kalmaz', () => {
  assert.match(mainSource, /import \{ reportError, showToast \} from '\.\/toastNotifications\.js';/);
  assert.doesNotMatch(mainSource, /window\.alert\(/);
  assert.match(mainSource, /reportError\('Proje kaydedilemedi', error\)/);
  assert.match(mainSource, /reportError\('Otomatik kayıt başarısız', error\)/);
  // Ana hatanın yanındaki temizlik hataları yalnız konsolda kalır.
  assert.match(mainSource, /console\.warn\('Başarısız içe aktarma temizlenemedi:', cleanupError\)/);
});

test('CRM içindeki konfigüratör de bildirim stilini yükler (mountFairStand inline CSS listesi)', () => {
  const mount = fs.readFileSync(new URL('../src/mountFairStand.js', import.meta.url), 'utf8');
  const styles = fs.readFileSync(new URL('../src/configuratorStyles.js', import.meta.url), 'utf8');
  assert.match(mount, /import toastNotificationsCss from '\.\/toastNotifications\.css\?inline';/);
  assert.match(mount, /productionBomPanelCss,\s*toastNotificationsCss,/);
  assert.match(styles, /import '\.\/toastNotifications\.css';/);
});
