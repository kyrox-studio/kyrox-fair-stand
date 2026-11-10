import test from 'node:test';
import assert from 'node:assert/strict';
import { isSvgAsset, sortAssetsForLibrary } from '../src/assetLibraryOrder.js';

test('SVG tipi veya .svg uzantısı SVG sayılır', () => {
  assert.equal(isSvgAsset({ name: 'logo.SVG' }), true);
  assert.equal(isSvgAsset({ name: 'logo', blob: { type: 'image/svg+xml' } }), true);
  assert.equal(isSvgAsset({ name: 'logo.jpg', blob: { type: 'image/jpeg' } }), false);
});

test('arşivde SVG dosyaları üstte, her grup ada göre sıralı', () => {
  const assets = [
    { name: 'zeytin.jpg', createdAt: 1 },
    { name: 'Simes.svg', createdAt: 2 },
    { name: '3dm.jpg', createdAt: 3 },
    { name: 'çiçek.png', createdAt: 4 },
    { name: '3DM.svg', createdAt: 5 },
    { name: 'logo10.png', createdAt: 6 },
    { name: 'logo2.png', createdAt: 7 },
  ];
  assert.deepEqual(sortAssetsForLibrary(assets).map((asset) => asset.name), [
    '3DM.svg', 'Simes.svg',
    '3dm.jpg', 'çiçek.png', 'logo2.png', 'logo10.png', 'zeytin.jpg',
  ]);
});

test('aynı adda eski yüklenen önce gelir', () => {
  const assets = [{ name: 'a.png', createdAt: 9, id: 'yeni' }, { name: 'a.png', createdAt: 1, id: 'eski' }];
  assert.deepEqual(sortAssetsForLibrary(assets).map((asset) => asset.id), ['eski', 'yeni']);
});

test('arşiv araması adda geçen kelimeleri Türkçe harf kuralıyla bulur', async () => {
  const { assetMatchesQuery } = await import('../src/assetLibraryOrder.js');
  assert.equal(assetMatchesQuery({ name: 'İstanbul Logo.svg' }, 'istanbul'), true);
  assert.equal(assetMatchesQuery({ name: 'simes_logo.jpg' }, 'LOGO simes'), true);
  assert.equal(assetMatchesQuery({ name: 'simes_logo.jpg' }, 'svg'), false);
  assert.equal(assetMatchesQuery({ name: 'simes_logo.jpg' }, '   '), true);
});
