export function isEditableKeyboardTarget(target) {
  const tagName = String(target?.tagName ?? '').toLowerCase();
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || Boolean(target?.isContentEditable);
}

export function resolveViewKeyboardShortcut(event = {}) {
  const key = String(event.key ?? '').toLowerCase();
  const ctrlOrMeta = Boolean(event.ctrlKey || event.metaKey);
  const shift = Boolean(event.shiftKey);
  const alt = Boolean(event.altKey);

  if (key === 'r' && shift && !ctrlOrMeta && !alt) {
    return Object.freeze({ type: 'rotate', direction: 'clockwise' });
  }
  // Tasarım geçmişi: Ctrl/Cmd+Z geri al; Ctrl/Cmd+Y ve Ctrl/Cmd+Shift+Z ileri al.
  if (ctrlOrMeta && !alt) {
    if (key === 'z') return Object.freeze({ type: shift ? 'redo' : 'undo' });
    if (key === 'y' && !shift) return Object.freeze({ type: 'redo' });
  }
  if (ctrlOrMeta || shift || alt) return null;

  const shortcuts = {
    p: { type: 'projection', mode: 'perspective' },
    o: { type: 'projection', mode: 'orthographic' },
    l: { type: 'view', direction: 'left' },
    r: { type: 'view', direction: 'right' },
    t: { type: 'view', direction: 'top' },
    f: { type: 'view', direction: 'front' },
    h: { type: 'view', direction: 'home' },
  };
  return shortcuts[key] ? Object.freeze({ ...shortcuts[key] }) : null;
}
