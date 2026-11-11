import test from 'node:test';
import assert from 'node:assert/strict';

import { getCatalogItem } from '../src/catalog.js';
import {
  describeModuleVariants,
  isCatalogWidthFamilyDescriptor,
  listCatalogWidthFamilyItems,
} from '../src/catalogWidthFamily.js';
import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { listProfileLengthItems } from '../src/profileLength.js';
import { listUprightHeightItems } from '../src/uprightHeight.js';
import { getOptionParentFamily, getVariantFamily, initializeVariantFamilyRegistry } from '../src/variantFamilies.js';
import { loadCanonicalItemCatalog } from './registerCanonicalItemCatalog.mjs';

// 0095: aile tanımı bootstrap `variantFamilies` kaydından gelir (CRM admin "Varyant aileleri").

test('bootstrap aileleri: eş aile ana aileye bağlanır, profil ve dikme aile olarak gelir', () => {
  assert.equal(getVariantFamily('tv').cardLabel, 'TV');
  assert.equal(getOptionParentFamily('wall-separator-sarmasik').key, 'wall-separator');
  assert.equal(getOptionParentFamily('wall-separator'), null);
  assert.equal(getVariantFamily('profile').labelRule, 'profile_length');
  assert.equal(getVariantFamily('upright').title, 'Dikme yüksekliği');
});

test('profil ve dikme boyları aile üyeleridir; katalog kartı ailenin kart adını yazar', () => {
  assert.deepEqual(
    listProfileLengthItems().map((item) => item.itemKey),
    listCatalogWidthFamilyItems('profile').map((item) => item.itemKey),
  );
  assert.ok(listProfileLengthItems().length >= 9);
  assert.ok(listUprightHeightItems().every((item) => item.variant === 'upright'));
  assert.equal(getCatalogItem('profile_289').label, 'Profil');
  assert.equal(getCatalogItem('upright_346_5').label, 'Dikme');
  // Profil / dikme boyu Özellikler panelinin varyant düğmelerine değil, boy alanına düşer.
  assert.equal(describeModuleVariants(createModuleStateFromCatalogKey('profile_289')), null);
  assert.equal(describeModuleVariants(createModuleStateFromCatalogKey('upright_346_5')), null);
});

test('admin ailesi: başlık, sekme ve etiket kuralı kayıttan okunur; arşivdeki aile ailesiz davranır', (t) => {
  t.after(() => loadCanonicalItemCatalog());
  const rows = [
    { key: 'tv', title: 'Ekran ölçüsü', tabLabel: 'Ekran', cardLabel: 'Televizyon', labelRule: 'width_cm', sortIndex: 1 },
  ];
  initializeVariantFamilyRegistry(rows);
  const variants = describeModuleVariants(createModuleStateFromCatalogKey(listCatalogWidthFamilyItems('tv')[0].itemKey));
  assert.equal(variants.title, 'Ekran ölçüsü');
  assert.equal(variants.tabLabel, 'Ekran');
  assert.ok(variants.options.every((option) => / cm$/.test(option.label)), JSON.stringify(variants.options));
  assert.equal(getCatalogItem(listCatalogWidthFamilyItems('tv').find((item) => item.catalogVisible)?.itemKey)?.label, 'Televizyon');
  // Panel ailesi kayıtta yok (arşiv): üyeleri tek başına öğedir.
  assert.equal(isCatalogWidthFamilyDescriptor({ itemKey: 'wall_100_350' }), false);
  assert.deepEqual(listCatalogWidthFamilyItems('wall-panel'), []);
});

test('bootstrap satırı anahtarsızsa reddedilir', () => {
  assert.throws(() => initializeVariantFamilyRegistry([{ title: 'X' }]), TypeError);
  assert.throws(() => initializeVariantFamilyRegistry(null), TypeError);
  loadCanonicalItemCatalog();
});
