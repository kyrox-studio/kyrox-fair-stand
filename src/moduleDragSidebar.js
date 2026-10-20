import { getCatalogItem, listCatalogGroups, getCatalogPreview } from './catalog.js';
import { getModuleDefaultRotationDeg, resolveModuleRotationDeltaDeg } from './moduleBehavior.js';
import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';
import { getItem } from './items.js';
import { createModuleCatalogPreview as renderCatalogItemPreview } from './catalogPreviewRenderer.js';


function ensureStyles() {
  const document = getFairStandHostDocument();
  if (!document?.querySelector) return;
  const existing = document.querySelector('#module-drag-sidebar-styles');
  const style = existing ?? document.createElement('style');
  style.id = 'module-drag-sidebar-styles';
  style.textContent = `
    .module-drag-catalog { display:flex; flex-direction:column; gap:8px; }
    .module-drag-hint { margin:0; color:#7a8494; font-size:10px; line-height:1.45; }
    .module-drag-groups { display:flex; flex-direction:column; gap:7px; }
    .module-drag-group { overflow:hidden; border:1px solid #d9dee5; border-radius:10px; background:#fff; }
    .module-drag-group > summary { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:9px 10px; color:#364152; font-size:11px; font-weight:700; cursor:pointer; user-select:none; list-style:none; }
    .module-drag-group > summary::-webkit-details-marker { display:none; }
    .module-drag-group > summary::after { content:'▸'; color:#7a8494; font-size:12px; transition:transform .15s ease; }
    .module-drag-group[open] > summary::after { transform:rotate(90deg); }
    .module-drag-group[open] > summary { border-bottom:1px solid #e6eaf0; }
    .module-drag-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; padding:7px; }
    .module-drag-card { display:flex; min-width:0; min-height:116px; flex-direction:column; align-items:stretch; justify-content:space-between; gap:7px; padding:8px; border:1px solid #d9dee5; border-radius:10px; background:#f8fafc; color:#364152; cursor:grab; user-select:none; }
    .module-drag-card:hover, .module-drag-card:focus, .module-drag-card:focus-visible { border-color:#f97316; background:#fff8f2; box-shadow:0 0 0 3px rgba(249,115,22,.22); outline:none; }
    .module-drag-card.is-disabled { opacity:.45; cursor:not-allowed; }
    .module-drag-card.is-dragging { opacity:.55; border-color:#f97316; box-shadow:0 0 0 2px rgba(249,115,22,.14); }
    .module-drag-card strong { overflow:hidden; font-size:10px; line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
    .module-drag-preview { display:flex; height:78px; align-items:center; justify-content:center; overflow:hidden; border-radius:7px; background:#fff; }
    .viewport-wrap.catalog-drag-active { outline:2px solid rgba(249,115,22,.2); outline-offset:-2px; }
    .module-drag-card.is-armed { border-color:#f97316; background:#fff3e8; box-shadow:0 0 0 3px rgba(249,115,22,.45); }
    .module-drag-hint.is-armed { color:#c2410c; font-weight:700; }
    .viewport-wrap.catalog-place-armed { outline:3px solid rgba(249,115,22,.55); outline-offset:-3px; }
    .viewport-wrap.catalog-place-armed canvas { cursor:crosshair; }
  `;
  document.head.appendChild(style);
}

export function createModuleCatalogPreview(module) {
  ensureStyles();
  return renderCatalogItemPreview(module, getCatalogPreview);
}

export function createModuleDragSidebar({
  anchorButton,
  viewport,
  canDrag = () => false,
  createModuleState,
  onPreview,
  onDrop,
  onCancel,
} = {}) {
  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  if (!anchorButton?.parentElement || !viewport) return null;
  ensureStyles();

  const root = document.createElement('div');
  root.className = 'module-drag-catalog';

  const hint = document.createElement('p');
  hint.className = 'module-drag-hint';
  const DEFAULT_HINT = 'Kartı sahneye sürükle ya da karta dokunup sahnede yere dokun · Shift+R: saat yönünde döndür · grid modüle göre';
  const ARMED_HINT = 'Yerleştirmek için sahnede yere dokun · aynı kart veya Esc: iptal';
  hint.textContent = DEFAULT_HINT;

  const groupsRoot = document.createElement('div');
  groupsRoot.className = 'module-drag-groups';
  root.append(hint, groupsRoot);
  anchorButton.parentElement.insertBefore(root, anchorButton);

  const groupDefinitions = listCatalogGroups();

  const groupGridByKey = new Map();
  groupDefinitions.forEach((group) => {
    const details = document.createElement('details');
    details.className = 'module-drag-group';
    details.open = false;

    const summary = document.createElement('summary');
    summary.textContent = group.catalogName;

    const grid = document.createElement('div');
    grid.className = 'module-drag-grid';
    details.append(summary, grid);
    groupsRoot.appendChild(details);
    group.keys.forEach((moduleKey) => groupGridByKey.set(moduleKey, grid));
  });

  let enabled = false;
  let activeCard = null;
  let activeModuleState = null;
  let activeRotationZDeg = 0;
  let rotationLocked = false;
  let lastClientX = null;
  let lastClientY = null;
  // Dokunarak ekleme (tablet): karta dokununca kart "yerleştirmeye hazır" olur, sahnede
  // dokunulan nokta sürükleyip bırakmayla aynı önizleme/bırakma yolundan geçer.
  let armed = false;
  let placePointerId = null;
  let suppressNextClick = false;
  // Dışarıdan verilen yerleştirme kaynağı (Kopyala): aynı dokun/tıkla yerleştirme yolu, her
  // bırakışta kaynaktan yeni durum alınır ve Esc / cancelPlacement'a kadar art arda sürer.
  let placementSource = null;

  function resetDragState() {
    const endedSource = placementSource;
    placementSource = null;
    activeCard?.classList.remove('is-dragging', 'is-armed');
    viewport.closest('.viewport-wrap')?.classList.remove('catalog-drag-active', 'catalog-place-armed');
    hint.classList.remove('is-armed');
    hint.textContent = DEFAULT_HINT;
    armed = false;
    placePointerId = null;
    activeCard = null;
    activeModuleState = null;
    activeRotationZDeg = 0;
    rotationLocked = false;
    lastClientX = null;
    lastClientY = null;
    endedSource?.onEnd?.();
  }

  const cards = groupDefinitions
    .flatMap((group) => group.keys)
    .map((moduleKey) => ({ moduleKey, module: getCatalogItem(moduleKey) }))
    .filter((entry) => entry.module)
    .map(({ moduleKey, module }) => {
      const card = document.createElement('div');
      card.className = 'module-drag-card is-disabled';
      card.dataset.moduleKey = moduleKey;
      card.draggable = false;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-disabled', 'true');
      card.title = `${module.label} · sahneye sürükle veya dokunup sahnede yerini seç`;

      const label = document.createElement('strong');
      label.textContent = module.label;
      card.append(createModuleCatalogPreview(module), label);

      card.addEventListener('dragstart', (event) => {
        if (!enabled || !canDrag()) {
          event.preventDefault();
          return;
        }

        const state = createCardState(module, moduleKey);
        if (!state) {
          event.preventDefault();
          return;
        }

        if (armed) {
          resetDragState();
          onCancel?.();
        }
        activeCard = card;
        activeModuleState = state;
        activeRotationZDeg = getModuleDefaultRotationDeg(state);
        rotationLocked = false;
        card.classList.add('is-dragging');
        viewport.closest('.viewport-wrap')?.classList.add('catalog-drag-active');
        event.dataTransfer.effectAllowed = 'copy';
        event.dataTransfer.setData('text/plain', moduleKey);
      });

      card.addEventListener('dragend', () => {
        if (armed) return;
        resetDragState();
        onCancel?.();
      });

      card.addEventListener('click', () => {
        if (!enabled || !canDrag()) return;
        const wasArmedCard = armed && activeCard === card;
        if (armed || activeModuleState) {
          resetDragState();
          onCancel?.();
        }
        if (wasArmedCard) return;
        const state = createCardState(module, moduleKey);
        if (!state) return;
        activeCard = card;
        activeModuleState = state;
        activeRotationZDeg = getModuleDefaultRotationDeg(state);
        rotationLocked = false;
        armed = true;
        card.classList.add('is-armed');
        viewport.closest('.viewport-wrap')?.classList.add('catalog-place-armed');
        hint.classList.add('is-armed');
        hint.textContent = ARMED_HINT;
      });

      const targetGrid = groupGridByKey.get(moduleKey);
      if (!targetGrid) {
        throw new Error(`Module catalog group missing for ${moduleKey}`);
      }
      targetGrid.appendChild(card);
      return card;
    });

  function createCardState(module, moduleKey) {
    const state = createModuleState?.(module, moduleKey);
    // Duvar standın yüksekliğine çevrilir (wall_100_350 kartı → wall_100_300); ana kod kartla aynı olmalı.
    const stateCatalogKey = getItem(state?.itemKey)?.wallHeightBaseItemKey ?? state?.itemKey;
    if (!state || stateCatalogKey !== moduleKey) return null;
    return state;
  }

  // Yerleştirme dokunuşu sahneye (seçim, kamera) gitmez: capture fazında yakalanır.
  viewport.addEventListener('pointerdown', (event) => {
    if (!armed || event.button !== 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    placePointerId = event.pointerId;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    onPreview?.(activeModuleState, event.clientX, event.clientY, activeRotationZDeg, rotationLocked);
  }, { capture: true });

  // Farede imleç gezerken önizleme gösterilir (dokunmatikte hover yok).
  viewport.addEventListener('pointermove', (event) => {
    if (!armed || (placePointerId === null && event.pointerType !== 'mouse')) return;
    if (placePointerId !== null && event.pointerId !== placePointerId) return;
    event.stopImmediatePropagation();
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    onPreview?.(activeModuleState, event.clientX, event.clientY, activeRotationZDeg, rotationLocked);
  }, { capture: true });

  viewport.addEventListener('pointerup', (event) => {
    if (!armed || placePointerId === null || event.pointerId !== placePointerId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (placementSource) {
      const source = placementSource;
      placePointerId = null;
      suppressNextClick = true;
      source.onPlace?.(activeModuleState, event.clientX, event.clientY, activeRotationZDeg, rotationLocked);
      onCancel?.();
      if (placementSource !== source) return;
      const next = source.createState?.();
      if (next) {
        activeModuleState = next;
      } else {
        resetDragState();
      }
      return;
    }
    const state = activeModuleState;
    const rotationZDeg = activeRotationZDeg;
    const isRotationLocked = rotationLocked;
    const catalogKey = activeCard?.dataset.moduleKey ?? state?.itemKey ?? null;
    resetDragState();
    suppressNextClick = true;
    onDrop?.(state, event.clientX, event.clientY, rotationZDeg, isRotationLocked, catalogKey);
  }, { capture: true });

  viewport.addEventListener('click', (event) => {
    if (!suppressNextClick) return;
    suppressNextClick = false;
    event.stopImmediatePropagation();
  }, { capture: true });

  viewport.addEventListener('dragover', (event) => {
    if (!activeModuleState) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    onPreview?.(
      activeModuleState,
      event.clientX,
      event.clientY,
      activeRotationZDeg,
      rotationLocked,
    );
  });

  viewport.addEventListener('drop', (event) => {
    if (!activeModuleState) return;
    event.preventDefault();
    const state = activeModuleState;
    const rotationZDeg = activeRotationZDeg;
    const isRotationLocked = rotationLocked;
    const catalogKey = activeCard?.dataset.moduleKey ?? state?.itemKey ?? null;
    resetDragState();
    onDrop?.(state, event.clientX, event.clientY, rotationZDeg, isRotationLocked, catalogKey);
  });

  viewport.addEventListener('dragleave', (event) => {
    if (!activeModuleState) return;
    if (event.relatedTarget && viewport.contains(event.relatedTarget)) return;
    onCancel?.();
  });

  window.addEventListener('keydown', (event) => {
    if (armed && event.key === 'Escape') {
      resetDragState();
      onCancel?.();
      return;
    }
    const isShiftR = activeModuleState
      && String(event.key).toLowerCase() === 'r'
      && event.shiftKey
      && !event.ctrlKey
      && !event.metaKey
      && !event.altKey;
    if (!isShiftR) return;
    event.preventDefault();
    const deltaDeg = resolveModuleRotationDeltaDeg(activeModuleState, -90);
    // Katalog sürükleme, mevcut modül sürükleme ve durağan seçim aynı dönüş politikasını paylaşır.
    // Geçerli önizleme geçersiz/kırmızı olsa bile istenen açıyı ilerletmeye devam et.
    activeRotationZDeg = ((activeRotationZDeg + deltaDeg) % 360 + 360) % 360;
    rotationLocked = true;
    if (Number.isFinite(lastClientX) && Number.isFinite(lastClientY)) {
      onPreview?.(
        activeModuleState,
        lastClientX,
        lastClientY,
        activeRotationZDeg,
        rotationLocked,
      );
    }
  });

  function armPlacement(source) {
    if (!enabled || !canDrag() || !source) return false;
    if (armed || activeModuleState) {
      resetDragState();
      onCancel?.();
    }
    const state = source.createState?.();
    if (!state) return false;
    const preferredRotation = Number(source.rotationZDeg);
    placementSource = source;
    activeModuleState = state;
    activeRotationZDeg = Number.isFinite(preferredRotation)
      ? preferredRotation
      : getModuleDefaultRotationDeg(state);
    rotationLocked = false;
    armed = true;
    viewport.closest('.viewport-wrap')?.classList.add('catalog-place-armed');
    hint.classList.add('is-armed');
    hint.textContent = source.hint ?? ARMED_HINT;
    return true;
  }

  function cancelPlacement() {
    if (!placementSource) return;
    resetDragState();
    onCancel?.();
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    if (!enabled && armed) {
      resetDragState();
      onCancel?.();
    }
    cards.forEach((card) => {
      card.draggable = enabled;
      card.classList.toggle('is-disabled', !enabled);
      card.setAttribute('aria-disabled', String(!enabled));
    });
  }

  return {
    setEnabled,
    armPlacement,
    cancelPlacement,
    isPlacementArmed: () => Boolean(placementSource),
  };
}
