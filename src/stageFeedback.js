import { showToast } from './toastNotifications.js';

// Hata mesajları sağ alt bildirim olarak da görünür (toastNotifications.js).
export function renderStageResult(element, message, isError = false, notify = showToast) {
  element.textContent = message;
  element.classList.toggle('error', isError);
  if (isError) notify(message, { kind: 'error' });
}

export function renderWallResult(message, isError = false, warn = console.warn, notify = showToast) {
  if (!isError) return;
  warn(message);
  notify(message, { kind: 'error' });
}
