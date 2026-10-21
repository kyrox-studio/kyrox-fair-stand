import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/scene3d.js', import.meta.url), 'utf8');
const start = source.indexOf('function createLCounterModule');
const end = source.indexOf('function createShelfModule', start);
const block = source.slice(start, end);

test('L counter short side panels close the two outer arm ends parametrically', () => {
  assert.match(block, /new THREE\.Vector3\(-widthM\/2,lowerY,-depthM\/2\+armM\/2\),-Math\.PI\/2\)/);
  assert.match(block, /new THREE\.Vector3\(widthM\/2-armM\/2,lowerY,depthM\/2\),0\)/);
  assert.doesNotMatch(block, /new THREE\.Vector3\(-0\.25,lowerY,0\),0/);
});

test('L counter side posts use the same profile inset clearance for every size', () => {
  assert.match(block, /\[widthM \/ 2 - armM \+ profileM \/ 2, depthM \/ 2 - profileM \/ 2\]/);
  assert.match(block, /\[-widthM \/ 2 \+ profileM \/ 2, -depthM \/ 2 \+ armM - profileM \/ 2\]/);
  assert.doesNotMatch(block, /\[0,0\.5\]/);
  assert.doesNotMatch(block, /\[-0\.5,0\]/);
});

test('L counter front image surfaces face outward instead of exposing PlaneGeometry backs', () => {
  assert.match(block, /frontLower,frontPanelM,new THREE\.Vector3\(0,lowerY,-depthM\/2\),Math\.PI\)/);
  assert.match(block, /frontUpper,frontPanelM,new THREE\.Vector3\(0,upperY,-depthM\/2\),Math\.PI\)/);
  // Yüz dışa bakar: dışa yön yüzün dönüşünden gelir, yüz bu yönde profilin önüne alınır.
  assert.match(block, /const outward = new THREE\.Vector3\(Math\.round\(Math\.sin\(rotationY\)\), 0, Math\.round\(Math\.cos\(rotationY\)\)\);/);
  assert.match(block, /placeBoxPanelFace\(backing, surface, anchor, outward, backingDepth\);/);
  assert.doesNotMatch(block, /frontLower,frontPanelM,new THREE\.Vector3\(0,lowerY,-depthM\/2\),0\)/);
});
