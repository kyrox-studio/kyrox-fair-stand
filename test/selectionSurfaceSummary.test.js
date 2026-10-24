import test from 'node:test';
import assert from 'node:assert/strict';
import { MIXED, describePartialSupport, summarizeSelectedSurfaces } from '../src/selectionSurfaceSummary.js';

const surface = (userData) => ({ userData });

test('boş seçimde özet yetenek vermez', () => {
  const summary = summarizeSelectedSurfaces([]);
  assert.equal(summary.count, 0);
  assert.deepEqual(summary.support, { color: 'none', image: 'none', glass: 'none', lightbox: 'none', mesh: 'none' });
  assert.equal(describePartialSupport(summary, 'glass', 'cam'), null);
});

test('renk ve görsel yalnız açıkça false olan yüzeyde kapanır; cam/Lightbox/Mesh açıkça true ister', () => {
  const summary = summarizeSelectedSurfaces([
    surface({ moduleId: 'a', acceptsColor: true, acceptsImage: true, acceptsGlass: true }),
    surface({ moduleId: 'a', acceptsImage: false }),
  ]);
  assert.equal(summary.count, 2);
  assert.equal(summary.moduleCount, 1);
  assert.equal(summary.support.color, 'all');
  assert.equal(summary.support.image, 'some');
  assert.equal(summary.support.glass, 'some');
  assert.equal(summary.support.lightbox, 'none');
  assert.match(describePartialSupport(summary, 'glass', 'cam'), /bir kısmı cam desteklemiyor/);
});

test('TV gibi farklı yüzeylerin yetenekleri birbirine karışmaz', () => {
  const screen = summarizeSelectedSurfaces([surface({ moduleId: 'tv', acceptsColor: false, acceptsImage: true })]);
  const body = summarizeSelectedSurfaces([surface({ moduleId: 'tv', acceptsColor: true, acceptsImage: false })]);
  assert.deepEqual([screen.support.color, screen.support.image], ['none', 'all']);
  assert.deepEqual([body.support.color, body.support.image], ['all', 'none']);
});

test('farklı değerler Karışık, aynı değerler ortak değer olarak döner; özet state yazmaz', () => {
  const states = [
    { color: '#FF0000', imageAssetId: 'img-1', isGlass: true },
    { color: '#ff0000', imageAssetId: 'img-2', isGlass: false },
  ];
  const before = JSON.stringify(states);
  const summary = summarizeSelectedSurfaces(states.map((surfaceState, index) => surface({
    moduleId: `m${index}`, acceptsGlass: true, surfaceState,
  })));
  assert.equal(summary.moduleCount, 2);
  assert.equal(summary.color, '#ff0000');
  assert.equal(summary.imageAssetId, MIXED);
  assert.equal(summary.isGlass, MIXED);
  assert.equal(JSON.stringify(states), before);
});

test('kumaş grubundaki yüzeyde görsel kumaş görselinden okunur', () => {
  const summary = summarizeSelectedSurfaces([
    surface({ surfaceState: { fabricGroupId: 'f1', fabricImageAssetId: 'img-9', imageAssetId: 'eski' } }),
  ]);
  assert.equal(summary.imageAssetId, 'img-9');
});
