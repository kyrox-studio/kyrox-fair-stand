import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';

// Seçili modülün üstünde küçük işlem çubuğu: Döndür / Kopyala / Sil / Çoklu panel|modül. Diğer işlemler
// öğeye tıklayınca açılan Özellikler panelindedir.
// Sahnede tek öğe mavi, grup/çoklu seçim ortak turuncu kesik sınırla gösterilir.
// Fare ve dokunmatikte aynı çalışır; tablette sağ tık yerine geçer. Konumu sahne bildirir
// (seçili modülün tepe ortası, ekran pikseli); seçim yoksa veya sürüklenirken gizlenir.

const STYLE_ID = 'selection-toolbar-styles';
const activeToolbars = new WeakMap();

function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .selection-toolbar { position: fixed; z-index: 900; display: flex; gap: 4px; padding: 4px;
      border: 1px solid rgba(148, 163, 184, 0.4); border-radius: 12px; background: rgba(255, 255, 255, 0.4);
      backdrop-filter: blur(6px);
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16); user-select: none; touch-action: manipulation; }
    .selection-toolbar[hidden] { display: none; }
    .selection-toolbar button { min-width: 40px; min-height: 40px; padding: 0 10px; border: 0; border-radius: 9px;
      background: transparent; color: #1f2937; font: 600 12px/1 system-ui, sans-serif; cursor: pointer; }
    .selection-toolbar button:hover, .selection-toolbar button:focus-visible { background: #fff3e8; outline: none; }
    .selection-toolbar button[data-selection-action="delete"] { color: #b91c1c; }
    .selection-toolbar button[hidden] { display: none; }
    .selection-toolbar button[data-selection-action="multi"][data-kind="panel"] { color: #1d4ed8; }
    .selection-toolbar button[data-selection-action="multi"][data-kind="module"] { color: #c2410c; }
    .selection-toolbar button[aria-pressed="true"][data-kind="panel"] { background: #2563eb; color: #fff; }
    .selection-toolbar button[aria-pressed="true"][data-kind="module"] { background: #f97316; color: #fff; }
    .selection-toolbar button[data-selection-action="duplicate"][aria-pressed="true"] { background: #f97316; color: #fff; }
    .viewport-wrap.multi-select-panel { outline: 3px solid rgba(37, 99, 235, 0.65); outline-offset: -3px; }
    .viewport-wrap.multi-select-module { outline: 3px solid rgba(249, 115, 22, 0.65); outline-offset: -3px; }
  `;
  document.head.appendChild(style);
}

export function createSelectionToolbar({ onRotate, onDuplicate, onDelete, onMultiSelectChange } = {}) {
  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  if (!document?.body) return { update() {}, element: null };
  activeToolbars.get(document)?.destroy();
  // Önceki editör veya yenilenen modülden body içinde kalan sahipsiz çubukları temizle.
  document.querySelectorAll('.selection-toolbar').forEach((element) => element.remove());
  ensureStyles(document);
  let destroyed = false;

  const bar = document.createElement('div');
  bar.className = 'selection-toolbar';
  bar.hidden = true;
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Seçim işlemleri');
  bar.innerHTML = `
    <button type="button" data-selection-action="rotate" title="Döndür (Shift+R)">⟳ Döndür</button>
    <button type="button" data-selection-action="duplicate" aria-pressed="false" title="Hafızaya al; sahnede dokunduğun her yere bir kopya bırakır (Ctrl+C)">⧉ Kopyala</button>
    <button type="button" data-selection-action="delete" title="Sil">Sil</button>
    <button type="button" data-selection-action="multi" data-kind="module" aria-pressed="false">Çoklu modül</button>
  `;
  document.body.appendChild(bar);

  const multiButton = bar.querySelector('[data-selection-action="multi"]');
  const duplicateButton = bar.querySelector('[data-selection-action="duplicate"]');
  const allButtons = [...bar.querySelectorAll('[data-selection-action]')];
  const handlers = {
    rotate: onRotate,
    duplicate: onDuplicate,
    delete: onDelete,
    multi: () => setMultiSelect(multiSelect ? false : (anchor?.kind === 'panel' ? 'panel' : 'module')),
  };
  const singleOnly = [...bar.querySelectorAll('[data-selection-action]')]
    .filter((button) => !['multi', 'delete'].includes(button.dataset.selectionAction));
  let anchor = null;
  // false | 'panel' (tek seferlik parmak taraması) | 'module' (dokunduğun modülü ekle/çıkar).
  let multiSelect = false;
  // Kopya yerleştirilirken çubuk yalnız "Kopyalamayı bitir" gösterir ve seçim kalkınca da kalır
  // (tablette Esc yok).
  let copyActive = false;

  function syncMultiButton() {
    const kind = multiSelect || (anchor?.kind === 'panel' ? 'panel' : 'module');
    multiButton.dataset.kind = kind;
    multiButton.textContent = kind === 'panel' ? 'Çoklu panel' : 'Çoklu modül';
    multiButton.title = kind === 'panel'
      ? 'Parmağı bir panele koyup kaydır: aradaki paneller seçilir (Ctrl + tık gibi). Tek seferlik.'
      : 'Açıkken dokunduğun modüller seçime eklenir/çıkarılır (Shift + tık gibi).';
    multiButton.setAttribute('aria-pressed', String(Boolean(multiSelect)));
  }

  function setMultiSelect(next, { notify = true } = {}) {
    if (destroyed) return;
    multiSelect = next === 'panel' || next === 'module' ? next : false;
    syncMultiButton();
    if (notify) onMultiSelectChange?.(multiSelect, () => setMultiSelect(false, { notify: false }));
  }

  // Çubuğa basmak sahnedeki seçimi bozmasın (sahne ve menü dışı tıklama dinleyicileri).
  bar.addEventListener('pointerdown', (event) => event.stopPropagation());

  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-selection-action]');
    if (!button || !anchor) return;
    const rect = button.getBoundingClientRect();
    handlers[button.dataset.selectionAction]?.({
      clientX: Math.round(rect.left),
      clientY: Math.round(rect.bottom + 4),
    });
  });

  function setCopyActive(active) {
    if (destroyed) return;
    copyActive = Boolean(active);
    duplicateButton.setAttribute('aria-pressed', String(copyActive));
    duplicateButton.textContent = copyActive ? '✕ Kopyalamayı bitir' : '⧉ Kopyala';
    update(anchor);
  }

  function update(next) {
    if (destroyed) return;
    anchor = next ?? null;
    if (!anchor && !copyActive) {
      bar.hidden = true;
      // Seçim boşalınca (boş alana dokunma, Esc) çoklu seçim modu da kapanır.
      if (multiSelect) setMultiSelect(false);
      return;
    }
    if (copyActive) {
      allButtons.forEach((button) => { button.hidden = button !== duplicateButton; });
      bar.hidden = false;
      if (!anchor) return;
    } else {
      allButtons.forEach((button) => { button.hidden = false; });
      // Toplu seçimde silme ve çoklu modül kullanılabilir; toplu işlemler Özellikler panelindedir.
      singleOnly.forEach((button) => { button.hidden = anchor.count > 1; });
      syncMultiButton();
      bar.hidden = false;
    }
    const margin = 8;
    const width = bar.offsetWidth || 260;
    const height = bar.offsetHeight || 48;
    // Açık Özellikler paneli sağ sınırdır; çubuk panelin üstüne binmez.
    const propertyPanel = document.querySelector('.selection-property-panel:not([hidden])');
    const rightEdge = propertyPanel ? propertyPanel.getBoundingClientRect().left : (window?.innerWidth ?? 1024);
    const left = Math.min(Math.max(margin, anchor.clientX - width / 2), rightEdge - width - margin);
    let top = Math.max(margin, anchor.clientY - height - 14);
    // Üst bant daralsa da seçim işlemleri Kaydet ve diğer ana işlemleri örtmesin.
    const viewportToolbar = document.querySelector('#viewport-toolbar');
    if (viewportToolbar && !viewportToolbar.hidden) {
      const toolbarRect = viewportToolbar.getBoundingClientRect();
      if (left < toolbarRect.right && left + width > toolbarRect.left
        && top < toolbarRect.bottom && top + height > toolbarRect.top) {
        top = toolbarRect.bottom + margin;
      }
    }
    bar.style.left = `${Math.round(left)}px`;
    bar.style.top = `${Math.round(top)}px`;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    bar.remove();
    if (activeToolbars.get(document) === controller) activeToolbars.delete(document);
  }

  const controller = { update, setCopyActive, destroy, element: bar };
  activeToolbars.set(document, controller);
  return controller;
}
