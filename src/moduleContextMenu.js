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
  onGlassModeChange,
  onMetalSeparatorModeChange,
  onFabricModeChange,
  onMeshModeChange,
  onFabricLightingChange,
  getShelfLightingState,
  onShelfLightingChange,
  getBackPanelState,
  onBackPanelChange,
  getUprightHeightState,
  onUprightHeight,
  getProfileLengthState,
  onProfileLength,
  onLockChange,
  onGroupAction,
  onRotate,
}) {
  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  let activeContext = null;
  let pickerRequest = null;
  // Katalogdan her seferinde tek öğe eklenir.
  let selectedModuleKey = null;
  let activeCategoryId = null;
  let pickerBusy = false;

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
    <button type="button" role="menuitem" data-module-action="group-dissolve-selection" hidden>Seçilen grupları çöz</button>
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
    <button type="button" role="menuitem" data-module-action="toggle-back-panels" hidden>Arka yüze panel ekle</button>
    <button type="button" role="menuitem" data-module-action="upright-height" hidden>Dikme yüksekliği…</button>
    <button type="button" role="menuitem" data-module-action="profile-length" hidden>Profil boyu…</button>
    <button type="button" role="menuitem" data-module-action="add">Ekle…</button>
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
      <div class="module-picker-groups">
        <div class="module-picker-tabs" role="tablist" aria-label="Modül kataloğu" aria-orientation="vertical"></div>
        <div class="module-picker-panel" role="tabpanel">
          <div class="module-drag-grid" role="listbox" aria-label="Modüller"></div>
        </div>
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
  const backPanelButton = menu.querySelector('[data-module-action="toggle-back-panels"]');
  const uprightHeightButton = menu.querySelector('[data-module-action="upright-height"]');
  const profileLengthButton = menu.querySelector('[data-module-action="profile-length"]');
  const foamResizeButton = menu.querySelector('[data-module-action="resize-foam"]');
  const imageResizeButton = menu.querySelector('[data-module-action="resize-image"]');
  const addButton = menu.querySelector('[data-module-action="add"]');
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
    groupButtons['group-dissolve-selection'].hidden = options.canDissolve !== true;
    setDisabled(groupButtons['group-dissolve-selection'], options.dissolveLocked === true, GROUP_LOCKED_HINT);
    const target = options.addTarget;
    groupButtons['group-add'].hidden = !target;
    if (target) {
      groupButtons['group-add'].textContent = `Gruba ekle: ${target.name}`;
      setDisabled(groupButtons['group-add'], target.locked === true, GROUP_LOCKED_HINT);
    }
    groupSeparator.hidden = groupButtons['group-create'].hidden && groupButtons['group-add'].hidden && groupButtons['group-dissolve-selection'].hidden;
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
    deleteButton.hidden = false;
    deleteButton.textContent = 'Seçilenleri sil';
    setDisabled(deleteButton, lockedCount > 0);
    showMultiGroupSection(context.groupOptions);
  }
  const pickerTitle = pickerBackdrop.querySelector('#module-picker-title');
  const pickerContext = pickerBackdrop.querySelector('.module-picker-context');
  const pickerTabs = pickerBackdrop.querySelector('.module-picker-tabs');
  const pickerPanel = pickerBackdrop.querySelector('.module-picker-panel');
  const pickerGrid = pickerBackdrop.querySelector('.module-picker-panel .module-drag-grid');
  const pickerAddButton = pickerBackdrop.querySelector('.module-picker-add');

  function describeModule(context) {
    return getModuleCatalogLabel(context);
  }

  function syncPickerSelection() {
    pickerGrid.querySelectorAll('[data-module-key]').forEach((card) => {
      const selected = card.dataset.moduleKey === selectedModuleKey;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-selected', String(selected));
    });
    pickerAddButton.disabled = !selectedModuleKey || pickerBusy;
  }

  function selectModule(moduleKey) {
    if (!getCatalogItem(moduleKey)) return;
    selectedModuleKey = moduleKey;
    syncPickerSelection();
  }

  // Ekle: main.js yerleşimi yapar (genişlik penceresi dahil). { ok: false } dönerse (iptal ya da
  // yer bulunamadı) pencere açık kalır, başka öğe seçilebilir.
  async function submitPickerSelection() {
    if (!selectedModuleKey || !pickerRequest || pickerBusy) return;
    const module = getCatalogItem(selectedModuleKey);
    if (!module) return;
    pickerBusy = true;
    syncPickerSelection();
    let result;
    try {
      result = await onAdd?.({ ...pickerRequest, moduleKey: selectedModuleKey, module });
    } finally {
      pickerBusy = false;
    }
    if (result?.ok === false) {
      syncPickerSelection();
      return;
    }
    closePicker();
  }

  function createPickerCard(moduleKey, module) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'module-catalog-card';
    card.dataset.moduleKey = moduleKey;
    card.setAttribute('role', 'option');
    card.setAttribute('aria-selected', 'false');

    const cardTitle = document.createElement('strong');
    cardTitle.className = 'module-catalog-card-title';
    cardTitle.textContent = module.label;

    card.append(cardTitle, createModuleCatalogPreview(module));
    card.addEventListener('click', () => selectModule(moduleKey));
    card.addEventListener('dblclick', () => {
      selectModule(moduleKey);
      void submitPickerSelection();
    });
    return card;
  }

  function renderPickerPanel() {
    const group = listCatalogGroups().find((entry) => entry.id === activeCategoryId);
    pickerGrid.innerHTML = '';
    pickerTabs.querySelectorAll('[data-category-id]').forEach((tab) => {
      const active = Number(tab.dataset.categoryId) === activeCategoryId;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    pickerPanel.setAttribute('aria-label', group?.catalogName ?? 'Modüller');
    (group?.keys ?? []).forEach((moduleKey) => {
      const module = getCatalogItem(moduleKey);
      if (module) pickerGrid.appendChild(createPickerCard(moduleKey, module));
    });
    syncPickerSelection();
  }

  function selectCategory(categoryId) {
    activeCategoryId = categoryId;
    renderPickerPanel();
  }

  // Solda kategori sekmeleri; sağda yalnız seçili kategorinin kartları (ilk açılışta ilk kategori).
  function renderPickerCatalog() {
    pickerTabs.innerHTML = '';
    const groups = listCatalogGroups().filter((group) => group.keys.some((key) => getCatalogItem(key)));
    groups.forEach((group) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'module-picker-tab';
      tab.dataset.categoryId = String(group.id);
      tab.setAttribute('role', 'tab');
      tab.textContent = group.catalogName;
      tab.addEventListener('click', () => selectCategory(group.id));
      pickerTabs.appendChild(tab);
    });
    if (!groups.some((group) => group.id === activeCategoryId)) activeCategoryId = groups[0]?.id ?? null;
    renderPickerPanel();
  }

  function close() {
    menu.hidden = true;
    activeContext = null;
  }

  function closePicker() {
    pickerBackdrop.hidden = true;
    pickerRequest = null;
    selectedModuleKey = null;
    syncPickerSelection();
  }

  function openPicker({
    placement = 'append',
    context = null,
    displayPlacement = placement,
  } = {}) {
    pickerRequest = { placement, context, displayPlacement };
    selectedModuleKey = null;
    pickerTitle.textContent = 'Modül Ekle';

    pickerContext.textContent = context
      ? `Hedef: Modül ${context.moduleIndex + 1} · ${describeModule(context)}`
      : 'Seçilen modül duvarın sonuna eklenecek.';

    menu.hidden = true;
    pickerBackdrop.hidden = false;
    renderPickerCatalog();
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
    deleteButton.textContent = 'Sil';
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
    // Arka yüz paneli yalnız düz duvar ailesinde (getBackPanelState null değilse) gösterilir.
    const backPanelState = getBackPanelState?.(context) ?? null;
    backPanelButton.hidden = backPanelState == null;
    backPanelButton.textContent = backPanelState ? 'Arka yüz panellerini kaldır' : 'Arka yüze panel ekle';
    setDisabled(backPanelButton, locked);
    // Dikme boyu yalnız dikmede (getUprightHeightState null değilse).
    uprightHeightButton.hidden = (getUprightHeightState?.(context) ?? null) == null;
    setDisabled(uprightHeightButton, locked);
    // Profil boyu yalnız profilde (getProfileLengthState null değilse).
    profileLengthButton.hidden = (getProfileLengthState?.(context) ?? null) == null;
    setDisabled(profileLengthButton, locked);
    addButton.hidden = !allowsModuleSideInsert(context);
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

    if (action === 'upright-height') {
      if ((getUprightHeightState?.(context) ?? null) == null) return;
      close();
      onUprightHeight?.(context);
      return;
    }

    if (action === 'profile-length') {
      if ((getProfileLengthState?.(context) ?? null) == null) return;
      close();
      onProfileLength?.(context);
      return;
    }

    if (action === 'toggle-back-panels') {
      const current = getBackPanelState?.(context);
      if (current == null) return;
      close();
      onBackPanelChange?.(context, !current);
      return;
    }

    if (action === 'add') {
      if (!allowsModuleSideInsert(context)) return;
      // Yer main.js'de seçilir: duvar üstü öğe modülün üstüne; diğerleri sağ → sol → önü → müsait yer.
      openPicker({ placement: 'auto', context });
    }
  });

  pickerAddButton.addEventListener('click', () => { void submitPickerSelection(); });

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
    // Genişlik penceresi açıkken Esc yalnız onu kapatır.
    if (!pickerBusy) closePicker();
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
