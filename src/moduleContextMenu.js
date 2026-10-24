import { getCatalogItem, getModuleCatalogLabel, listCatalogGroups } from './catalog.js';
import { createModuleCatalogPreview } from './moduleDragSidebar.js';
import { getModuleBehavior } from './moduleBehavior.js';
import { getFairStandHostDocument } from './hostDocument.js';
import { MIXED, describePartialSupport } from './selectionSurfaceSummary.js';

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
  onLockChange,
  onGroupAction,
  onRotate,
  onAfterAction,
  // Ölçü alanları: seçime göre { key, title, fields[] } ya da null; değer değişince onDimensionInput.
  getDimensionFields,
  onDimensionInput,
  surfaceControls = null,
  // İşlem sonuç / seçim mesajları satırı (#selection-info) panel başlığının altında durur.
  statusElement = null,
}) {
  const document = getFairStandHostDocument();
  let activeContext = null;
  let pickerRequest = null;
  // Katalogdan her seferinde tek öğe eklenir.
  let selectedModuleKey = null;
  let activeCategoryId = null;
  let pickerBusy = false;

  // Seçime göre özellik paneli: sağ tık, ⋯ ve uzun basma aynı paneli açar. Panel açıkken
  // seçim değişince yeniden çizilir; işlemler mevcut handler'lara gider.
  const panel = document.createElement('aside');
  panel.className = 'selection-property-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Özellikler');
  panel.innerHTML = `
    <div class="selection-property-header">
      <div class="selection-property-headings">
        <strong class="selection-property-heading">Özellikler</strong>
        <span class="selection-property-subheading" hidden></span>
      </div>
      <button type="button" class="selection-property-close" aria-label="Özellikler panelini kapat" title="Kapat (Esc)">×</button>
    </div>
    <p class="selection-property-note" hidden></p>
    <p class="selection-property-empty" hidden>Seçim yok. Sahnede bir yüzey veya öğe seçin.</p>
    <div class="selection-property-fields" hidden></div>
    <div class="selection-property-surface" hidden>
      <p class="selection-property-surface-note" aria-live="polite"></p>
      <div class="selection-property-surface-slot"></div>
    </div>
  `;
  const menu = document.createElement('div');
  menu.className = 'module-context-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Modül işlemleri');
  menu.innerHTML = `
    <div class="module-context-title"></div>
    <div class="module-context-scope" hidden></div>
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
    <div class="module-context-separator"></div>
    <button type="button" role="menuitem" data-module-action="toggle-shelf-light" hidden>Raf altı aydınlatmayı aç</button>
    <button type="button" role="menuitem" data-module-action="toggle-back-panels" hidden>Arka yüze panel ekle</button>
    <button type="button" role="menuitem" data-module-action="add">Ekle…</button>
    <div class="module-context-advanced" hidden>
      <button type="button" role="menuitem" data-module-action="toggle-glass" hidden>Cam Panele Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-metal-separator" hidden>Metal Separatöre Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-fabric" hidden>Lightbox Kumaşa Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-mesh" hidden>Mesh (Delikli) Brandaya Çevir</button>
      <button type="button" role="menuitem" data-module-action="toggle-fabric-light" hidden>Lightbox aydınlatmayı aç</button>
    </div>
  `;
  panel.insertBefore(menu, panel.querySelector('.selection-property-surface'));
  (document.querySelector('.viewport-wrap') ?? document.body).appendChild(panel);
  // Panel etkileşimi sahne / kamera dinleyicilerine geçmez.
  ['pointerdown', 'wheel', 'touchstart'].forEach((type) => {
    panel.addEventListener(type, (event) => event.stopPropagation(), { passive: true });
  });
  if (statusElement) panel.querySelector('.selection-property-header').after(statusElement);
  const heading = panel.querySelector('.selection-property-heading');
  const subheading = panel.querySelector('.selection-property-subheading');
  const lockNote = panel.querySelector('.selection-property-note');
  const emptyHint = panel.querySelector('.selection-property-empty');
  const surfaceSection = panel.querySelector('.selection-property-surface');
  const surfaceNote = panel.querySelector('.selection-property-surface-note');
  const surfaceSlot = panel.querySelector('.selection-property-surface-slot');
  const fieldsSection = panel.querySelector('.selection-property-fields');
  let fieldsKey = null;
  let fieldsSpec = null;
  let fieldsContext = null;

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
  const scopeLine = menu.querySelector('.module-context-scope');
  const glassModeButton = menu.querySelector('[data-module-action="toggle-glass"]');
  const metalSeparatorButton = menu.querySelector('[data-module-action="toggle-metal-separator"]');
  const fabricModeButton = menu.querySelector('[data-module-action="toggle-fabric"]');
  const meshModeButton = menu.querySelector('[data-module-action="toggle-mesh"]');
  const fabricLightingButton = menu.querySelector('[data-module-action="toggle-fabric-light"]');
  const shelfLightingButton = menu.querySelector('[data-module-action="toggle-shelf-light"]');
  const backPanelButton = menu.querySelector('[data-module-action="toggle-back-panels"]');
  const addButton = menu.querySelector('[data-module-action="add"]');
  const lockButton = menu.querySelector('[data-module-action="toggle-lock"]');
  const lockSelectionButton = menu.querySelector('[data-module-action="lock-selection"]');
  const unlockSelectionButton = menu.querySelector('[data-module-action="unlock-selection"]');
  const deleteButton = menu.querySelector('[data-module-action="delete"]');
  const rotateButton = menu.querySelector('[data-module-action="rotate"]');
  const separator = menu.querySelector('.module-context-separator:not(.module-context-group-separator)');
  const groupSeparator = menu.querySelector('.module-context-group-separator');
  // Panel dönüşümleri (Cam, Metal Separatör, Lightbox, Mesh) ayrı bir açılır sekme olmadan
  // listede doğrudan görünür; desteklenen dönüşüm yoksa bölüm gizlenir.
  const advancedSection = menu.querySelector('.module-context-advanced');
  const advancedButtons = [...advancedSection.querySelectorAll('[data-module-action]')];

  function syncAdvancedSection() {
    advancedSection.hidden = !advancedButtons.some((button) => !button.hidden);
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
    const groupSuffix = context.selectionGroupName ? ` · Grup: ${context.selectionGroupName}` : '';
    title.textContent = `${ids.length} öğe seçili${groupSuffix}${lockedCount ? ` · ${lockedCount} kilitli` : ''}`;
    scopeLine.hidden = true;
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
    if (panel.hidden) return;
    panel.hidden = true;
    activeContext = null;
    restoreSurfaceControls();
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

    pickerBackdrop.hidden = false;
    renderPickerCatalog();
  }

  // Sağ tık / ⋯ / uzun basma: paneli açar. Hedef yoksa (boş alana sağ tık) panel kapanır.
  function open(context) {
    if (!context) {
      close();
      return;
    }
    panel.hidden = false;
    render(context);
  }

  // Seçim değişimi: panel açıksa güncel bağlamla yeniden çizilir; kapalı paneli açmaz.
  function refresh(context) {
    if (panel.hidden) return;
    render(context ?? null);
  }

  function isOpen() {
    return !panel.hidden;
  }

  // Başlık seçilen öğenin adı, alt satır yeri ve durumu (referanstaki "ad / gri alt satır" düzeni).
  function describeHeading(context) {
    if (!context) return ['Özellikler', ''];
    const ids = context.multiModuleIds;
    if (Array.isArray(ids) && ids.length > 1) {
      const lockedCount = Number(context.multiLockedCount) || 0;
      return [`${ids.length} öğe seçili`, [
        context.selectionGroupName ? `Grup: ${context.selectionGroupName}` : '',
        lockedCount ? `${lockedCount} kilitli` : '',
      ].filter(Boolean).join(' · ')];
    }
    const summary = context.surfaceSummary ?? null;
    if ((summary?.count ?? 0) > 1) return [title.textContent, scopeLine.textContent];
    return [describeModule(context), [
      `Modül ${context.moduleIndex + 1}`,
      context.supportsGlass && Number.isInteger(context.stripNumber) ? `Panel ${context.stripNumber}` : '',
      context.group ? `Grup: ${context.group.name}` : '',
      context.locked ? 'Kilitli' : '',
    ].filter(Boolean).join(' · ')];
  }

  // Zemin: öğe işlemi yoktur; yalnız zeminin desteklediği renk gösterilir.
  function renderFloor(context) {
    activeContext = null;
    emptyHint.hidden = true;
    menu.hidden = true;
    lockNote.hidden = true;
    renderDimensionFields(context);
    renderSurfaceSection(context.surfaceSummary);
    heading.textContent = context.title;
    subheading.textContent = context.subtitle ?? '';
    subheading.hidden = !context.subtitle;
  }

  function render(context) {
    if (context?.kind === 'floor') {
      renderFloor(context);
      return;
    }
    renderContext(context);
    const [headText, subText] = describeHeading(context);
    heading.textContent = headText;
    subheading.textContent = subText;
    subheading.hidden = !subText;
    // Pasif işlemler panelde satır olarak durmaz; nedenleri tek notta toplanır.
    const reasons = context
      ? [...new Set([...menu.querySelectorAll('[data-module-action]')]
        .filter((button) => !button.hidden && button.disabled && button.title)
        .map((button) => button.title))]
      : [];
    lockNote.textContent = reasons.join(' ');
    lockNote.hidden = !reasons.length;
  }

  function renderContext(context) {
    activeContext = context;
    emptyHint.hidden = Boolean(context);
    menu.hidden = !context;
    renderSurfaceSection(context?.surfaceSummary ?? null);
    renderDimensionFields(context);
    if (!context) return;
    if (Array.isArray(context.multiModuleIds) && context.multiModuleIds.length > 1) {
      openMultiSelection(context);
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
    const summary = context.surfaceSummary ?? null;
    const multiSurface = (summary?.count ?? 0) > 1;
    const panelSuffix = context.supportsGlass && Number.isInteger(context.stripNumber)
      ? ` · Panel ${context.stripNumber}`
      : '';
    const groupSuffix = group ? ` · Grup: ${group.name}` : '';
    const moduleLabel = `Modül ${context.moduleIndex + 1} · ${describeModule(context)}`;
    if (multiSurface) {
      // Çoklu panel: başlık yüzey seçimidir; öğe işlemlerinin hedefi ayrıca yazılır.
      title.textContent = `${summary.count} panel seçili${summary.moduleCount > 1 ? ` · ${summary.moduleCount} öğe` : ''}`;
      scopeLine.textContent = `Öğe işlemleri: ${moduleLabel}${groupSuffix}${locked ? ' · Kilitli' : ''}`;
      scopeLine.hidden = false;
    } else {
      title.textContent = `${moduleLabel}${panelSuffix}${groupSuffix}${locked ? ' · Kilitli' : ''}`;
      scopeLine.hidden = true;
    }
    const mixedSuffix = (value) => (value === MIXED ? ' (karışık)' : '');
    glassModeButton.hidden = !context.supportsGlass;
    glassModeButton.textContent = context.isGlass
      ? 'Normal Panele Çevir'
      : `Cam Panele Çevir${mixedSuffix(summary?.isGlass)}`;
    metalSeparatorButton.hidden = !context.supportsMetalSeparator;
    metalSeparatorButton.textContent = context.isMetalSeparator
      ? 'Normal Panele Çevir'
      : `Metal Separatöre Çevir${mixedSuffix(summary?.isMetalSeparator)}`;

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
    addButton.hidden = !allowsModuleSideInsert(context);
    // Toplu yüzey işlemi yalnız seçimin tamamı destekliyorsa açılır; kısmi destekte gerekçeli pasif.
    [
      [glassModeButton, 'glass', 'cam'],
      [metalSeparatorButton, 'glass', 'metal separatör'],
      [fabricModeButton, 'lightbox', 'Lightbox'],
      [meshModeButton, 'mesh', 'Mesh'],
      [fabricLightingButton, 'lightbox', 'Lightbox'],
    ].forEach(([button, key, label]) => {
      const reason = describePartialSupport(summary, key, label);
      setDisabled(button, Boolean(reason), reason ?? undefined);
    });
    syncAdvancedSection();
  }

  // Ölçü alanları panelde durur, pencere açılmaz; değer değiştikçe sahne canlı güncellenir.
  // Aynı hedef yeniden çizilirken odaktaki alana dokunulmaz (yazarken imleç kaybolmaz).
  function readDimensionValues() {
    return Object.fromEntries([...fieldsSection.querySelectorAll('[data-field]')].map((control) => [
      control.dataset.field,
      control.type === 'checkbox' ? control.checked : (control.type === 'number' ? Number(control.value) : control.value),
    ]));
  }

  function dimensionValuesValid() {
    return [...fieldsSection.querySelectorAll('[data-field]')].every((control) => control.checkValidity());
  }

  function createDimensionControl(field) {
    const label = document.createElement('label');
    label.className = field.type === 'checkbox' ? 'selection-property-field is-checkbox' : 'selection-property-field';
    const caption = document.createElement('span');
    caption.textContent = field.label;
    let control;
    if (field.type === 'select') {
      control = document.createElement('select');
      field.options.forEach((option) => {
        const element = document.createElement('option');
        element.value = option.value;
        element.textContent = option.label;
        control.appendChild(element);
      });
    } else {
      control = document.createElement('input');
      control.type = field.type === 'checkbox' ? 'checkbox' : 'number';
      if (control.type === 'number') {
        control.min = String(field.min);
        control.max = String(field.max);
        control.step = String(field.step ?? 1);
        control.required = true;
        control.inputMode = 'decimal';
      }
    }
    control.dataset.field = field.name;
    control.name = field.name;
    if (field.type === 'checkbox') label.append(control, caption);
    else label.append(caption, control);
    return label;
  }

  function syncDimensionValues(spec, { force = false } = {}) {
    spec.fields.forEach((field) => {
      const control = fieldsSection.querySelector('[data-field="' + field.name + '"]');
      if (!control) return;
      control.disabled = Boolean(spec.disabled);
      if (!force && control === document.activeElement) return;
      if (control.type === 'checkbox') control.checked = Boolean(field.value);
      else control.value = String(field.value);
    });
  }

  function renderDimensionFields(context) {
    const spec = context ? (getDimensionFields?.(context) ?? null) : null;
    fieldsContext = context;
    if (!spec) {
      fieldsSection.hidden = true;
      fieldsSection.replaceChildren();
      fieldsKey = null;
      fieldsSpec = null;
      return;
    }
    const key = [spec.key, context.moduleId, context.surfaceId ?? ''].join('|');
    fieldsSpec = spec;
    fieldsSection.hidden = false;
    if (key === fieldsKey) {
      syncDimensionValues(spec);
      return;
    }
    fieldsKey = key;
    const heading = document.createElement('p');
    heading.className = 'selection-property-section-title';
    heading.textContent = spec.title;
    const grid = document.createElement('div');
    grid.className = 'selection-property-field-grid';
    spec.fields.forEach((field) => grid.appendChild(createDimensionControl(field)));
    fieldsSection.replaceChildren(heading, grid);
    if (spec.note) {
      const note = document.createElement('p');
      note.className = 'selection-property-field-note';
      note.textContent = spec.note;
      fieldsSection.appendChild(note);
    }
    syncDimensionValues(spec, { force: true });
  }

  let dimensionTimer = null;
  function emitDimension(phase) {
    if (!fieldsSpec || !fieldsContext) return;
    clearTimeout(dimensionTimer);
    if (phase !== 'cancel' && !dimensionValuesValid()) return;
    onDimensionInput?.(fieldsContext, fieldsSpec.key, readDimensionValues(), phase);
  }
  fieldsSection.addEventListener('input', (event) => {
    if (event.target.type === 'checkbox' || event.target.tagName === 'SELECT') return;
    clearTimeout(dimensionTimer);
    dimensionTimer = setTimeout(() => emitDimension('input'), 120);
  });
  // Sayı alanları bölümden çıkınca (veya Enter) tek adımda uygulanır; W → H geçişi uygulamaz.
  // Liste ve onay kutusu seçildiği anda uygulanır.
  let skipNextFocusOut = false;
  fieldsSection.addEventListener('change', (event) => {
    if (event.target.type === 'checkbox' || event.target.tagName === 'SELECT') emitDimension('change');
  });
  fieldsSection.addEventListener('focusout', (event) => {
    if (event.target.type !== 'number' || fieldsSection.contains(event.relatedTarget)) return;
    if (skipNextFocusOut) {
      skipNextFocusOut = false;
      return;
    }
    emitDimension('change');
  });
  fieldsSection.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      emitDimension('change');
      skipNextFocusOut = true;
      event.target.blur?.();
    } else if (event.key === 'Escape') {
      // Esc yazılan değeri bırakır: önizleme geri alınır, alan kayıtlı değere döner.
      event.preventDefault();
      event.stopPropagation();
      emitDimension('cancel');
      if (fieldsSpec) syncDimensionValues(fieldsSpec, { force: true });
      skipNextFocusOut = true;
      event.target.blur?.();
    }
  });

  // Renk / görsel: soldaki mevcut kontroller (tek kaynak) panel açıkken buraya taşınır.
  // Yüzey seçimi yoksa veya panel kapanınca yerlerine döner.
  function setSectionDisabled(section, disabled) {
    section.querySelectorAll('input, button, select').forEach((control) => {
      if (disabled && !control.disabled) {
        control.disabled = true;
        control.dataset.panelDisabled = 'true';
      } else if (!disabled && control.dataset.panelDisabled) {
        control.disabled = false;
        delete control.dataset.panelDisabled;
      }
    });
  }

  function restoreSurfaceControls() {
    if (!surfaceControls?.element) return;
    const { element, colorSection, imageSection, homeNote } = surfaceControls;
    [colorSection, imageSection].forEach((section) => {
      section.hidden = false;
      setSectionDisabled(section, false);
    });
    if (homeNote.nextElementSibling !== element) homeNote.after(element);
    homeNote.hidden = true;
  }

  function renderSurfaceSection(summary) {
    if (!surfaceControls?.element || !summary?.count) {
      surfaceSection.hidden = true;
      restoreSurfaceControls();
      return;
    }
    const { element, colorSection, imageSection, homeNote } = surfaceControls;
    if (element.parentNode !== surfaceSlot) surfaceSlot.appendChild(element);
    homeNote.hidden = false;
    surfaceSection.hidden = false;
    const { color, image } = summary.support;
    colorSection.hidden = color === 'none';
    imageSection.hidden = image === 'none';
    setSectionDisabled(colorSection, color === 'some');
    setSectionDisabled(imageSection, image === 'some');
    // Not yalnız farklı değer (Karışık) veya kısmi destek varsa görünür; tek değer zaten kontrollerde.
    const notes = [];
    if (color !== 'none' && summary.color === MIXED) notes.push('Renk: Karışık');
    if (image !== 'none' && summary.imageAssetId === MIXED) notes.push('Görsel: Karışık');
    const partial = [describePartialSupport(summary, 'color', 'renk'), describePartialSupport(summary, 'image', 'görsel')]
      .filter(Boolean);
    surfaceNote.textContent = [notes.join(' · '), ...partial].filter(Boolean).join(' ');
    surfaceNote.hidden = !surfaceNote.textContent;
  }

  function handleMenuClick(event) {
    const button = event.target.closest('[data-module-action]');
    if (!button || !activeContext) return;

    const action = button.dataset.moduleAction;
    const context = activeContext;
    if (button.disabled) return;

    if (action.startsWith('group-')) {
      onGroupAction?.(action, context);
      return;
    }

    if (action === 'toggle-lock') {
      onLockChange?.([context.moduleId], !context.locked, context);
      return;
    }

    if (action === 'lock-selection' || action === 'unlock-selection') {
      onLockChange?.([...(context.multiModuleIds ?? [])], action === 'lock-selection', context);
      return;
    }

    if (action === 'delete') {
      onDelete?.(context);
      return;
    }

    if (action === 'rotate') {
      onRotate?.(context);
      return;
    }

    if (action === 'toggle-glass' && context.supportsGlass) {
      onGlassModeChange?.(context, !context.isGlass);
      return;
    }

    if (action === 'toggle-metal-separator' && context.supportsMetalSeparator) {
      onMetalSeparatorModeChange?.(context, !context.isMetalSeparator);
      return;
    }

    if (action === 'toggle-fabric' && (context.supportsLightbox ?? context.supportsFabric) && context.fabricType !== 'mesh') {
      onFabricModeChange?.(context, !(context.isFabric && context.fabricType !== 'mesh'));
      return;
    }

    if (action === 'toggle-mesh' && (context.supportsMesh ?? context.supportsFabric) && context.fabricType !== 'lightbox') {
      onMeshModeChange?.(context, !(context.isFabric && context.fabricType === 'mesh'));
      return;
    }

    if (action === 'toggle-fabric-light' && context.isLightboxFabric) {
      onFabricLightingChange?.(context, !context.fabricLightingOn);
      return;
    }

    if (action === 'toggle-shelf-light' && (context.moduleType ?? context.type) === 'shelf') {
      const nextState = !Boolean(getShelfLightingState?.(context));
      onShelfLightingChange?.(context, nextState);
      return;
    }

    if (action === 'toggle-back-panels') {
      const current = getBackPanelState?.(context);
      if (current == null) return;
      onBackPanelChange?.(context, !current);
      return;
    }

    if (action === 'add') {
      if (!allowsModuleSideInsert(context)) return;
      // Yer main.js'de seçilir: duvar üstü öğe modülün üstüne; diğerleri sağ → sol → önü → müsait yer.
      openPicker({ placement: 'auto', context });
    }
  }

  // Panel işlem sonrası açık kalır; main.js güncel seçimle yeniden çizer.
  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-module-action]');
    const actionable = Boolean(button && activeContext && !button.disabled);
    handleMenuClick(event);
    if (actionable) onAfterAction?.();
  });
  panel.querySelector('.selection-property-close').addEventListener('click', () => close());

  pickerAddButton.addEventListener('click', () => { void submitPickerSelection(); });

  pickerBackdrop.querySelector('.module-picker-close').addEventListener('click', closePicker);
  pickerBackdrop.querySelector('.module-picker-cancel').addEventListener('click', closePicker);
  pickerBackdrop.addEventListener('pointerdown', (event) => {
    if (event.target === pickerBackdrop) closePicker();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    close();
    // Genişlik penceresi açıkken Esc yalnız onu kapatır.
    if (!pickerBusy) closePicker();
  });

  renderPickerCatalog();
  syncPickerSelection();

  return {
    open,
    refresh,
    isOpen,
    close,
    openPicker,
    closePicker,
  };
}
