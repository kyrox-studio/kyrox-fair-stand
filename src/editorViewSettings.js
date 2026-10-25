// Editör tercihleri oturumluktur; fiziksel ürün ve proje state'inden bağımsızdır.
// Ölçüler moda bağlı değildir: yalnız Ayarlar → Ölçüleri göster kutusu belirler.
export const EDITOR_VIEW_DEFAULTS = Object.freeze({ measurementsVisible: true });
const EDITOR_MODES = Object.freeze(['simple', 'advanced']);

export function createEditorViewSettings() {
  let mode = 'simple';
  let measurementsVisible = EDITOR_VIEW_DEFAULTS.measurementsVisible;
  function getSnapshot() {
    return { mode, measurementsVisible };
  }
  return {
    getSnapshot,
    setMode(nextMode) {
      if (!EDITOR_MODES.includes(nextMode)) throw new TypeError('Bilinmeyen editör modu.');
      mode = nextMode;
      return getSnapshot();
    },
    setMeasurementsVisible(visible) {
      measurementsVisible = Boolean(visible);
      return getSnapshot();
    },
  };
}
