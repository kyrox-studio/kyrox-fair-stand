import test from 'node:test';
import assert from 'node:assert/strict';
import { DESIGN_HISTORY_LIMIT, createDesignHistory } from '../src/designHistory.js';

// Sahte tasarım: tek bir değer; readSnapshot onu serileştirir, applySnapshot geri yazar.
function fixture(options = {}) {
  const design = { value: 'a' };
  const changes = [];
  const history = createDesignHistory({
    readSnapshot: () => JSON.stringify(design),
    applySnapshot: (snapshot) => { Object.assign(design, JSON.parse(snapshot)); },
    onChange: (state) => changes.push(state),
    ...options,
  });
  history.reset();
  const set = (value) => { design.value = value; history.capture(); };
  return { design, history, changes, set };
}

test('değişiklik yoksa adım eklenmez; değişince bir adım eklenir', () => {
  const { history, set } = fixture();
  assert.equal(history.capture(), false);
  assert.equal(history.getState().canUndo, false);
  set('b');
  assert.equal(history.getState().canUndo, true);
  assert.equal(history.capture(), false, 'aynı tasarım ikinci kez adım olmaz');
});

test('geri al önceki hale, ileri al sonraki hale döner', () => {
  const { design, history, set } = fixture();
  set('b');
  set('c');
  assert.equal(history.undo(), true);
  assert.equal(design.value, 'b');
  assert.equal(history.undo(), true);
  assert.equal(design.value, 'a');
  assert.equal(history.undo(), false, 'başlangıçtan geriye gidilmez');
  assert.equal(history.redo(), true);
  assert.equal(design.value, 'b');
  assert.equal(history.redo(), true);
  assert.equal(design.value, 'c');
  assert.equal(history.redo(), false);
});

test('geri aldıktan sonra yeni değişiklik ileri al dalını siler', () => {
  const { design, history, set } = fixture();
  set('b');
  set('c');
  history.undo();
  set('x');
  assert.equal(history.getState().canRedo, false);
  history.undo();
  assert.equal(design.value, 'b');
});

test('geri yükleme kendisi yeni adım sayılmaz', () => {
  const { history, set } = fixture();
  set('b');
  history.undo();
  assert.equal(history.capture(), false);
  assert.equal(history.getState().canUndo, false);
  assert.equal(history.getState().canRedo, true);
});

test('geri almadan hemen önce yakalanmamış değişiklik önce kaydedilir', () => {
  const { design, history } = fixture();
  design.value = 'b'; // capture çağrılmadı (ör. sahne içi değişiklik)
  assert.equal(history.undo(), true);
  assert.equal(design.value, 'a');
  assert.equal(history.redo(), true);
  assert.equal(design.value, 'b');
});

test('adım sınırı aşılınca en eski adım düşer', () => {
  const { design, history, set } = fixture({ limit: 3 });
  ['b', 'c', 'd', 'e'].forEach(set);
  let steps = 0;
  while (history.undo()) steps += 1;
  assert.equal(steps, 3);
  assert.equal(design.value, 'b', 'a en eski adım olarak düştü');
});

test('varsayılan sınır 50 adımdır', () => {
  assert.equal(DESIGN_HISTORY_LIMIT, 50);
  const { history, set } = fixture();
  for (let i = 0; i < 60; i += 1) set(`v${i}`);
  let steps = 0;
  while (history.undo()) steps += 1;
  assert.equal(steps, 50);
});

test('reset geçmişi siler, mevcut tasarım başlangıç olur', () => {
  const { design, history, set } = fixture();
  set('b');
  history.reset();
  assert.deepEqual(history.getState(), { canUndo: false, canRedo: false, enabled: true });
  assert.equal(history.undo(), false);
  assert.equal(design.value, 'b');
});

test('kapalıyken geri/ileri çalışmaz ve adım kaydedilmez; açılınca yeni başlangıçtan devam eder', () => {
  const { design, history, set } = fixture();
  set('b');
  history.setEnabled(false);
  assert.equal(history.getState().canUndo, false);
  set('c');
  assert.equal(history.undo(), false);
  assert.equal(design.value, 'c');
  history.setEnabled(true);
  assert.equal(history.getState().canUndo, false);
  set('d');
  history.undo();
  assert.equal(design.value, 'c');
});

test('onChange düğme durumlarını bildirir', () => {
  const { history, changes, set } = fixture();
  set('b');
  assert.deepEqual(changes.at(-1), { canUndo: true, canRedo: false, enabled: true });
  history.undo();
  assert.deepEqual(changes.at(-1), { canUndo: false, canRedo: true, enabled: true });
});

test('readSnapshot ve applySnapshot zorunludur', () => {
  assert.throws(() => createDesignHistory({ applySnapshot: () => {} }), TypeError);
  assert.throws(() => createDesignHistory({ readSnapshot: () => '' }), TypeError);
});
