import test from 'node:test';
import assert from 'node:assert/strict';
import { createRectImageLayout, visualImageColumnItems, surfaceImagePathCm } from '../src/rectImageLayout.js';

function makeGrid({ columns, rows, widths, height = 0.46 }) {
  const items = [];
  for (const moduleIndex of columns) {
    for (const stripIndex of rows) {
      items.push({
        moduleIndex,
        stripIndex,
        width: widths[moduleIndex],
        height,
      });
    }
  }
  return items;
}

test('creates a 3 x 2 grouped image layout with mixed column widths', () => {
  const result = createRectImageLayout(makeGrid({
    columns: [0, 1, 2],
    rows: [2, 3],
    widths: { 0: 1.0, 1: 0.5, 2: 2.0 },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 3);
  assert.equal(result.rowCount, 2);
  assert.equal(result.panelCount, 6);
  assert.ok(Math.abs(result.totalWidth - 3.5) < 1e-9);
  assert.ok(Math.abs(result.totalHeight - 0.92) < 1e-9);

  const bottomLeft = result.entries.find(
    (entry) => entry.moduleIndex === 0 && entry.stripIndex === 2,
  );
  assert.equal(bottomLeft.regionStartX, 0);
  assert.equal(bottomLeft.regionStartY, 0);
  assert.ok(Math.abs(bottomLeft.regionWidth - (1 / 3.5)) < 1e-9);
  assert.equal(bottomLeft.regionHeight, 0.5);

  const topRight = result.entries.find(
    (entry) => entry.moduleIndex === 2 && entry.stripIndex === 3,
  );
  assert.ok(Math.abs(topRight.regionStartX - (1.5 / 3.5)) < 1e-9);
  assert.equal(topRight.regionStartY, 0.5);
  assert.ok(Math.abs(topRight.regionWidth - (2 / 3.5)) < 1e-9);
  assert.equal(topRight.regionHeight, 0.5);
});

test('supports a single vertical column spanning all seven rows', () => {
  const result = createRectImageLayout(makeGrid({
    columns: [4],
    rows: [0, 1, 2, 3, 4, 5, 6],
    widths: { 4: 1.5 },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 1);
  assert.equal(result.rowCount, 7);
  assert.equal(result.panelCount, 7);
});

test('rejects an L-shaped or incomplete selection', () => {
  const result = createRectImageLayout([
    { moduleIndex: 0, stripIndex: 0, width: 1, height: 0.46 },
    { moduleIndex: 1, stripIndex: 0, width: 1, height: 0.46 },
    { moduleIndex: 0, stripIndex: 1, width: 1, height: 0.46 },
  ]);

  assert.equal(result.ok, false);
});

test('a square across neighboring walls stays contiguous when scene indexes have a gap', () => {
  const selected = visualImageColumnItems([
    { mesh: 'a0', moduleId: 'wall-a', moduleIndex: 0, stripIndex: 2, pathCm: 0, planeKey: 'wall:back', width: 1, height: 0.46 },
    { mesh: 'a1', moduleId: 'wall-a', moduleIndex: 0, stripIndex: 3, pathCm: 0, planeKey: 'wall:back', width: 1, height: 0.46 },
    { mesh: 'b0', moduleId: 'wall-b', moduleIndex: 4, stripIndex: 2, pathCm: 100, planeKey: 'wall:back', width: 1, height: 0.46 },
    { mesh: 'b1', moduleId: 'wall-b', moduleIndex: 4, stripIndex: 3, pathCm: 100, planeKey: 'wall:back', width: 1, height: 0.46 },
  ]);
  const result = createRectImageLayout(selected);

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 2);
  assert.equal(result.rowCount, 2);
  assert.equal(result.panelCount, 4);
});

test('a right-wall run continued by a free module stays one rectangle', () => {
  const selected = visualImageColumnItems([
    { moduleId: 'right-200', moduleIndex: 8, stripIndex: 2, pathCm: 0, axis: 'y', crossCm: 900, planeKey: 'wall:right', width: 1.97, height: 0.495 },
    { moduleId: 'right-200', moduleIndex: 8, stripIndex: 3, pathCm: 0, axis: 'y', crossCm: 900, planeKey: 'wall:right', width: 1.97, height: 0.495 },
    { moduleId: 'right-100', moduleIndex: 9, stripIndex: 2, pathCm: 200, axis: 'y', crossCm: 900, planeKey: 'wall:right', width: 0.98, height: 0.495 },
    { moduleId: 'right-100', moduleIndex: 9, stripIndex: 3, pathCm: 200, axis: 'y', crossCm: 900, planeKey: 'wall:right', width: 0.98, height: 0.495 },
    { moduleId: 'free-200', moduleIndex: 11, stripIndex: 2, pathCm: 300, axis: 'y', crossCm: 900, planeKey: 'free:y:900', width: 1.97, height: 0.495 },
    { moduleId: 'free-200', moduleIndex: 11, stripIndex: 3, pathCm: 300, axis: 'y', crossCm: 900, planeKey: 'free:y:900', width: 1.97, height: 0.495 },
  ]);
  const result = createRectImageLayout(selected);

  assert.equal(result.ok, true);
  assert.equal(result.columnCount, 3);
  assert.equal(result.rowCount, 2);
  assert.equal(result.panelCount, 6);
  const left = result.entries.find((entry) => entry.moduleId === 'right-200' && entry.stripIndex === 2);
  assert.equal(left.regionStartX, 0);
});

test('panels on different axes stay on insertion order', () => {
  const selected = visualImageColumnItems([
    { moduleId: 'back', moduleIndex: 0, stripIndex: 2, pathCm: 0, axis: 'x', crossCm: 0, planeKey: 'wall:back', width: 1, height: 0.46 },
    { moduleId: 'right', moduleIndex: 4, stripIndex: 2, pathCm: 0, axis: 'y', crossCm: 900, planeKey: 'wall:right', width: 1, height: 0.46 },
  ]);

  assert.equal(selected[0].moduleIndex, 0);
  assert.equal(selected[1].moduleIndex, 4);
});

test('rejects gaps between selected columns', () => {
  const result = createRectImageLayout([
    { moduleIndex: 0, stripIndex: 0, width: 1, height: 0.46 },
    { moduleIndex: 2, stripIndex: 0, width: 1, height: 0.46 },
  ]);

  assert.equal(result.ok, false);
});

// Gerçek sahne dönüşleriyle eşit olmayan panel genişlikleri ve ters ekleme sırası.
for (const rotationDeg of [0, 90, 180, 270]) {
  for (const back of [false, true]) {
    test(`${rotationDeg} derece ${back ? 'arka' : 'ön'} yüzde görsel yüzün solundan başlar`, async () => {
      const { Group, Mesh, PlaneGeometry, MeshBasicMaterial } = await import('three');
      const vertical = rotationDeg % 180 !== 0;
      const widths = [2, 1, 0.5];
      const items = widths.map((width, index) => {
        const parent = new Group();
        parent.rotation.y = rotationDeg * Math.PI / 180;
        parent.position.set(vertical ? 4 : index * 3, 0, vertical ? index * 3 : 4);
        const surface = new Mesh(new PlaneGeometry(width, 0.5), new MeshBasicMaterial());
        if (back) surface.rotation.y = Math.PI;
        parent.add(surface);
        return { moduleId: `p${index}`, moduleIndex: 7 - index, stripIndex: 0,
          pathCm: surfaceImagePathCm(surface), planeKey: 'same-plane', width, height: 0.5 };
      });
      const layout = createRectImageLayout(visualImageColumnItems(items));
      assert.equal(layout.ok, true);
      const reversed = (rotationDeg === 90 || rotationDeg === 180) !== back;
      const order = reversed ? [2, 1, 0] : [0, 1, 2];
      let widthBefore = 0;
      for (const index of order) {
        const entry = layout.entries.find(item => item.moduleId === `p${index}`);
        assert.ok(Math.abs(entry.regionStartX - widthBefore / 3.5) < 1e-9);
        assert.ok(Math.abs(entry.regionWidth - widths[index] / 3.5) < 1e-9);
        widthBefore += widths[index];
      }
    });
  }
}
