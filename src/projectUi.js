export function setSaveProjectEnabled(button, sceneReady) {
  if (!button) return;
  button.disabled = !sceneReady;
}

export function setButtonBusy(button, busy, busyLabel = null) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    if (busyLabel) button.textContent = busyLabel;
  } else {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    if (button.dataset.idleLabel) button.textContent = button.dataset.idleLabel;
  }
}

export function createProjectLoadingController({
  overlay,
  titleElement,
  detailElement,
  defaultDetail = 'Lütfen bekleyin…',
} = {}) {
  function show(title, detail = defaultDetail) {
    if (titleElement) titleElement.textContent = title;
    if (detailElement) detailElement.textContent = detail;
    if (overlay) overlay.hidden = false;
  }

  function hide() {
    if (overlay) overlay.hidden = true;
  }

  // Ekran açıkken yalnız alt satırı günceller (ör. "45 / 73" ilerlemesi).
  function setDetail(detail) {
    if (detailElement) detailElement.textContent = detail;
  }

  return Object.freeze({ show, hide, setDetail });
}
