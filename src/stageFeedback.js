export function renderStageResult(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

export function renderWallResult(message, isError = false, warn = console.warn) {
  if (isError) warn(message);
}
