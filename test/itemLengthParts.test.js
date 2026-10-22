import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { resolveItemBom } from '../src/itemBom.js';
import { formatItemLengthParts, getItem } from '../src/items.js';
import { listProfileLengthItems } from '../src/profileLength.js';
import { formatProductionBomText } from '../src/productionBomPanel.js';

// Uzun parça → sıralı bölünüş (DB 0079 fair_stand_item_length_parts).
const EXPECTED = Object.freeze({
  profile_388: '346,5 + 41,5',
  profile_487: '346,5 + 140,5',
  upright_396: '346,5 + 49,5',
  upright_445_5: '346,5 + 99',
  upright_495: '346,5 + 8 + 140,5',
});

function lengthCm(item) {
  return Math.max(item.dimensions.widthCm, item.dimensions.depthCm, item.dimensions.heightCm);
}

test('uzun profil ve dikmeler sıralı parça bölünüşünü taşır; parça toplamı uzun boya eşittir', () => {
  for (const [itemKey, label] of Object.entries(EXPECTED)) {
    assert.equal(formatItemLengthParts(itemKey), label, itemKey);
    const item = getItem(itemKey);
    const total = item.lengthParts.reduce((sum, partKey) => sum + lengthCm(getItem(partKey)), 0);
    assert.equal(total, lengthCm(item), itemKey);
  }
  // Standart ve altındaki boylarda bölünüş yoktur.
  for (const itemKey of ['upright_346_5', 'upright_99', 'profile_289', 'profile_41_5']) {
    assert.equal(formatItemLengthParts(itemKey), null, itemKey);
  }
});

test('profile_8 yalnız bölünüş parçasıdır: gizli, sahnede çizilmez, boy penceresinde yok', () => {
  const piece = getItem('profile_8');
  assert.equal(piece.type, 'profile');
  assert.equal(piece.unit, 'adet');
  assert.equal(piece.dimensions.widthCm, 8);
  assert.equal(piece.catalogVisible, false);
  assert.equal(piece.isRender, false);
  assert.equal(listProfileLengthItems().some((item) => item.itemKey === 'profile_8'), false);
});

test('bölünüş yalnız etikettir: BOM uzun parçanın kendi Item’ı ×N kalır', () => {
  const bom = resolveItemBom('upright_495', 3);
  assert.deepEqual(bom.map((line) => [line.itemKey, line.quantity, line.unit]), [['upright_495', 3, 'adet']]);
});

test('üretim listesi satırı adın yanında bölünüşü yazar (ekran ve metin indir)', () => {
  const line = { itemKey: 'upright_495', name: getItem('upright_495').name, quantity: 2, unit: 'adet' };
  const text = formatProductionBomText({ modules: [], lines: [line], printAreas: [] });
  assert.match(text, /2 × Dikme 495 \(346,5 \+ 8 \+ 140,5\) · adet · upright_495/);
  const plain = { itemKey: 'upright_346_5', name: getItem('upright_346_5').name, quantity: 1, unit: 'adet' };
  assert.doesNotMatch(formatProductionBomText({ modules: [], lines: [plain], printAreas: [] }), /upright_346_5[^\n]*\(/);
  const panel = readFileSync(new URL('../src/productionBomPanel.js', import.meta.url), 'utf8');
  assert.match(panel, /const parts = formatItemLengthParts\(line\.itemKey\);/);
});
