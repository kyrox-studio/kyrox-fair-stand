import test from 'node:test';
import assert from 'node:assert/strict';
import { isItemInCatalogBoothType, listCatalogGroups, setCatalogBoothType } from '../src/catalog.js';
import {
  DEFAULT_BOOTH_TYPE,
  getBoothTypeHeading,
  getBoothTypeLabel,
  isKnownBoothType,
  listBoothTypes,
  normalizeBoothType,
} from '../src/boothTypes.js';
import { validateImportedStandState } from '../src/projectImportValidation.js';

test('üç stand tipi var ve şimdilik yalnız Maksima aktif', () => {
  assert.deepEqual(listBoothTypes().map((type) => type.name), ['Maksima Stand', 'Özel Tasarım', 'Paket Stand']);
  assert.deepEqual(listBoothTypes().filter((type) => type.active).map((type) => type.key), [DEFAULT_BOOTH_TYPE]);
});

test('alanı olmayan eski proje Maksima sayılır, bilinen tip korunur', () => {
  assert.equal(normalizeBoothType(undefined), 'maxima');
  assert.equal(normalizeBoothType('yok'), 'maxima');
  assert.equal(normalizeBoothType('package'), 'package');
  assert.equal(getBoothTypeLabel(undefined), 'Maksima Stand');
  assert.equal(isKnownBoothType('back-wall'), false);
  assert.equal(getBoothTypeHeading('package'), 'Paket Stand Yapılandırması');
  assert.equal(getBoothTypeHeading(undefined), 'Maksima Stand Yapılandırması');
});

test('içe aktarma bilinmeyen stand tipini reddeder, alanı olmayan eski paketi kabul eder', () => {
  const stand = { standType: 'island', xCm: 500, yCm: 500, itemKey: 'karolaj' };
  assert.equal(validateImportedStandState(stand).ok, true);
  assert.equal(validateImportedStandState({ ...stand, boothType: 'maxima' }).ok, true);
  const unknown = validateImportedStandState({ ...stand, boothType: 'ahsap' });
  assert.equal(unknown.ok, false);
  assert.match(unknown.message, /stand tipi/i);
});

test('katalog açık tipe göre süzülür: null hepsinde, çoklu seçim seçili tiplerde', () => {
  assert.equal(isItemInCatalogBoothType({ boothTypeKeys: null }), true);
  assert.equal(isItemInCatalogBoothType({ boothTypeKeys: ['maxima', 'package'] }), true);
  const namesWith = (boothType, options) => {
    setCatalogBoothType(boothType);
    return listCatalogGroups(options).filter((group) => group.keys.length > 0).map((group) => group.catalogName);
  };
  try {
    const maxima = namesWith('maxima');
    assert.ok(maxima.includes('Panel & Duvar'));
    assert.deepEqual(namesWith('package'), ['Extra', 'Elektronik & Aydınlatma']);
    assert.deepEqual(namesWith('package', { allBoothTypes: true }), maxima);
    assert.equal(isItemInCatalogBoothType({ boothTypeKeys: ['maxima'] }), false);
    assert.equal(isItemInCatalogBoothType({ boothTypeKeys: ['maxima', 'package'] }), true);
  } finally {
    setCatalogBoothType('maxima');
  }
});
