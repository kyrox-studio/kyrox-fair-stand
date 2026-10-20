// Otomatik kayıt süresi kullanıcı tarafından dakika olarak seçilir (bkz. autosaveSettings.js).
// 0 dakika "Kapalı" demektir: değişiklik izlenir ve durum yazısı gösterilir, zamanlayıcı kurulmaz.
// Kapalıyken de `isEnabled()` true kalır; bu bayrak "proje en az bir kez kaydedildi" anlamını taşır.
export const DEFAULT_AUTOSAVE_DELAY_MS = 180000;
export const DEFAULT_AUTOSAVE_MAX_WAIT_MS = 180000;
export const DEFAULT_AUTOSAVE_WATCH_INTERVAL_MS = 1000;

let activeAutosaveController = null;

export function getActiveAutosaveController() {
  return activeAutosaveController;
}

function formatWait(waitMs) {
  const seconds = Math.max(1, Math.round(waitMs / 1000));
  if (seconds < 60) return `${seconds} sn`;
  return `${Math.ceil(seconds / 60)} dk`;
}

export function createAutosaveController({
  getSignature,
  persist,
  setStatus = () => {},
  onError = () => {},
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  delayMs = DEFAULT_AUTOSAVE_DELAY_MS,
  maxWaitMs = DEFAULT_AUTOSAVE_MAX_WAIT_MS,
  watchIntervalMs = DEFAULT_AUTOSAVE_WATCH_INTERVAL_MS,
  now = () => Date.now(),
} = {}) {
  if (typeof getSignature !== 'function') throw new TypeError('getSignature function is required.');
  if (typeof persist !== 'function') throw new TypeError('persist function is required.');
  if (typeof setTimeoutFn !== 'function' || typeof clearTimeoutFn !== 'function') {
    throw new TypeError('Timeout functions are required.');
  }
  if (typeof setIntervalFn !== 'function' || typeof clearIntervalFn !== 'function') {
    throw new TypeError('Interval functions are required.');
  }

  let enabled = false;
  let pendingTimer = null;
  let maxWaitDueAt = null;
  let watchTimer = null;
  let observedSignature = null;
  let savedSignature = null;
  let flushPromise = null;
  let currentDelayMs = delayMs;
  let currentMaxWaitMs = maxWaitMs;

  function clearPending() {
    if (pendingTimer !== null) clearTimeoutFn(pendingTimer);
    pendingTimer = null;
  }

  function resetMaxWait() {
    maxWaitDueAt = null;
  }

  function markCurrentState() {
    observedSignature = getSignature();
    return observedSignature;
  }

  function markCurrentStateSaved() {
    savedSignature = markCurrentState();
    return savedSignature;
  }

  async function runScheduledPersist() {
    pendingTimer = null;
    if (!enabled) return;
    resetMaxWait();
    setStatus('Kaydediliyor…');
    try {
      await persist({ quiet: true });
      markCurrentStateSaved();
      setStatus('Kaydedildi · Otomatik');
    } catch (error) {
      onError(error);
      setStatus('Otomatik kayıt başarısız.');
    }
  }

  function isAutoSaveOff() {
    return currentDelayMs <= 0;
  }

  function schedule() {
    if (!enabled) return false;
    clearPending();
    if (isAutoSaveOff()) {
      resetMaxWait();
      setStatus('Kaydedilmemiş değişiklik var · otomatik kayıt kapalı');
      return false;
    }
    if (maxWaitDueAt == null) maxWaitDueAt = now() + currentMaxWaitMs;
    const waitMs = Math.max(0, Math.min(currentDelayMs, maxWaitDueAt - now()));
    setStatus(`Değişiklik var · ${formatWait(waitMs)} içinde otomatik kaydedilecek…`);
    pendingTimer = setTimeoutFn(runScheduledPersist, waitMs);
    return true;
  }

  function checkForChanges() {
    if (!enabled) return false;
    const signature = getSignature();
    if (signature === observedSignature) return false;
    observedSignature = signature;
    schedule();
    return true;
  }

  function startWatching() {
    if (watchTimer !== null) return;
    watchTimer = setIntervalFn(checkForChanges, watchIntervalMs);
  }

  function stopWatching() {
    if (watchTimer !== null) clearIntervalFn(watchTimer);
    watchTimer = null;
  }

  function enableFromCurrentState() {
    clearPending();
    resetMaxWait();
    markCurrentStateSaved();
    enabled = true;
    startWatching();
  }

  function disable() {
    enabled = false;
    clearPending();
    resetMaxWait();
    observedSignature = null;
    savedSignature = null;
    stopWatching();
  }

  function markSavedState() {
    clearPending();
    resetMaxWait();
    return markCurrentStateSaved();
  }

  function isEnabled() {
    return enabled;
  }

  function hasUnsavedChanges() {
    if (!enabled) return false;
    return getSignature() !== savedSignature;
  }

  // Dakika: 0 kapalı; pozitif değer hem son değişiklikten sonraki bekleme hem de
  // sürekli düzenlemede en uzun bekleme olur.
  function setDelayMinutes(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 0) throw new RangeError('Autosave minutes must be a non-negative number.');
    currentDelayMs = value * 60000;
    currentMaxWaitMs = value * 60000;
    clearPending();
    resetMaxWait();
    if (enabled && observedSignature !== savedSignature) schedule();
  }

  function getDelayMinutes() {
    return currentDelayMs / 60000;
  }

  async function flush({ quiet = true } = {}) {
    clearPending();
    resetMaxWait();
    if (flushPromise) return flushPromise;

    flushPromise = (async () => {
      const result = await persist({ quiet });
      if (!result || result.enableAutosave !== false) enableFromCurrentState();
      return true;
    })();

    try {
      return await flushPromise;
    } finally {
      flushPromise = null;
    }
  }

  // Sekme gizlenirken veya editör kapanırken: yalnız kaydedilmemiş değişiklik varsa kaydeder.
  // Otomatik kayıt kapalıyken çalışmaz (yalnız Kaydet kaydeder); denetleyiciyi yeniden açmaz.
  async function saveNowIfDirty() {
    if (isAutoSaveOff() || !hasUnsavedChanges()) return false;
    if (flushPromise) {
      await flushPromise;
      return true;
    }
    clearPending();
    resetMaxWait();
    try {
      await persist({ quiet: true });
      if (enabled) markCurrentStateSaved();
      setStatus('Kaydedildi · Otomatik');
      return true;
    } catch (error) {
      onError(error);
      setStatus('Otomatik kayıt başarısız.');
      return false;
    }
  }

  const controller = Object.freeze({
    isAutoSaveOff,
    checkForChanges,
    clearPending,
    disable,
    enableFromCurrentState,
    flush,
    getDelayMinutes,
    hasUnsavedChanges,
    isEnabled,
    markSavedState,
    saveNowIfDirty,
    schedule,
    setDelayMinutes,
  });
  activeAutosaveController = controller;
  return controller;
}
