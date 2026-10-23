// Editör tercihleri oturumluktur; fiziksel ürün ve proje state'inden bağımsızdır.
export const EDITOR_VIEW_DEFAULTS = Object.freeze({
  simple: Object.freeze({ measurementsVisible: false }),
  advanced: Object.freeze({ measurementsVisible: true }),
});

export function createEditorViewSettings() {
  let mode = 'simple';
  const overrides = { simple: {}, advanced: {} };
  function getSnapshot() {
    return { mode, ...EDITOR_VIEW_DEFAULTS[mode], ...overrides[mode] };
  }
  return {
    getSnapshot,
    setMode(nextMode) {
      if (!Object.hasOwn(EDITOR_VIEW_DEFAULTS, nextMode)) throw new TypeError('Bilinmeyen editör modu.');
      mode = nextMode;
      return getSnapshot();
    },
    setMeasurementsVisible(visible) {
      overrides[mode].measurementsVisible = Boolean(visible);
      return getSnapshot();
    },
  };
}
