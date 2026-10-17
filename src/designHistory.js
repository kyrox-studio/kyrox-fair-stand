// Tasarım geçmişi: Geri al / İleri al (Ctrl+Z / Ctrl+Y).
// Tasarım = stand (zemin, zemin alanı, renk) + modüller. Proje adı, kamera ve seçim dahil değildir.
// Değişiklikler tek tek yakalanmaz; tasarımın serileştirilmiş hali (imza) karşılaştırılır.
// Böylece sahnenin kendi içinde yaptığı değişiklikler (sürükleme, ok tuşu, renk, görsel)
// da aynı yoldan yakalanır. Geçmiş kaydedilmez; proje değişince sıfırlanır.

export const DESIGN_HISTORY_LIMIT = 50;

/**
 * @param {object} options
 * @param {() => string} options.readSnapshot  Tasarımın serileştirilmiş hali.
 * @param {(snapshot: string) => void} options.applySnapshot  Verilen tasarımı sahneye uygular.
 * @param {number} [options.limit]  Tutulacak en fazla geri alma adımı.
 * @param {(state: {canUndo: boolean, canRedo: boolean, enabled: boolean}) => void} [options.onChange]
 */
export function createDesignHistory({
  readSnapshot,
  applySnapshot,
  limit = DESIGN_HISTORY_LIMIT,
  onChange = () => {},
} = {}) {
  if (typeof readSnapshot !== 'function') throw new TypeError('readSnapshot function is required.');
  if (typeof applySnapshot !== 'function') throw new TypeError('applySnapshot function is required.');
  const maxSteps = Math.max(1, Math.floor(Number(limit) || DESIGN_HISTORY_LIMIT));

  let undoStack = [];
  let redoStack = [];
  let baseline = null;
  let enabled = true;
  let applying = false;

  function state() {
    return {
      canUndo: enabled && undoStack.length > 0,
      canRedo: enabled && redoStack.length > 0,
      enabled,
    };
  }

  function notify() {
    onChange(state());
  }

  /** Geçmişi siler; mevcut tasarım yeni başlangıç olur. */
  function reset() {
    undoStack = [];
    redoStack = [];
    baseline = readSnapshot();
    notify();
  }

  /** Son kontrolden beri tasarım değiştiyse önceki hali bir adım olarak kaydeder. */
  function capture() {
    if (applying) return false;
    const current = readSnapshot();
    if (baseline === null) {
      baseline = current;
      return false;
    }
    if (current === baseline) return false;
    if (enabled) {
      undoStack.push(baseline);
      if (undoStack.length > maxSteps) undoStack.splice(0, undoStack.length - maxSteps);
      redoStack = [];
    }
    baseline = current;
    notify();
    return true;
  }

  function restore(snapshot) {
    applying = true;
    try {
      applySnapshot(snapshot);
    } finally {
      applying = false;
    }
    // Uygulama sırasında yapılan normalizasyon yeni bir adım sayılmasın.
    baseline = readSnapshot();
  }

  function undo() {
    if (!enabled) return false;
    capture();
    if (!undoStack.length) return false;
    const previous = undoStack.pop();
    redoStack.push(baseline);
    restore(previous);
    notify();
    return true;
  }

  function redo() {
    if (!enabled) return false;
    capture();
    if (!redoStack.length) return false;
    const next = redoStack.pop();
    undoStack.push(baseline);
    restore(next);
    notify();
    return true;
  }

  /** Kapalıyken (ör. geçmiş revizyon görünümü) geri/ileri çalışmaz, adım kaydedilmez. */
  function setEnabled(value) {
    const next = Boolean(value);
    if (next === enabled) return;
    enabled = next;
    baseline = readSnapshot();
    if (!enabled) {
      undoStack = [];
      redoStack = [];
    }
    notify();
  }

  return Object.freeze({
    capture,
    undo,
    redo,
    reset,
    setEnabled,
    getState: state,
  });
}
