import { getCatalogItem, getModuleCatalogLabel, listCatalogGroups } from './catalog.js';
import { createModuleCatalogPreview } from './moduleDragSidebar.js';
import { getModuleBehavior } from './moduleBehavior.js';
import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';

export function allowsModuleSideInsert(context) {
  const type = typeof context === 'string'
    ? context
    : (context?.type ?? context?.moduleType);
  return getModuleBehavior({ ...(context && typeof context === 'object' ? context : {}), type }).allowSideInsert !== false;
}


export function resolveModuleSidePlacement(context, visualSide) {
  if (visualSide !== 'left' && visualSide !== 'right') return visualSide;
  const wallId = context?.placement?.wallId ?? 'back';
  if (wallId !== 'right') return visualSide;
  return visualSide === 'left' ? 'right' : 'left';
}

export function createModuleContextMenu({
  onDelete,
  onResize,
  onImageResize,
  onAdd,
  onValidateAddBatch,
  onGlassModeChange,
  onMetalSeparatorModeChange,
  onFabricModeChange,
  onMeshModeChange,
  onFabricLightingChange,
  getShelfLightingState,
  onShelfLightingChange,
  onLockChange,
  onGroupAction,
  onRotate,
}) {
  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  let activeContext = null;
  let pickerRequest = null;
  let selectedModuleKeys = [];
  let draggedSelectionIndex = null;
  let suppressChipClick = false;

  const menu = document.createElement('div');
  menu.className = 'module-context-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Modül işlemleri');
  menu.innerHTML = `
    <div class="module-context-title"></div>
    <button type="button" role="menuitem" data-module-action="group-create" hidden>Grup oluştur…</button>
    <button type="button" role="menuitem" data-module-action="group-add" hidden>Gruba ekle</button>
    <button type="button" role="menuitem" data-module-action="group-rename" hidden>Grubu yeniden adlandır…</button>
    <button type="button" role="menuitem" data-module-action="group-lock" hidden>Grubu kilitle</button>
    <button type="button" role="menuitem" data-module-action="group-duplicate" hidden>Grubu çoğalt</button>
    <button type="button" role="menuitem" data-module-action="group-remove-member" hidden>Bu parçayı gruptan çıkar</button>
    <button type="button" role="menuitem" data-module-action="group-dissolve" hidden>Grubu çöz</button>
    <button type="button" role="menuitem" data-module-action="group-delete" class="danger" hidden>Grubu sil</button>
    <div class="module-context-separator module-context-group-separator" hidden></div>
    <button type="button" role="menuitem" data-module-action="toggle-lock">Kilitle</button>
    <button type="button" role="menuitem" data-module-action="lock-selection" hidden>Seçilenleri kilitle</button>
    <button type="button" role="menuitem" data-module-action="unlock-selection" hidden>Seçilenlerin kilidini aç</button>
    <button type="button" role="menuitem" data-module-action="rotate">Döndür</button>
    <button type="button" role="menuitem" data-module-action="delete" class="danger">Sil</button>
    <button type="button" role="menuitem" data-module-action="resize-foam" hidden>Boyutlandır…</button>
    <button type="button" role="menuitem" data-module-action="resize-image" hidden>Görseli ölçülendir…</button>
    <div class="module-context-separator"></div>
    <button type="button" role="menuitem" data-module-action="toggle-shelf-light" hidden>Raf altı aydınlatmayı aç</button>
    <button type="button" role="menuitem" data-module-action="add-right">Ekle Sağ Tarafa…</button>
    <button type="button" role="menuitem" data-module-action="add-left">Ekle Sol Tarafa…</button>
    <button type="button" role="menuitem" class="module-context-advanced-toggle" aria-expanded="false" hidden>Gelişmiş ▸</button>
    <div class="module-context-advanced" hidden>
      <button type="button" role="menuitem" data-module-action="toggle-glass" hidden>Cam Panele Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-metal-separator" hidden>Metal Separatöre Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-fabric" hidden>Lightbox Kumaşa Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-mesh" hidden>Mesh (Delikli) Brandaya Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-fabric-light" hidden>Lightbox aydınlatmayı aç</button>
    </div>
  `;
  document.body.appendChild(menu);

  const pickerBackdrop = document.createElement('div');
  pickerBackdrop.className = 'module-picker-backdrop';
  pickerBackdrop.hidden = true;
  pickerBackdrop.innerHTML = `
    <div class="module-picker" role="dialog" aria-modal="true" aria-labelledby="module-picker-title">
      <div class="module-picker-header">
        <div>
          <p class="module-picker-eyebrow">MODÜL KATALOĞU</p>
          <h3 id="module-picker-title">Modül Ekle</h3>
          <p class="module-picker-context"></p>
        </div>
        <button type="button" class="module-picker-close" aria-label="Kapat">×</button>
      </div>
      <div class="module-picker-groups module-drag-groups" role="listbox" aria-label="Modül kataloğu"></div>
      <div class="module-picker-selection" style="margin-top:12px;padding:10px 12px;border:1px solid #e2e7ed;border-radius:12px;background:#f8fafc;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
          <strong style="font-size:12px;color:#374151;">Seçim sırası</strong>
          <button type="button" class="module-picker-selection-clear" style="min-width:0;padding:5px 8px;border:0;background:transparent;color:#667085;font-size:11px;">Temizle</button>
        </div>
        <p class="module-picker-selection-empty" style="margin:6px 0 0;color:#8a94a3;font-size:11px;">Kartlara tıklayarak modülleri sıraya ekle.</p>
        <div class="module-picker-selection-list" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:7px;"></div>
      </div>
      <div class="module-picker-footer">
        <button type="button" class="module-picker-cancel ghost">Vazgeç</button>
        <button type="button" class="module-picker-add primary" disabled>Ekle</button>
      </div>
    </div>
  `;
  document.body.appendChild(pickerBackdrop);

  const title = menu.querySelector('.module-context-title');
  const glassModeButton = menu.querySelector('[data-module-action="toggle-glass"]');
  const metalSeparatorButton = menu.querySelector('[data-module-action="toggle-metal-separator"]');
  const fabricModeButton = menu.querySelector('[data-module-action="toggle-fabric"]');
  const meshModeButton = menu.querySelector('[data-module-action="toggle-mesh"]');
  const fabricLightingButton = menu.querySelector('[data-module-action="toggle-fabric-light"]');
  const shelfLightingButton = menu.querySelector('[data-module-action="toggle-shelf-light"]');
  const foamResizeButton = menu.querySelector('[data-module-action="resize-foam"]');
  const imageResizeButton = menu.querySelector('[data-module-action="resize-image"]');
  const addRightButton = menu.querySelector('[data-module-action="add-right"]');
  const addLeftButton = menu.querySelector('[data-module-action="add-left"]');
  const lockButton = menu.querySelector('[data-module-action="toggle-lock"]');
  const lockSelectionButton = menu.querySelector('[data-module-action="lock-selection"]');
  const unlockSelectionButton = menu.querySelector('[data-module-action="unlock-selection"]');
  const deleteButton = menu.querySelector('[data-module-action="delete"]');
  const rotateButton = menu.querySelector('[data-module-action="rotate"]');
  const separator = menu.querySelector('.module-context-separator:not(.module-context-group-separator)');
  const groupSeparator = menu.querySelector('.module-context-group-separator');
  // Sade menü: sık kullanılanlar görünür; panel dönüşümleri (Cam, Metal Separatör, Lightbox, Mesh)
  // "Gelişmiş" altında. Açık/kapalı tercihi oturum boyunca hatırlanır.
  const advancedToggle = menu.querySelector('.module-context-advanced-toggle');
  const advancedSection = menu.querySelector('.module-context-advanced');
  const advancedButtons = [...advancedSection.querySelectorAll('[data-module-action]')];
  let advancedExpanded = false;

  function syncAdvancedSection() {
    const hasAdvanced = advancedButtons.some((button) => !button.hidden);
    advancedToggle.hidden = !hasAdvanced;
    advancedToggle.setAttribute('aria-expanded', String(advancedExpanded));
    advancedToggle.textContent = advancedExpanded ? 'Gelişmiş ▾' : 'Gelişmiş ▸';
    advancedSection.hidden = !hasAdvanced || !advancedExpanded;
  }
  const groupButtons = Object.fromEntries(
    [...menu.querySelectorAll('[data-module-action^="group-"]')].map((button) => [button.dataset.moduleAction, button]),
  );
  const LOCKED_HINT = 'Kilitli öğe: önce kilidi açın.';
  const GROUP_LOCKED_HINT = 'Grup kilitli: önce grubun kilidini açın.';

  function setDisabled(button, disabled, hint = LOCKED_HINT) {
    button.disabled = Boolean(disabled);
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    if (disabled) button.title = hint;
    else button.removeAttribute('title');
  }

  function hideGroupButtons() {
    Object.values(groupButtons).forEach((button) => {
      button.hidden = true;
      setDisabled(button, false);
    });
    groupSeparator.hidden = true;
  }

  // Tek öğe: öğe bir gruptaysa grup komutları en üstte gösterilir.
  function showSingleGroupSection(group) {
    hideGroupButtons();
    if (!group) return;
    const locked = group.locked === true;
    ['group-rename', 'group-lock', 'group-duplicate', 'group-remove-member', 'group-dissolve', 'group-delete']
      .forEach((action) => { groupButtons[action].hidden = false; });
    groupButtons['group-lock'].textContent = locked ? 'Grubun kilidini aç' : 'Grubu kilitle';
    ['group-remove-member', 'group-dissolve', 'group-delete']
      .forEach((action) => setDisabled(groupButtons[action], locked, GROUP_LOCKED_HINT));
    groupSeparator.hidden = false;
  }

  // Toplu seçim: grup kurma ve tek bir gruba ekleme.
  function showMultiGroupSection(options) {
    hideGroupButtons();
    if (!options) return;
    groupButtons['group-create'].hidden = options.canCreate !== true;
    const target = options.addTarget;
    groupButtons['group-add'].hidden = !target;
    if (target) {
      groupButtons['group-add'].textContent = `Gruba ekle: ${target.name}`;
      setDisabled(groupButtons['group-add'], target.locked === true, GROUP_LOCKED_HINT);
    }
    groupSeparator.hidden = groupButtons['group-create'].hidden && groupButtons['group-add'].hidden;
  }

  // Toplu seçim menüsü: yalnız toplu kilit komutları; tek öğe komutları gizlenir.
  function openMultiSelection(context) {
    const ids = context.multiModuleIds;
    const lockedCount = Number(context.multiLockedCount) || 0;
    title.textContent = `${ids.length} öğe seçili${lockedCount ? ` · ${lockedCount} kilitli` : ''}`;
    [...menu.querySelectorAll('[data-module-action]')].forEach((button) => {
      button.hidden = true;
    });
    separator.hidden = true;
    syncAdvancedSection();
    lockSelectionButton.hidden = lockedCount >= ids.length;
    unlockSelectionButton.hidden = lockedCount === 0;
    showMultiGroupSection(context.groupOptions);
  }
  const pickerTitle = pickerBackdrop.querySelector('#module-picker-title');
  const pickerContext = pickerBackdrop.querySelector('.module-picker-context');
  const pickerGroups = pickerBackdrop.querySelector('.module-picker-groups');
  const pickerAddButton = pickerBackdrop.querySelector('.module-picker-add');
  const pickerSelectionList = pickerBackdrop.querySelector('.module-picker-selection-list');
  const pickerSelectionEmpty = pickerBackdrop.querySelector('.module-picker-selection-empty');
  const pickerSelectionClear = pickerBackdrop.querySelector('.module-picker-selection-clear');

  function describeModule(context) {
    return getModuleCatalogLabel(context);
  }

  function getSelectionCounts() {
    const counts = new Map();
    selectedModuleKeys.forEach((moduleKey) => {
      counts.set(moduleKey, (counts.get(moduleKey) ?? 0) + 1);
    });
    return counts;
  }

  function reorderSelection(fromIndex, toIndex) {
    if (
      !Number.isInteger(fromIndex)
      || !Number.isInteger(toIndex)
      || fromIndex < 0
      || toIndex < 0
      || fromIndex >= selectedModuleKeys.length
      || toIndex >= selectedModuleKeys.length
      || fromIndex === toIndex
    ) {
      return;
    }

    const [movedModuleKey] = selectedModuleKeys.splice(fromIndex, 1);
    selectedModuleKeys.splice(toIndex, 0, movedModuleKey);
    syncPickerSelection();
  }

  function renderSelectionQueue() {
    pickerSelectionList.innerHTML = '';
    pickerSelectionEmpty.hidden = selectedModuleKeys.length > 0;
    pickerSelectionClear.disabled = selectedModuleKeys.length === 0;

    selectedModuleKeys.forEach((moduleKey, index) => {
      const module = getCatalogItem(moduleKey);
      if (!module) return;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.draggable = true;
      chip.dataset.selectionIndex = String(index);
      chip.title = 'Sürükleyerek sırala · tıklayarak çıkar';
      chip.textContent = `${index + 1}. ${module.label} ×`;
      chip.style.minWidth = '0';
      chip.style.maxWidth = '210px';
      chip.style.overflow = 'hidden';
      chip.style.padding = '6px 8px';
      chip.style.border = '1px solid #d7dee7';
      chip.style.borderRadius = '8px';
      chip.style.background = '#ffffff';
      chip.style.color = '#374151';
      chip.style.fontSize = '11px';
      chip.style.textOverflow = 'ellipsis';
      chip.style.whiteSpace = 'nowrap';
      chip.style.cursor = 'grab';
      chip.style.userSelect = 'none';

      chip.addEventListener('dragstart', (event) => {
        draggedSelectionIndex = index;
        suppressChipClick = true;
        chip.style.opacity = '0.45';
        chip.style.cursor = 'grabbing';
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', String(index));
      });

      chip.addEventListener('dragover', (event) => {
        if (draggedSelectionIndex === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        chip.style.borderColor = '#f97316';
        chip.style.boxShadow = '0 0 0 2px rgba(249, 115, 22, 0.16)';
      });

      chip.addEventListener('dragleave', () => {
        chip.style.borderColor = '#d7dee7';
        chip.style.boxShadow = 'none';
      });

      chip.addEventListener('drop', (event) => {
        event.preventDefault();
        const targetIndex = Number(chip.dataset.selectionIndex);
        const fromIndex = draggedSelectionIndex;
        draggedSelectionIndex = null;
        reorderSelection(fromIndex, targetIndex);
      });

      chip.addEventListener('dragend', () => {
        draggedSelectionIndex = null;
        chip.style.opacity = '1';
        chip.style.cursor = 'grab';
        chip.style.borderColor = '#d7dee7';
        chip.style.boxShadow = 'none';
        window.setTimeout(() => {
          suppressChipClick = false;
        }, 0);
      });

      chip.addEventListener('click', () => {
        if (suppressChipClick) return;
        selectedModuleKeys.splice(index, 1);
        syncPickerSelection();
      });
      pickerSelectionList.appendChild(chip);
    });
  }

  function syncPickerSelection() {
    const counts = getSelectionCounts();

    pickerGroups.querySelectorAll('[data-module-key]').forEach((card) => {
      const count = counts.get(card.dataset.moduleKey) ?? 0;
      card.classList.toggle('selected', count > 0);
      card.setAttribute('aria-selected', String(count > 0));

      const badge = card.querySelector('.module-catalog-card-count');
      if (badge) {
        badge.hidden = count === 0;
        badge.textContent = `×${count}`;
      }
    });

    pickerAddButton.disabled = selectedModuleKeys.length === 0;
    pickerAddButton.textContent = selectedModuleKeys.length
      ? `Ekle (${selectedModuleKeys.length})`
      : 'Ekle';
    renderSelectionQueue();
  }

  function addModuleToSelection(moduleKey) {
    if (!getCatalogItem(moduleKey)) return;
    selectedModuleKeys.push(moduleKey);
    syncPickerSelection();
  }

  function submitPickerSelection() {
    if (!selectedModuleKeys.length || !pickerRequest) return;

    const entries = selectedModuleKeys
      .map((moduleKey) => ({ moduleKey, module: getCatalogItem(moduleKey) }))
      .filter((entry) => entry.module);
    if (!entries.length) return;

    const request = { ...pickerRequest };
    const insertionEntries = request.placement === 'right'
      ? [...entries].reverse()
      : entries;

    const validation = onValidateAddBatch?.({
      ...request,
      entries: insertionEntries,
    });
    if (validation === false || validation?.ok === false) return;

    closePicker();
    insertionEntries.forEach((entry) => {
      onAdd?.({
        ...request,
        moduleKey: entry.moduleKey,
        module: entry.module,
      });
    });
  }

  function createPickerCard(moduleKey, module) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'module-catalog-card';
    card.dataset.moduleKey = moduleKey;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', 'false');

    const titleRow = document.createElement('span');
    titleRow.style.display = 'flex';
    titleRow.style.alignItems = 'center';
    titleRow.style.justifyContent = 'space-between';
    titleRow.style.gap = '8px';

    const cardTitle = document.createElement('strong');
    cardTitle.className = 'module-catalog-card-title';
    cardTitle.textContent = module.label;

    const countBadge = document.createElement('span');
    countBadge.className = 'module-catalog-card-count';
    countBadge.hidden = true;
    countBadge.style.flex = '0 0 auto';
    countBadge.style.padding = '2px 6px';
    countBadge.style.borderRadius = '999px';
    countBadge.style.background = '#f97316';
    countBadge.style.color = '#ffffff';
    countBadge.style.fontSize = '10px';
    countBadge.style.fontWeight = '800';

    titleRow.append(cardTitle, countBadge);
    card.append(titleRow, createModuleCatalogPreview(module));
    card.addEventListener('click', () => addModuleToSelection(moduleKey));
    return card;
  }

  function collapsePickerGroups() {
    pickerGroups.querySelectorAll('.module-drag-group').forEach((details) => {
      details.open = false;
    });
  }

  function renderPickerCatalog() {
    pickerGroups.innerHTML = '';

    listCatalogGroups().forEach((group) => {
      const details = document.createElement('details');
      details.className = 'module-drag-group';
      details.open = false;

      const summary = document.createElement('summary');
      summary.textContent = group.catalogName;

      const grid = document.createElement('div');
      grid.className = 'module-drag-grid';
      group.keys.forEach((moduleKey) => {
        const module = getCatalogItem(moduleKey);
        if (!module) return;
        grid.appendChild(createPickerCard(moduleKey, module));
      });

      details.append(summary, grid);
      pickerGroups.appendChild(details);
    });
  }

  function close() {
    menu.hidden = true;
    activeContext = null;
  }

  function closePicker() {
    pickerBackdrop.hidden = true;
    pickerRequest = null;
    selectedModuleKeys = [];
    draggedSelectionIndex = null;
    suppressChipClick = false;
    syncPickerSelection();
  }

  function openPicker({
    placement = 'append',
    context = null,
    displayPlacement = placement,
  } = {}) {
    pickerRequest = { placement, context, displayPlacement };
    selectedModuleKeys = [];
    draggedSelectionIndex = null;
    suppressChipClick = false;

    if (displayPlacement === 'left') {
      pickerTitle.textContent = 'Sol Tarafa Modül Ekle';
    } else if (displayPlacement === 'right') {
      pickerTitle.textContent = 'Sağ Tarafa Modül Ekle';
    } else {
      pickerTitle.textContent = 'Modül Ekle';
    }

    pickerContext.textContent = context
      ? `Hedef: Modül ${context.moduleIndex + 1} · ${describeModule(context)}`
      : 'Seçilen modüller sırayla duvarın sonuna eklenecek.';

    menu.hidden = true;
    pickerBackdrop.hidden = false;
    collapsePickerGroups();
    syncPickerSelection();
  }

  function open(context) {
    if (!context) {
      close();
      return;
    }

    activeContext = context;
    if (Array.isArray(context.multiModuleIds) && context.multiModuleIds.length > 1) {
      openMultiSelection(context);
      positionMenu(context);
      return;
    }

    const locked = Boolean(context.locked);
    const group = context.group ?? null;
    showSingleGroupSection(group);
    lockButton.hidden = false;
    lockButton.textContent = locked ? 'Kilidi aç' : 'Kilitle';
    // Grup kilidi öğe kilidinden açılamaz.
    setDisabled(lockButton, group?.locked === true && context.ownLocked !== true, GROUP_LOCKED_HINT);
    lockSelectionButton.hidden = true;
    unlockSelectionButton.hidden = true;
    deleteButton.hidden = false;
    setDisabled(deleteButton, locked);
    rotateButton.hidden = false;
    setDisabled(rotateButton, locked);
    separator.hidden = false;
    const panelSuffix = context.supportsGlass && Number.isInteger(context.stripNumber)
      ? ` · Panel ${context.stripNumber}`
      : '';
    const groupSuffix = group ? ` · Grup: ${group.name}` : '';
    title.textContent = `Modül ${context.moduleIndex + 1} · ${describeModule(context)}${panelSuffix}${groupSuffix}${locked ? ' · Kilitli' : ''}`;
    glassModeButton.hidden = !context.supportsGlass;
    glassModeButton.textContent = context.isGlass
      ? 'Normal Panele Çevir'
      : 'Cam Panele Çevir';
    metalSeparatorButton.hidden = !context.supportsMetalSeparator;
    metalSeparatorButton.textContent = context.isMetalSeparator
      ? 'Normal Panele Çevir'
      : 'Metal Separatöre Çevir';

    const isLightboxFabric = Boolean(context.isFabric && context.fabricType !== 'mesh');
    const isMeshFabric = Boolean(context.isFabric && context.fabricType === 'mesh');

    fabricModeButton.hidden = !(context.supportsLightbox ?? context.supportsFabric) || isMeshFabric;
    fabricModeButton.textContent = isLightboxFabric
      ? 'Lightbox Kumaştan Çıkar'
      : 'Lightbox Kumaşa Çevir';

    meshModeButton.hidden = !(context.supportsMesh ?? context.supportsFabric) || isLightboxFabric;
    meshModeButton.textContent = isMeshFabric
      ? 'Mesh Brandadan Çıkar'
      : 'Mesh (Delikli) Brandaya Çevir';

    fabricLightingButton.hidden = !isLightboxFabric;
    fabricLightingButton.textContent = context.fabricLightingOn
      ? 'Lightbox aydınlatmayı kapat'
      : 'Lightbox aydınlatmayı aç';

    const moduleType = context.moduleType ?? context.type;
    const isFoam = moduleType === 'illuminated-foam';
    const isBoxBlock = moduleType === 'box-block';
    const isTulle = moduleType === 'tulle-fabric';
    foamResizeButton.hidden = !(isFoam || isBoxBlock || isTulle);
    foamResizeButton.textContent = isBoxBlock ? 'Ölçü / opacity…' : 'Boyutlandır…';
    setDisabled(foamResizeButton, locked);
    imageResizeButton.hidden = !context.hasImage;
    const isShelf = moduleType === 'shelf';
    const shelfLightingOn = isShelf ? Boolean(getShelfLightingState?.(context)) : false;
    shelfLightingButton.hidden = !isShelf;
    shelfLightingButton.textContent = shelfLightingOn
      ? 'Raf altı aydınlatmayı kapat'
      : 'Raf altı aydınlatmayı aç';
    const showSideInsert = allowsModuleSideInsert(context);
    addRightButton.hidden = !showSideInsert;
    addLeftButton.hidden = !showSideInsert;
    syncAdvancedSection();
    positionMenu(context);
  }

  function positionMenu(context) {
    menu.hidden = false;

    const margin = 8;
    const width = menu.offsetWidth || 220;
    const height = menu.offsetHeight || 250;
    const left = Math.min(context.clientX, window.innerWidth - width - margin);
    const top = Math.min(context.clientY, window.innerHeight - height - margin);
    menu.style.left = `${Math.max(margin, left)}px`;
    menu.style.top = `${Math.max(margin, top)}px`;
  }

  menu.addEventListener('click', (event) => {
    if (event.target.closest('.module-context-advanced-toggle') && activeContext) {
      advancedExpanded = !advancedExpanded;
      syncAdvancedSection();
      positionMenu(activeContext);
      return;
    }
    const button = event.target.closest('[data-module-action]');
    if (!button || !activeContext) return;

    const action = button.dataset.moduleAction;
    const context = activeContext;
    if (button.disabled) return;

    if (action.startsWith('group-')) {
      close();
      onGroupAction?.(action, context);
      return;
    }

    if (action === 'toggle-lock') {
      close();
      onLockChange?.([context.moduleId], !context.locked, context);
      return;
    }

    if (action === 'lock-selection' || action === 'unlock-selection') {
      close();
      onLockChange?.([...(context.multiModuleIds ?? [])], action === 'lock-selection', context);
      return;
    }

    if (action === 'delete') {
      close();
      onDelete?.(context);
      return;
    }

    if (action === 'rotate') {
      close();
      onRotate?.(context);
      return;
    }

    if (action === 'resize-foam') {
      const type = context.moduleType ?? context.type;
      if (type === 'illuminated-foam' || type === 'box-block' || type === 'tulle-fabric') {
        close();
        onResize?.(context);
      }
      return;
    }

    if (action === 'resize-image' && context.hasImage) {
      close();
      onImageResize?.(context);
      return;
    }

    if (action === 'toggle-glass' && context.supportsGlass) {
      close();
      onGlassModeChange?.(context, !context.isGlass);
      return;
    }

    if (action === 'toggle-metal-separator' && context.supportsMetalSeparator) {
      close();
      onMetalSeparatorModeChange?.(context, !context.isMetalSeparator);
      return;
    }

    if (action === 'toggle-fabric' && (context.supportsLightbox ?? context.supportsFabric) && context.fabricType !== 'mesh') {
      close();
      onFabricModeChange?.(context, !(context.isFabric && context.fabricType !== 'mesh'));
      return;
    }

    if (action === 'toggle-mesh' && (context.supportsMesh ?? context.supportsFabric) && context.fabricType !== 'lightbox') {
      close();
      onMeshModeChange?.(context, !(context.isFabric && context.fabricType === 'mesh'));
      return;
    }

    if (action === 'toggle-fabric-light' && context.isLightboxFabric) {
      close();
      onFabricLightingChange?.(context, !context.fabricLightingOn);
      return;
    }

    if (action === 'toggle-shelf-light' && (context.moduleType ?? context.type) === 'shelf') {
      const nextState = !Boolean(getShelfLightingState?.(context));
      close();
      onShelfLightingChange?.(context, nextState);
      return;
    }

    if (action === 'add-right') {
      if (!allowsModuleSideInsert(context)) return;
      openPicker({
        placement: resolveModuleSidePlacement(context, 'right'),
        displayPlacement: 'right',
        context,
      });
      return;
    }

    if (action === 'add-left') {
      if (!allowsModuleSideInsert(context)) return;
      openPicker({
        placement: resolveModuleSidePlacement(context, 'left'),
        displayPlacement: 'left',
        context,
      });
    }
  });

  pickerAddButton.addEventListener('click', submitPickerSelection);
  pickerSelectionClear.addEventListener('click', () => {
    selectedModuleKeys = [];
    syncPickerSelection();
  });

  pickerBackdrop.querySelector('.module-picker-close').addEventListener('click', closePicker);
  pickerBackdrop.querySelector('.module-picker-cancel').addEventListener('click', closePicker);
  pickerBackdrop.addEventListener('pointerdown', (event) => {
    if (event.target === pickerBackdrop) closePicker();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menu.hidden && !menu.contains(event.target)) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    close();
    closePicker();
  });

  window.addEventListener('blur', close);

  renderPickerCatalog();
  syncPickerSelection();

  return {
    open,
    close,
    openPicker,
    closePicker,
  };
}
