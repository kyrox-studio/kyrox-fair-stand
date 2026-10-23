// Sağ altta üst üste dizilen kısa bildirimler. Kullanıcının işini etkileyen her hata buradan
// görünür (konsola da yazılır); bilgi ve başarı mesajları da aynı yolu kullanabilir.
// Aynı metin kısa süre içinde tekrar gelirse yeni kutu açılmaz, mevcut kutunun süresi yenilenir.

export const TOAST_KINDS = Object.freeze(['error', 'info', 'success']);
export const TOAST_MAX_VISIBLE = 4;
export const TOAST_DEFAULT_DURATION_MS = Object.freeze({ error: 6000, info: 4000, success: 4000 });

let stack = null;
const active = new Map();

function normalizeMessage(message) {
  return String(message ?? '').replace(/\s+/g, ' ').trim();
}

function ensureStack() {
  if (stack?.isConnected) return stack;
  stack = document.createElement('div');
  stack.className = 'toast-stack';
  stack.setAttribute('aria-live', 'polite');
  stack.setAttribute('aria-atomic', 'false');
  document.body.appendChild(stack);
  return stack;
}

function removeToast(text) {
  const entry = active.get(text);
  if (!entry) return;
  window.clearTimeout(entry.timer);
  entry.element.remove();
  active.delete(text);
}

function scheduleRemoval(text, durationMs) {
  const entry = active.get(text);
  if (!entry) return;
  window.clearTimeout(entry.timer);
  entry.timer = durationMs > 0 ? window.setTimeout(() => removeToast(text), durationMs) : null;
}

/**
 * Bildirim gösterir. DOM yoksa (Node testleri) sessizce hiçbir şey yapmaz.
 * @returns {boolean} gösterildi ya da süresi yenilendiyse true
 */
export function showToast(message, { kind = 'error', durationMs } = {}) {
  const text = normalizeMessage(message);
  if (!text || typeof document === 'undefined' || !document.body) return false;
  const toastKind = TOAST_KINDS.includes(kind) ? kind : 'error';
  const duration = Number.isFinite(durationMs) ? durationMs : TOAST_DEFAULT_DURATION_MS[toastKind];

  if (active.has(text)) {
    scheduleRemoval(text, duration);
    return true;
  }

  const container = ensureStack();
  const element = document.createElement('div');
  element.className = `toast toast--${toastKind}`;
  element.setAttribute('role', toastKind === 'error' ? 'alert' : 'status');

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = toastKind === 'error' ? '!' : (toastKind === 'success' ? '✓' : 'i');

  const body = document.createElement('span');
  body.className = 'toast__text';
  body.textContent = text;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'toast__close';
  close.setAttribute('aria-label', 'Bildirimi kapat');
  close.textContent = '×';
  close.addEventListener('click', () => removeToast(text));

  element.append(icon, body, close);
  container.appendChild(element);
  active.set(text, { element, timer: null });
  scheduleRemoval(text, duration);

  while (active.size > TOAST_MAX_VISIBLE) {
    removeToast(active.keys().next().value);
  }
  return true;
}

/** Hata: konsola ayrıntısıyla yazar, kullanıcıya bildirim olarak gösterir. */
export function reportError(message, error = null, { warn = console.warn } = {}) {
  if (error == null) warn(message);
  else warn(`${message}:`, error);
  return showToast(message, { kind: 'error' });
}

/** Belirli bir bildirimi kapatır (ör. sürükleme geçerli yere gelince uyarı kalkar). */
export function dismissToast(message) {
  removeToast(normalizeMessage(message));
}

export function clearToasts() {
  for (const text of [...active.keys()]) removeToast(text);
}
