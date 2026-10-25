import test from 'node:test';
import assert from 'node:assert/strict';
import { planAutomaticDepot } from '../src/autoDepot.js';
import { AUTO_FURNITURE_ITEM_KEYS, planAutomaticFurniture } from '../src/autoFurniture.js';
import { isVerticalModuleRotation } from '../src/modulePlacement.js';

function footprint(spec) {
  const { xCm, yCm, rotationZDeg } = spec.placement;
  if (isVerticalModuleRotation(rotationZDeg)) {
    return { minX: xCm - spec.depthCm / 2, maxX: xCm + spec.depthCm / 2, minY: yCm, maxY: yCm + spec.widthCm };
  }
  return { minX: xCm, maxX: xCm + spec.widthCm, minY: yCm - spec.depthCm / 2, maxY: yCm + spec.depthCm / 2 };
}

function overlaps(a, b) {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}

function assertLayoutValid(plan, standX, standY, depot = null) {
  assert.equal(plan.ok, true);
  const rects = plan.specs.map(footprint);
  for (const rect of rects) {
    assert.ok(rect.minX >= 0 && rect.minY >= 0 && rect.maxX <= standX && rect.maxY <= standY, 'stand içinde');
    if (depot) {
      const depotRect = {
        minX: depot.originXCm, maxX: depot.originXCm + depot.widthCm,
        minY: depot.originYCm, maxY: depot.originYCm + depot.depthCm,
      };
      assert.equal(overlaps(rect, depotRect), false, 'depoyla çakışmaz');
    }
  }
  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      assert.equal(overlaps(rects[i], rects[j]), false, `${plan.specs[i].role} / ${plan.specs[j].role}`);
    }
  }
}

test('6 × 3 m sırt duvar: beş öğenin hepsi gelir, katalog itemKey ile', () => {
  const plan = planAutomaticFurniture({ standXCm: 600, standYCm: 300 });
  assertLayoutValid(plan, 600, 300);
  assert.deepEqual(plan.skipped, []);
  assert.deepEqual(
    plan.specs.map((spec) => spec.itemKey).sort(),
    Object.values(AUTO_FURNITURE_ITEM_KEYS).sort(),
  );
  assert.ok(plan.specs.every((spec) => spec.placement.wallId === 'free'));
});

test('banko ön cephede, tabure hemen arkasında; çiçek sağ önde', () => {
  const plan = planAutomaticFurniture({ standXCm: 600, standYCm: 300 });
  const byRole = Object.fromEntries(plan.specs.map((spec) => [spec.role, footprint(spec)]));
  assert.equal(byRole.counter.maxY, 270);
  assert.ok(byRole.stool.maxY <= byRole.counter.minY);
  assert.ok(byRole.counter.minY - byRole.stool.maxY <= 10);
  const counterCenter = (byRole.counter.minX + byRole.counter.maxX) / 2;
  assert.equal((byRole.stool.minX + byRole.stool.maxX) / 2, counterCenter);
  assert.equal(byRole.plant.maxX, 570);
  assert.ok(byRole.tableSet.minY < byRole.counter.minY);
});

test('depo varken hiçbir mobilya depoya girmez', () => {
  for (const standType of ['back-wall', 'u-stand', 'l-left', 'l-right', 'island']) {
    for (const sizeKey of ['100x100', '200x200']) {
      const depot = planAutomaticDepot({ standType, standXCm: 500, standYCm: 400, sizeKey });
      const plan = planAutomaticFurniture({ standXCm: 500, standYCm: 400, depot });
      assertLayoutValid(plan, 500, 400, depot);
    }
  }
});

test('küçük stand: sığmayan öğe atlanır, kalanlar çakışmaz', () => {
  const plan = planAutomaticFurniture({ standXCm: 200, standYCm: 200 });
  assertLayoutValid(plan, 200, 200);
  assert.ok(plan.skipped.length > 0);
});

test('geçersiz stand ölçüsü reddedilir', () => {
  assert.equal(planAutomaticFurniture({ standXCm: 0, standYCm: 300 }).ok, false);
});
