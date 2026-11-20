import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SELECTION_HINT,
  describeFloorAreaSelection,
  describeFloorSelection,
  describeSurfaceSelection,
} from '../src/selectionFeedback.js';

function surface(userData) {
  return { userData };
}

test('empty selection preserves the default hint and clears foam state', () => {
  assert.deepEqual(describeSurfaceSelection([], []), {
    message: DEFAULT_SELECTION_HINT,
    foamModuleId: null,
    foamControlsVisible: false,
    foamColor: '#ffffff',
  });
});

test('single counter selection preserves face and L-counter wording', () => {
  const feedback = describeSurfaceSelection([
    surface({
      moduleIndex: 1,
      widthCm: 120,
      moduleType: 'counter',
      surfaceRole: 'return',
      counterShape: 'L',
      depthCm: 60,
    }),
  ]);

  assert.equal(
    feedback.message,
    'Modül 2 · Köşe Banko 120×60 · L dönüş cephe · renk + görsel uygulanabilir.',
  );
});

test('illuminated foam selection exposes only the foam UI state main needs', () => {
  const modules = [{
    id: 'foam-1',
    type: 'illuminated-foam',
    widthCm: 210,
    heightCm: 80,
    depthCm: 3.5,
    haloColor: '#aabbcc',
  }];
  const feedback = describeSurfaceSelection([
    surface({ moduleIndex: 0, moduleType: 'illuminated-foam' }),
  ], modules);

  assert.deepEqual(feedback, {
    message: 'Modül 1 · Işıklı Strafor · 210 × 80 cm · 3.5 cm kalınlık · ışık #aabbcc.',
    foamModuleId: 'foam-1',
    foamControlsVisible: true,
    foamColor: '#aabbcc',
  });
});

test('multi-selection keeps counter and mesh group wording', () => {
  const counters = [
    surface({ moduleType: 'counter', widthCm: 100 }),
    surface({ moduleType: 'counter', widthCm: 100 }),
  ];
  assert.equal(
    describeSurfaceSelection(counters).message,
    'Banko 100 cm · 2 panel seçili · renk + görsel toplu uygulanabilir.',
  );

  const mesh = [
    surface({ surfaceState: { fabricGroupId: 'mesh-a', fabricType: 'mesh' } }),
    surface({ surfaceState: { fabricGroupId: 'mesh-a', fabricType: 'mesh' } }),
  ];
  assert.equal(
    describeSurfaceSelection(mesh).message,
    'Tek parça Mesh (Delikli) Branda seçili · renk + görsel uygulanabilir.',
  );
});

test('floor feedback preserves paintable and non-paintable labels', () => {
  assert.equal(describeFloorSelection({ selected: false, floorType: 'hali', paintable: true }), null);
  assert.equal(
    describeFloorSelection({ selected: true, floorType: 'hali', paintable: true }),
    'RIP Halı zemini seçili · mevcut Aktif renk ile boyanabilir.', // DB zemin adı
  );
  assert.equal(
    describeFloorSelection({ selected: true, floorType: 'parke', paintable: false }),
    'Zemin zemini seçili · bu zemin tipi boyanamaz.',
  );
  assert.equal(
    describeFloorAreaSelection({ selected: true, floorType: 'hali', paintable: true }),
    'RIP Halı zemin alanı seçili · mevcut Aktif renk ile boyanabilir.', // DB zemin adı
  );
  assert.equal(
    describeFloorAreaSelection({ selected: true, floorType: 'parke-acik', paintable: false }),
    'Parke - Beyaz Meşe zemin alanı seçili · bu zemin tipi boyanamaz.', // DB zemin adı
  );
});
