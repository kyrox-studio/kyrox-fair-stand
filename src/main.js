import { validateStandSetupMeters, formatMeters } from './standSizeInput.js';
import { createEditorViewSettings } from './editorViewSettings.js';
import { createStandScene, prefetchModuleModels } from './scene3d.js';
import { initHelpGuide } from './helpGuide.js';
import { planAutomaticDepot } from './autoDepot.js';
import { planAutomaticFurniture } from './autoFurniture.js';
import { requestWallLockDecision } from './wallLockNotice.js';
import { planAutomaticFascia, resolveFasciaPanelItemKey, resolveFasciaUprightItemKey } from './autoFascia.js';
import {
  composeAutomaticStandWall,
  composeAutomaticBackWallWithDepot,
  composeAutomaticSideWallWithDepot,
  getAutomaticWallCapacityCm,
  planAutomaticWallLampPlacements,
  planAutomaticDepotLampPlacements,
} from './automaticWall.js';
import {
  addFlatPanelBackStrips,
  createModuleStateFromCatalogKey,
  createModuleStateFromDescriptor,
  createProfileModuleState,
  createUprightModuleState,
  duplicateModuleState,
  hasCanonicalModuleItemKey,
  normalizeModuleItemState,
  removeFlatPanelBackStrips,
  supportsFlatPanelBackStrips,
  totalWallWidthCm,
  moduleWidths,
} from './designState.js';
import { deleteImageAsset, loadImageAssets, saveImageAsset, saveImportedImageAsset } from './assetStore.js';
import { clearImageAssetReferences, collectImageAssetReferenceIds, countImageAssetReferences, remapImageAssetReferences } from './imageAssetReferences.js';
import { createProjectId, deleteProjectWithAssets, listCachedProjects, loadProject, loadProjectRevision, saveProject, exportProjectZip, isProjectRemoteEnabled, deleteProjectAsset, markAssetDirty, loadCustomerDisplayName } from './projectRemote.js';
import {
  beginHistoricalView,
  beginLiveSession,
  createRevisionSession,
  displayedRevisionNumber,
  formatProjectTitle,
  maxRevisionNumber,
  noteRevisionCreated,
  resolveRevisionWrite,
} from './projectRevisionSession.js';
import { createModuleContextMenu, allowsModuleSideInsert, resolveModuleSidePlacement } from './moduleContextMenu.js';
import { createSelectionToolbar } from './selectionToolbar.js';
import { summarizeSelectedSurfaces } from './selectionSurfaceSummary.js';
import { createNewProjectWizard } from './newProjectWizard.js';
import { createOnboardingTips } from './onboardingTips.js';
import { createModuleDragSidebar } from './moduleDragSidebar.js';
import { createColorEditorController } from './colorEditorController.js';
import { STAND_TYPE_LABELS, validateStandSetup } from './standSetup.js';
import {
  clampFloorRelativeBottomZCm,
  createModulePlacement,
  getModuleGroundSegments,
  getPlacementInterval,
  getWallExtentCm,
  getWallUsedCm,
  inferStandEdgeWallId,
  planFreeSideInsertion,
  validatePlacementAgainstModules,
  withStandEdgeWallIds,
} from './modulePlacement.js';
import {
  getContinuousWallSegments,
  planContinuousWallInsertion,
  planContinuousWallReplacement,
} from './wallReflow.js';
import { getModuleDefaultRotationDeg, isTopPlacementModule, isWallOverlayModule } from './moduleBehavior.js';
import {
  buildAutomaticProjectNameSuffix,
  createProjectNamingController,
  getEditableProjectName,
  suggestSaveAsEditableName,
} from './projectNaming.js';
import { buildSaveAsClone } from './projectSaveAs.js';
import { createAutosaveController } from './autosaveController.js';
import { readAutosaveMinutes, writeAutosaveMinutes } from './autosaveSettings.js';
import { createDesignHistory } from './designHistory.js';
import { isEditableKeyboardTarget, resolveViewKeyboardShortcut } from './viewKeyboardShortcuts.js';
import {
  MODULE_LOCKED_MESSAGE,
  guardPlanAgainstLocks,
  isModuleLocked,
  getModulesLockState,
  planSelectionRemoval,
  setModulesLocked,
} from './moduleLock.js';
import {
  GROUP_LOCKED_MESSAGE,
  addToGroup,
  createGroup,
  dissolveGroup,
  dissolveSelectedGroups,
  getGroupMembers,
  getModuleGroup,
  listGroups,
  nextGroupName,
  planGroupDuplicate,
  pruneGroups,
  removeFromGroup,
  renameGroup,
  setGroupLocked,
  unlockFullySelectedGroups,
} from './moduleGroups.js';
import { createModuleGroupPanel } from './moduleGroupPanel.js';
import { createGroupTemplatePanel } from './groupTemplatePanel.js';
import { buildGroupTemplatePayload, instantiateGroupTemplate } from './groupTemplates.js';
import {
  GROUP_TEMPLATES_REMOTE_REQUIRED_MESSAGE,
  createGroupTemplate,
  deleteGroupTemplate,
  getGroupTemplate,
  isGroupTemplateRemoteEnabled,
  listGroupTemplates,
  renameGroupTemplate,
} from './groupTemplateRemote.js';
import { getModuleCatalogLabel } from './catalog.js';
import { createProjectLoadingController, setButtonBusy, setSaveProjectEnabled } from './projectUi.js';
import { formatProjectSwitchMessage, shouldConfirmProjectSwitch } from './projectSwitch.js';
import { observeSelectionFeedback, observeStatusTones } from './uiFeedback.js';
import {
  defaultFloorAreaRect,
  defaultOverrideItemKey,
  validateFloorArea,
} from './floorArea.js';
import { DEFAULT_SELECTION_HINT, describeFloorAreaSelection, describeFloorSelection, describeSurfaceSelection } from './selectionFeedback.js';
import { createSidebarController } from './sidebarController.js';
import { createViewportToolbarController } from './viewportToolbarController.js';
import { renderStageResult as renderStageResultInto, renderWallResult } from './stageFeedback.js';
import { reportError, showToast } from './toastNotifications.js';
import {
  defaultUprightItemKeyForWallHeight,
  formatUprightLabel,
  listUprightHeightItems,
  readUprightHeightPreference,
  requestUprightHeight,
  writeUprightHeightPreference,
} from './uprightHeight.js';
import {
  formatProfileLengthLabel,
  listProfileLengthItems,
  readProfileLengthPreference,
  requestProfileLength,
  writeProfileLengthPreference,
} from './profileLength.js';
import { describeModuleVariants, resolveModuleVariantItemKey } from './catalogWidthFamily.js';
import { CATALOG_WALL_LINE_HEIGHT_CM, WALL_LINE_HEIGHTS_CM, getActiveWallLineHeightCm, getFloorItem, setActiveWallLineHeightCm, getFloorSelectLabel, getItem, getTopLightItemForType, listFloorItems, resolveAutomaticWallFlatPanelItemKey, resolveItemDefaultZCm, resolveItemKey, resolveStandFloorItemKey, resolveWallItemKeyForHeight } from './items.js';
import { snapPlacementToItemAnchor } from './itemSnap.js';
import { renderStandStandardsList } from './standStandardsCopy.js';
import {
  isAllowedImportImageType,
  isAllowedImportZipFile,
  validateImportedAssetRecord,
  validateProjectArchiveManifest,
} from './projectImportValidation.js';
import {
  IMAGE_UPLOAD_TYPE_MESSAGE,
  isImageUploadWithinSizeLimit,
} from './imageOptimize.js';
import { formatImageUploadTooLargeMessage, applyArchiveButtonVisibility } from './runtimeSettings.js';
import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';
import { bootstrapFairStandCatalog } from './catalogBootstrap.js';
import { bindProjectActionSaveGuard } from './projectActionSaveGuard.js';
import { createProductionBomPanel } from './productionBomPanel.js';
import { waitForNextRender, waitForSceneAssets } from './sceneAssetLoading.js';
import { beginEditorBootStep, beginProjectOpenStep, discardEditorBootTiming, timeSceneRefresh, finishProjectOpenTiming, startProjectOpenTiming, timeProjectOpenStep } from './projectOpenTiming.js';


export function startFairStandConfigurator(options = {}) {
  let cancelled = false;
  let stopRuntime = () => {};

  const endCatalog = beginEditorBootStep('catalog');
  const boot = bootstrapFairStandCatalog()
    .then(() => {
      endCatalog();
      if (cancelled) return;
      const endEditorStart = beginEditorBootStep('editor-start');
      stopRuntime = startFairStandConfiguratorRuntime(options);
      endEditorStart();
      // İlk proje açılışı runtime içinde başladıysa kayıt ona geçti; başlamadıysa atılır.
      discardEditorBootTiming();
    })
    .catch((error) => {
      console.error('Fair Stand Item catalog bootstrap failed:', error);
      const host = getFairStandHostDocument();
      if (host?.body) {
        host.body.replaceChildren();
        const message = host.createElement('p');
        message.setAttribute('data-testid', 'fair-stand-bootstrap-error');
        message.textContent = 'Fair Stand ürün kataloğu yüklenemedi. Configurator başlatılmadı.';
        host.body.append(message);
      }
    });

  return function stopFairStandConfigurator() {
    cancelled = true;
    void boot;
    stopRuntime();
  };
}

function startFairStandConfiguratorRuntime(options = {}) {
  const capabilities = {
    canCreate: options.capabilities?.canCreate !== false,
    canUpdate: options.capabilities?.canUpdate !== false,
    canDelete: options.capabilities?.canDelete !== false,
    canExecute: options.capabilities?.canExecute !== false,
  };
  const initialProjectId =
    options.initialProjectId
    || globalThis.__FAIR_STAND_INITIAL_PROJECT_ID__
    || null;
  let activeCustomerId =
    options.customerId
    || globalThis.__FAIR_STAND_CUSTOMER_ID__
    || null;

  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  if (!document?.querySelector) {
    throw new Error('Fair Stand host document is not available.');
  }
  const unbindProjectActionSaveGuard = bindProjectActionSaveGuard({ documentRef: document });
let jsZipModulePromise = null;

async function loadJSZip() {
  if (!jsZipModulePromise) {
    jsZipModulePromise = import('jszip').then((module) => module.default);
  }
  return jsZipModulePromise;
}

const appElement = document.querySelector('#app');
const sidebarToggleButton = document.querySelector('#sidebar-toggle');
const viewport = document.querySelector('#viewport');
const viewportEmpty = document.querySelector('#viewport-empty');
// Yeni proje sihirbazı boş sahnede açılır, mevcut kurulum alanlarını ve Sahneyi Oluştur'u kullanır.
const newProjectWizard = createNewProjectWizard({
  container: viewportEmpty,
  validateSetup: () => readSceneSetupFromControls(),
  onCreate: () => createStageButton.click(),
});
const onboardingTips = createOnboardingTips({ container: viewportEmpty?.closest('.viewport-wrap') });
const viewportToolbar = document.querySelector('#viewport-toolbar');
const viewportToolbarToggle = document.querySelector('#viewport-toolbar-toggle');
const toggleProductionBomButton = document.querySelector('#toggle-production-bom');
const renderCurrentViewButton = document.querySelector('#render-current-view');
const toggleStageLightButton = document.querySelector('#toggle-stage-light');
const designUndoButton = document.querySelector('#design-undo');
const designRedoButton = document.querySelector('#design-redo');
const standTypeButtons = [...document.querySelectorAll('[data-stand-type]')];
const standSizeXInput = document.querySelector('#stand-size-x');
const standSizeYInput = document.querySelector('#stand-size-y');
// Yeni stand için varsayılan ölçü (m): genişlik 5, derinlik 4; kullanıcı değiştirebilir.
const DEFAULT_STAND_WIDTH_M = '5';
const DEFAULT_STAND_DEPTH_M = '4';
const createStageButton = document.querySelector('#create-stage');
const wallHeightSelect = document.querySelector('#wall-height');
const floorTypeSelect = document.querySelector('#floor-type');
const floorAreaControls = document.querySelector('#floor-area-controls');
const floorAreaAddButton = document.querySelector('#floor-area-add');
const floorAreaDrawButton = document.querySelector('#floor-area-draw');
const floorAreaDeleteButton = document.querySelector('#floor-area-delete');
const floorAreaStatus = document.querySelector('#floor-area-status');
const floorAreaXInput = document.querySelector('#floor-area-x');
const floorAreaYInput = document.querySelector('#floor-area-y');
const floorAreaWidthInput = document.querySelector('#floor-area-width');
const floorAreaDepthInput = document.querySelector('#floor-area-depth');
const floorAreaTypeSelect = document.querySelector('#floor-area-type');

function syncFloorTypeSelect(selectedKey = floorTypeSelect.value) {
  const preferred = getFloorItem(selectedKey)?.itemKey ?? getFloorItem('karolaj').itemKey;
  floorTypeSelect.replaceChildren(...listFloorItems().map((item) => {
    const option = document.createElement('option');
    option.value = item.itemKey;
    option.textContent = getFloorSelectLabel(item);
    return option;
  }));
  floorTypeSelect.value = preferred;
}

syncFloorTypeSelect();
// Depo: tek açılır liste ("Depo yok" + ölçüler); depo seçiliyken içerik kutusu ve açıklaması açılır.
const autoDepotSizeSelect = document.querySelector('#auto-depot-size');
const autoDepotContentsInput = document.querySelector('#auto-depot-contents');
const autoDepotContentsHint = document.querySelector('#auto-depot-contents-hint');
// Alınlık: "Alınlık yok" / tek sıra / çift sıra; açık kenarlara wall-short + köşe dikmesi.
const autoFasciaRowsSelect = document.querySelector('#auto-fascia-rows');
// Stand mobilyaları: banko + bar taburesi, masa takımı, broşürlük, yapay çiçek (varsayılan seçili).
const autoFurnitureInput = document.querySelector('#auto-furniture');
const stageResult = document.querySelector('#stage-result');
const standSummaryChip = document.querySelector('#stand-summary-chip');
const clearWallButton = document.querySelector('#clear-wall');
const selectionInfo = document.querySelector('#selection-info');
const colorInput = document.querySelector('#surface-color');
const applyColorButton = document.querySelector('#apply-color');
const colorHexInput = document.querySelector('#color-hex');
const colorRgbInputs = {
  r: document.querySelector('#color-r'),
  g: document.querySelector('#color-g'),
  b: document.querySelector('#color-b'),
};
const colorCmykInputs = {
  c: document.querySelector('#color-c'),
  m: document.querySelector('#color-m'),
  y: document.querySelector('#color-y'),
  k: document.querySelector('#color-k'),
};
const foamLightControls=document.querySelector('#foam-light-controls');
const foamLightColorInput=document.querySelector('#foam-light-color');
const imageInput = document.querySelector('#surface-image');
const fillImageButton = document.querySelector('#fit-image-cover');
const fitImageButton = document.querySelector('#fit-image-contain');
const clearTextureButton = document.querySelector('#clear-texture');
const resetModuleFeaturesButton = document.querySelector('#reset-module-features');
const surfaceEditControls = document.querySelector('#surface-edit-controls');
// Özellik paneli sahneden önce kurulmaz; erken seçim bildirimleri yenileme istemez.
let propertyPanelReady = false;
let propertyPanelRefreshQueued = false;
const assetLibraryElement = document.querySelector('#asset-library');
const assetStatus = document.querySelector('#asset-status');
const projectNameInput = document.querySelector('#project-name');
const projectNameDisplay = document.querySelector('#project-name-display');
const projectCustomerDisplay = document.querySelector('#project-customer-display');
const TEMPORARY_CUSTOMER_LABEL = 'Geçici bağ';
const IMPORT_REQUIRES_CUSTOMER_MESSAGE = 'İçe aktarmak için proje bir müşteriye bağlı olmalı: Müşteriler → müşteri → Yeni Proje ile editörü açıp orada İçe Aktar düğmesini kullanın.';
const renameProjectButton = document.querySelector('#rename-project');
const projectSelect = document.querySelector('#project-select');
const saveProjectButton = document.querySelector('#save-project');
const saveAsProjectButton = document.querySelector('#save-as-project');
const openProjectButton = document.querySelector('#open-project');
const exportProjectButton = document.querySelector('#export-project');
const importProjectButton = document.querySelector('#import-project');
const importProjectFileInput = document.querySelector('#import-project-file');
const deleteProjectButton = document.querySelector('#delete-project');
const projectStatus = document.querySelector('#project-status');
const autosaveIntervalSelect = document.querySelector('#autosave-interval');
const projectRevisions = document.querySelector('#project-revisions');
const projectRevisionList = document.querySelector('#project-revision-list');
const revisionSession = createRevisionSession();
const projectLoadingOverlay = document.querySelector('#project-loading-overlay');
const projectLoadingTitle = document.querySelector('#project-loading-title');
const projectLoadingDetail = document.querySelector('#project-loading-detail');

const projectLoading = createProjectLoadingController({
  overlay: projectLoadingOverlay,
  titleElement: projectLoadingTitle,
  detailElement: projectLoadingDetail,
});

const projectNaming = createProjectNamingController({
  documentRef: document,
  projectNameInput,
  projectNameDisplay,
});
const requestProjectName = projectNaming.requestProjectName;

function setProjectName(name) {
  const normalized = projectNaming.setProjectName(name);
  syncProjectNameDisplay();
  return normalized;
}

createSidebarController({
  appElement,
  toggleButton: sidebarToggleButton,
}).bind();

createViewportToolbarController({
  toolbarElement: viewportToolbar,
  toggleButton: viewportToolbarToggle,
}).bind();


observeSelectionFeedback({
  element: selectionInfo,
  defaultHint: DEFAULT_SELECTION_HINT,
});

observeStatusTones({ elements: [stageResult, projectStatus, assetStatus] });

const WALL_LABELS = Object.freeze({
  back: 'Sırt',
  left: 'Sol',
  right: 'Sağ',
  free: 'Serbest',
});

let currentModules = [];
let currentStand = null;
// Kenar çubuğundaki Gruplar kartı (aşağıda kurulur; rebuildWall her yeniden çizimde günceller).
let moduleGroupPanel = null;
// Şablonlarım kartı ve son okunan şablon listesi (sunucu, organizasyon kapsamlı).
let groupTemplatePanel = null;
let groupTemplates = [];
const productionBomPanel = createProductionBomPanel();
productionBomPanel.setModulesSource(() => currentModules);
productionBomPanel.setStandSource(() => currentStand);
productionBomPanel.setAssetNamesSource(() => {
  const names = new Map();
  imageAssets.forEach((asset, id) => {
    if (asset?.name) names.set(id, asset.name);
  });
  return names;
});

function syncProductionBomToggleButton() {
  if (!toggleProductionBomButton) return;
  const open = productionBomPanel.isOpen();
  toggleProductionBomButton.setAttribute('aria-pressed', String(open));
  toggleProductionBomButton.classList.toggle('is-active', open);
}

productionBomPanel.setOnVisibilityChange(() => {
  syncProductionBomToggleButton();
});

toggleProductionBomButton?.addEventListener('click', () => {
  if (productionBomPanel.isOpen()) productionBomPanel.close();
  else productionBomPanel.open();
});
let selectedStandType = null;
let activeAssetId = null;
let moduleDragSidebar = null;
let activeProjectId = createProjectId();
let activeProjectCreatedAt = Date.now();
const imageAssets = new Map();
let assetContextAssetId = null;
let selectedFoamModuleId = null;

const assetContextMenu = document.createElement('div');
assetContextMenu.className = 'module-context-menu asset-context-menu';
assetContextMenu.hidden = true;
assetContextMenu.setAttribute('role', 'menu');
assetContextMenu.setAttribute('aria-label', 'Görsel işlemleri');
assetContextMenu.innerHTML = `
  <div class="module-context-title">Görsel</div>
  <button type="button" role="menuitem" data-asset-action="delete" class="danger">Sil</button>
`;
document.body.appendChild(assetContextMenu);

function getAssetUrl(assetId) {
  return imageAssets.get(assetId)?.url ?? null;
}

const scene3d = createStandScene(
  viewport,
  (surfaces, selectedModuleIds = []) => {
    const feedback = describeSurfaceSelection(surfaces, currentModules);
    selectedFoamModuleId = feedback.foamModuleId;
    if (foamLightControls) foamLightControls.hidden = !feedback.foamControlsVisible;
    if (feedback.foamControlsVisible && foamLightColorInput) {
      foamLightColorInput.value = feedback.foamColor;
    }
    selectionInfo.textContent = describeModuleLockSelection(feedback.message, selectedModuleIds);
    schedulePropertyPanelRefresh();
  },
  getAssetUrl,
  (context) => openModuleContextMenu(context),
  (floorSelection) => {
    const message = floorSelection?.target === 'area'
      ? describeFloorAreaSelection(floorSelection)
      : describeFloorSelection(floorSelection);
    if (message) selectionInfo.textContent = message;
    schedulePropertyPanelRefresh();
  },
  (anchor) => selectionToolbar?.update(anchor),
);

// Mod varsayılanları ve oturumluk kullanıcı tercihleri proje verisinden ayrıdır.
const editorModeButtons = [...document.querySelectorAll('.editor-mode-switch [data-editor-mode]')];
const showMeasurementsInput = document.querySelector('#show-measurements');
const lockAllModulesInput = document.querySelector('#lock-all-modules');
function syncAllModulesLockControl() {
  if (!lockAllModulesInput) return;
  const state = getModulesLockState(currentStand ? currentModules : []);
  lockAllModulesInput.checked = state.allLocked;
  lockAllModulesInput.indeterminate = state.partiallyLocked;
  lockAllModulesInput.disabled = state.total === 0;
}
lockAllModulesInput?.addEventListener('change', () => {
  designHistory.capture();
  changeModuleLock(currentModules.map(module => module.id), lockAllModulesInput.checked);
  designHistory.capture();
});

/** Açık koruma kartı (yeni sahne / sıfırlama öncesinde kapanır). */
function dismissWallLockNotice() {
  document.querySelectorAll('.wall-lock-notice').forEach((card) => card.remove());
}

/**
 * Yeni sahnede kilitli duvar zinciri varsa sahneyi kilitlemeyen bir kartla sorar;
 * "kaldır" denirse Herşeyi Kilitle kalkar. Kart açıkken sahne değiştiyse cevap yok sayılır.
 */
async function offerWallLockRelease() {
  dismissWallLockNotice();
  if (!currentStand || !getModulesLockState(currentModules).locked) return;
  const askedProjectId = activeProjectId;
  const container = viewportEmpty?.closest('.viewport-wrap');
  // Kart üst bandın (satır sayısı genişliğe göre değişir) hemen altında açılır.
  const toolbarBottom = viewportToolbar && !viewportToolbar.hidden && container
    ? viewportToolbar.getBoundingClientRect().bottom - container.getBoundingClientRect().top
    : 0;
  const unlock = await requestWallLockDecision({ documentRef: document, container, topPx: toolbarBottom + 12 });
  if (!unlock || activeProjectId !== askedProjectId || !currentStand) return;
  designHistory.capture();
  changeModuleLock(currentModules.map(module => module.id), false);
  designHistory.capture();
  syncAllModulesLockControl();
}
const editorViewSettings = createEditorViewSettings();
function applyEditorView() {
  const { measurementsVisible: visible } = editorViewSettings.getSnapshot();
  if (showMeasurementsInput) showMeasurementsInput.checked = visible;
  scene3d.setMeasurementsVisible(visible);
}
function setEditorMode(mode) {
  const { mode: editorMode } = editorViewSettings.setMode(mode);
  // Mod geçişi tasarıma yazmaz; yalnız tamamlanmamış bölgesel çizimi kapatır.
  if (editorMode === 'simple') {
    scene3d.setFloorAreaDrawArmed(false);
    floorAreaDrawButton?.setAttribute('aria-pressed', 'false');
    if (currentStand) syncFloorAreaControls();
  }
  document.querySelector('#app')?.setAttribute('data-editor-mode', editorMode);
  editorModeButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.editorMode === editorMode));
  });
  applyEditorView();
}
editorModeButtons.forEach((button) => {
  button.addEventListener('click', () => setEditorMode(button.dataset.editorMode));
});
showMeasurementsInput?.addEventListener('change', () => {
  editorViewSettings.setMeasurementsVisible(showMeasurementsInput.checked);
  applyEditorView();
});
// Açılışta kutu ve sahne aynı tercihle başlar (moddan bağımsız).
applyEditorView();

// Sahne Işığı: oturumluk editör önizlemesi; projeye kaydedilmez, sayfa açılışında açıktır.
toggleStageLightButton?.addEventListener('click', () => {
  const enabled = scene3d.setStageLightPreview(toggleStageLightButton.getAttribute('aria-pressed') !== 'true');
  toggleStageLightButton.setAttribute('aria-pressed', String(enabled));
  toggleStageLightButton.classList.toggle('is-active', enabled);
});

// Seçili modülün üstündeki işlem çubuğu (tablette sağ tık yerine geçer).
const selectionToolbar = createSelectionToolbar({
  onRotate: () => {
    const context = scene3d.getSelectionContext();
    if (context) scene3d.rotateModuleById(context.moduleId);
  },
  // Kopyala açıkken aynı düğme kopyalamayı bitirir.
  onDuplicate: (point) => {
    if (moduleDragSidebar?.isPlacementArmed()) {
      moduleDragSidebar.cancelPlacement();
      return;
    }
    const context = scene3d.getSelectionContext(point);
    if (context) copyContextModule(context);
  },
  onDelete: (point) => {
    const selectedIds = scene3d.getSelectedModuleIds();
    if (selectedIds.length > 1) return deleteSelectedModules(selectedIds);
    const context = scene3d.getSelectionContext(point);
    if (context) deleteContextModule(context);
  },
  // Panel taraması mavi, modül toplu seçimi turuncu çerçeve; tarama bitince mod kendiliğinden kapanır.
  onMultiSelectChange: (mode, resetButton) => {
    const viewportWrap = viewport.closest('.viewport-wrap');
    const setFrame = (next) => {
      viewportWrap?.classList.toggle('multi-select-panel', next === 'panel');
      viewportWrap?.classList.toggle('multi-select-module', next === 'module');
    };
    setFrame(mode);
    scene3d.setMultiSelectMode(mode, {
      onEnd: () => {
        setFrame(false);
        resetButton();
        // Parmak taraması bitince seçilen paneller Özellikler panelinde açılır.
        const context = scene3d.getSelectionContext();
        if (context) openModuleContextMenu(context);
      },
    });
  },
});

// Sahnenin sol altında her zaman görünen stand özeti: "L Stand Sol · 4 × 3 m · duvar 3,5 m".
function formatMeters(cm) {
  return String(Math.round(Number(cm)) / 100).replace('.', ',');
}

function renderStandSummaryChip(setup) {
  if (!standSummaryChip) return;
  if (!setup?.ok) {
    standSummaryChip.hidden = true;
    standSummaryChip.textContent = '';
    return;
  }
  const label = STAND_TYPE_LABELS[setup.standType];
  standSummaryChip.textContent = `${label} · ${formatMeters(setup.xCm)} × ${formatMeters(setup.yCm)} m · duvar ${formatMeters(activeWallHeightCm())} m`;
  standSummaryChip.hidden = false;
}

function renderStageResult(message, isError = false) {
  renderStageResultInto(stageResult, message, isError);
}

function setStandEditingEnabled(enabled) {
  if (toggleProductionBomButton) toggleProductionBomButton.disabled = !enabled;
  clearWallButton.disabled = !enabled;
  moduleDragSidebar?.setEnabled(Boolean(enabled && currentStand));
  if (!enabled) {
    scene3d.setFloorAreaDrawArmed(false);
    if (floorAreaControls) floorAreaControls.hidden = true;
  }
}

function readStandSetup() {
  return validateStandSetupMeters({
    standType: selectedStandType,
    width: standSizeXInput.value,
    depth: standSizeYInput.value,
  });
}

function updateStageCreateState() {
  const result = readStandSetup();
  createStageButton.disabled = !result.ok;

  if (result.ok) {
    if (!currentStand) renderStageResult('Stand alanı hazır. Sahneyi oluşturabilirsin.');
    return;
  }

  const xHasValue = standSizeXInput.value.trim() !== '';
  const yHasValue = standSizeYInput.value.trim() !== '';
  if (selectedStandType && xHasValue && yHasValue) {
    renderStageResult(result.message, true);
  } else if (!currentStand) {
    renderStageResult('Stand tipi ile X ve Y ölçülerinin üçü de tamamlanmadan sahne oluşmaz.');
  }
}

function renderCurrentWallResult() {
  const total = totalWallWidthCm(currentModules);
  const widths = moduleWidths(currentModules);
  const activeWalls = ['back', 'left', 'right', 'free']
    .map((wallId) => ({ wallId, usedCm: getWallUsedCm(currentModules, wallId) }))
    .filter((wall) => wall.usedCm > 0);

  if (!currentModules.length) {
    renderWallResult('Duvar boş.');
    return;
  }

  if (activeWalls.length <= 1 && (activeWalls[0]?.wallId ?? 'back') === 'back') {
    renderWallResult(`${total} cm = ${widths.join(' + ')} · ${currentModules.length} modül`);
    return;
  }

  const wallSummary = activeWalls
    .map(({ wallId, usedCm }) => `${WALL_LABELS[wallId] ?? wallId}: ${usedCm} cm`)
    .join(' · ');
  renderWallResult(`${currentModules.length} modül · ${wallSummary}`);
}

// Grup işlemlerinin stand sınırı ve kenar bilgisi.
function getGroupStand() {
  if (!currentStand) return null;
  return { standType: currentStand.standType, standXCm: currentStand.xCm, standYCm: currentStand.yCm };
}

function renderModuleGroupPanel() {
  syncAllModulesLockControl();
  moduleGroupPanel?.render(currentStand ? currentModules : []);
  renderGroupTemplatePanel();
}

function renderGroupTemplatePanel() {
  if (!groupTemplatePanel) return;
  if (!isGroupTemplateRemoteEnabled()) {
    groupTemplatePanel.showMessage(GROUP_TEMPLATES_REMOTE_REQUIRED_MESSAGE);
    return;
  }
  groupTemplatePanel.render(groupTemplates, {
    canPlace: Boolean(currentStand),
    canRename: capabilities.canCreate || capabilities.canUpdate,
    canDelete: capabilities.canDelete,
  });
}

async function refreshGroupTemplates() {
  if (!isGroupTemplateRemoteEnabled()) {
    renderGroupTemplatePanel();
    return;
  }
  try {
    groupTemplates = await listGroupTemplates();
  } catch (error) {
    reportError('Şablonlar okunamadı', error);
    groupTemplatePanel?.showMessage(`Şablonlar okunamadı: ${error.message}`);
    return;
  }
  renderGroupTemplatePanel();
}

function rebuildWall({ resetView = true } = {}) {
  if (!currentStand) {
    renderModuleGroupPanel();
    renderWallResult('Önce stand alanını oluştur.', true);
    return;
  }

  // Silme, sıfırlama veya geri yükleme sonrası tek üyesi kalan grup çözülür.
  const buildStartedAt = performance.now();
  pruneGroups(currentModules, getGroupStand());
  scene3d.buildWall(currentModules, { resetView });
  timeSceneRefresh(performance.now() - buildStartedAt);
  renderModuleGroupPanel();
  renderCurrentWallResult();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
  schedulePropertyPanelRefresh();
}

function findContextModuleIndex(context) {
  if (!context) return -1;
  const byId = currentModules.findIndex((module) => module.id === context.moduleId);
  if (byId >= 0) return byId;
  return Number.isInteger(context.moduleIndex) ? context.moduleIndex : -1;
}

// Sahnedeki öğe silme onay sormaz; yanlış silme Geri al (Ctrl+Z) ile döner.
function deleteContextModule(context) {
  if (context?.multiModuleIds?.length > 1) return deleteSelectedModules(context.multiModuleIds);
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) return;

  const module = currentModules[index];
  if (isModuleLocked(module)) {
    renderWallResult(MODULE_LOCKED_MESSAGE, true);
    scene3d.showPlacementFeedback(MODULE_LOCKED_MESSAGE, { durationMs: 2200 });
    return;
  }
  commitModuleRemoval(index);
}

function deleteSelectedModules(moduleIds) {
  const plan = planSelectionRemoval(currentModules, moduleIds);
  if (!plan.ok) {
    if (plan.blockedIds.length) reportGroupResult('Seçimde kilitli öğeler var. Silmek için önce kilitlerini açın.', true);
    return;
  }
  const ids = new Set(plan.moduleIds);
  currentModules = currentModules.filter((moduleState) => !ids.has(moduleState.id));
  scene3d.clearSelection();
  syncSceneToModules();
  reportGroupResult(`${ids.size} öğe silindi.`);
}

function onDeleteSelectedModule(event) {
  const detail = event?.detail;
  if (!detail?.moduleId && !Number.isInteger(detail?.moduleIndex)) return;
  deleteContextModule(detail);
}

window.addEventListener('fair-stand:delete-selected-module', onDeleteSelectedModule);

function normalizeContinuousSide(context, side) {
  if (side !== 'left' && side !== 'right') return side;
  const wallId = context?.placement?.wallId ?? 'back';
  if (wallId !== 'left') return side;
  return side === 'left' ? 'right' : 'left';
}

function resolveContextEdgeWallId(module) {
  if (!currentStand) return module?.placement?.wallId ?? 'free';
  return inferStandEdgeWallId(module?.placement, currentStand.standType, currentStand.xCm);
}

function planContextContinuousInsertion(insertedModules, context, side) {
  if (!currentStand) return { ok: false, message: 'Önce stand alanını oluştur.' };
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) {
    return { ok: false, message: 'Hedef modül bulunamadı.' };
  }

  const sourceModule = currentModules[index];
  if (!sourceModule?.placement) {
    return { ok: false, message: 'Hedef modülün yerleşim bilgisi bulunamadı.' };
  }

  const edgeWallId = resolveContextEdgeWallId(sourceModule);
  const modules = withStandEdgeWallIds(
    currentModules,
    currentStand.standType,
    currentStand.xCm,
  );

  // Yanına ekleme/çoğaltma zinciri kaydırıp kilitli bir modülü oynatacaksa reddedilir.
  return guardPlanAgainstLocks(planContinuousWallInsertion({
    modules,
    insertedModules,
    targetModuleId: sourceModule.id,
    side: normalizeContinuousSide({
      ...context,
      placement: { ...sourceModule.placement, wallId: edgeWallId },
    }, side),
    standType: currentStand.standType,
    standXCm: currentStand.xCm,
    standYCm: currentStand.yCm,
  }), currentModules);
}

function planContextFreeInsertion(insertedModules, context, side) {
  if (!currentStand) return { ok: false, message: 'Önce stand alanını oluştur.' };
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) {
    return { ok: false, message: 'Hedef modül bulunamadı.' };
  }

  const sourceModule = currentModules[index];
  return guardPlanAgainstLocks(planFreeSideInsertion({
    modules: currentModules,
    insertedModules,
    targetModuleId: sourceModule.id,
    side,
    standType: currentStand.standType,
    standXCm: currentStand.xCm,
    standYCm: currentStand.yCm,
  }), currentModules);
}

function applyFreeInsertionPlan(plan, insertedModules, context, side) {
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) return false;

  plan.placements?.forEach((nextPlacement, moduleId) => {
    const module = insertedModules.find((candidate) => candidate.id === moduleId);
    if (module) module.placement = { ...nextPlacement };
  });

  const insertIndex = side === 'left' ? index : index + 1;
  currentModules.splice(insertIndex, 0, ...insertedModules);
  return true;
}

function isFreeContextInsertion(context) {
  const index = findContextModuleIndex(context);
  if (index < 0) return false;
  return resolveContextEdgeWallId(currentModules[index]) === 'free';
}

function applyContinuousInsertionPlan(plan, insertedModules) {
  const moduleMap = new Map(
    [...currentModules, ...insertedModules].map((module) => [module.id, module]),
  );

  plan.placements?.forEach((placement, moduleId) => {
    const module = moduleMap.get(moduleId);
    if (module) module.placement = { ...placement };
  });

  currentModules = (plan.orderedModuleIds ?? [])
    .map((moduleId) => moduleMap.get(moduleId))
    .filter(Boolean);
}

// Kopyala: modül hafızaya alınır; sahnede tıklanan/dokunulan her yere, katalogdan bırakmayla aynı
// yerleşim kuralıyla bir kopya bırakılır (görseller, renk, cam/Lightbox/metal dahil; kilitsiz,
// grupsuz). Esc veya Kopyala'ya tekrar basmak bitirir. Ctrl+C kopyalar, Ctrl+V son kopyayla yeniden başlar.
let copiedModule = null;

function placeCopiedModule(state, clientX, clientY, rotationZDeg, rotationLocked) {
  if (!state) return;
  const result = scene3d.dropCatalogModuleDrag(state, clientX, clientY, rotationZDeg, rotationLocked);
  if (!result?.ok || !result.placement) {
    renderWallResult(result?.message ?? 'Kopya bu konuma bırakılamadı.', true);
    return;
  }
  if (result.plan?.placements instanceof Map && result.plan?.orderedModuleIds?.length) {
    // Şeride araya ekleme: diğer modüller kayar, kopya araya girer.
    commitModuleAddition(() => applyContinuousInsertionPlan(result.plan, [state]));
    return;
  }
  state.placement = { ...result.placement };
  commitModuleAddition(() => currentModules.push(state));
}

function startCopyPlacement() {
  if (!copiedModule) return false;
  const label = getItem(copiedModule.itemKey)?.label ?? copiedModule.label ?? copiedModule.itemKey ?? 'Modül';
  const armed = moduleDragSidebar?.armPlacement({
    createState: () => duplicateModuleState(copiedModule),
    rotationZDeg: copiedModule.placement?.rotationZDeg,
    hint: 'Kopyayı bırakmak için sahnede yere dokun · Esc veya Kopyalamayı bitir: çık',
    onPlace: placeCopiedModule,
    onEnd: () => selectionToolbar?.setCopyActive(false),
  });
  if (!armed) return false;
  selectionToolbar?.setCopyActive(true);
  selectionInfo.textContent = `Kopyalandı: ${label} · bırakmak için sahnede bir yere dokun · Esc: bitir`;
  return true;
}

function copyContextModule(context) {
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) return;
  copiedModule = JSON.parse(JSON.stringify(currentModules[index]));
  // Sağ altta bildirim: kopyalanan öğe hafızada (Ctrl+V ile yeniden bırakılabilir).
  showToast(`${getModuleCatalogLabel(copiedModule)} hafızaya alındı`, { kind: 'info' });
  startCopyPlacement();
}

function onCopyPasteKeyDown(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const key = String(event.key).toLowerCase();
  if (key !== 'c' && key !== 'v') return;
  const tagName = String(event.target?.tagName ?? '').toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || event.target?.isContentEditable) return;
  if (key === 'c') {
    // Metin seçiliyse tarayıcının kendi kopyalaması çalışır; toplu seçimde kopya yok.
    if (window.getSelection?.()?.toString()) return;
    if ((scene3d.getSelectedModuleIds?.() ?? []).length > 1) return;
    const context = scene3d.getSelectionContext();
    if (!context) return;
    event.preventDefault();
    copyContextModule(context);
    return;
  }
  if (!copiedModule) return;
  event.preventDefault();
  startCopyPlacement();
}

function assignStandFloorItem(stand, itemKey) {
  return { ...stand, itemKey: resolveStandFloorItemKey(itemKey) };
}

function createCatalogModuleState(module, { preservePlacement = false, itemKey = null } = {}) {
  if (!module) return null;
  const canonicalKey = resolveWallItemKeyForHeight(
    itemKey || module.itemKey || resolveItemKey(module),
    activeWallHeightCm(),
  );
  const state = createModuleStateFromCatalogKey(canonicalKey)
    ?? createModuleStateFromDescriptor(module, { itemKey: canonicalKey });
  if (!state) return null;
  if (preservePlacement && module.placement) {
    state.placement = { ...module.placement };
  }
  return state;
}

// Mevcut modüllerin yerleşim ve grup bilgisi (ekleme/silme sonrası değişti mi karşılaştırmak için).
function moduleLayoutSignature(modules) {
  return JSON.stringify(modules.map((module) => [module.id, module.placement ?? null, module.groupId ?? null]));
}

// Ekleme: mutate yeni modülleri diziye koyar. Mevcut modüllerin hiçbirinin yeri/grubu değişmediyse
// ve yeniler dizinin sonundaysa yeniler sahneye tek tek eklenir; aksi halde tam kurulum.
function commitModuleAddition(mutate) {
  const before = currentModules.slice();
  const beforeSignature = moduleLayoutSignature(before);
  mutate();
  const unchanged = moduleLayoutSignature(currentModules.slice(0, before.length)) === beforeSignature
    && before.every((module, index) => currentModules[index] === module);
  if (!unchanged || !currentStand) {
    rebuildWall({ resetView: false });
    return;
  }
  const added = currentModules.slice(before.length);
  for (const moduleState of added) {
    const moduleIndex = currentModules.indexOf(moduleState);
    if (!scene3d.appendModule(moduleState, moduleIndex)) {
      rebuildWall({ resetView: false });
      return;
    }
  }
  renderModuleGroupPanel();
  renderCurrentWallResult();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
}

// Silme: grup temizliği kalan modüllerden birini değiştirirse tam kurulum; değiştirmezse yalnız
// o modül sahneden kaldırılır.
function commitModuleRemoval(index) {
  const removed = currentModules[index];
  currentModules.splice(index, 1);
  const beforeSignature = moduleLayoutSignature(currentModules);
  pruneGroups(currentModules, getGroupStand());
  const buildStartedAt = performance.now();
  if (moduleLayoutSignature(currentModules) !== beforeSignature
    || !currentStand
    || !scene3d.removeModule(removed?.id, currentModules)) {
    rebuildWall({ resetView: false });
    return;
  }
  timeSceneRefresh(performance.now() - buildStartedAt);
  renderModuleGroupPanel();
  renderCurrentWallResult();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
}

// Bırakılan tek modül sahneye tek başına eklenir; diğer modüllere dokunulmaz. Sahne bunu
// yapamazsa (ör. renderer hatası) eskisi gibi tam kurulum yapılır.
function appendModuleToScene(moduleState) {
  const moduleIndex = currentModules.indexOf(moduleState);
  const buildStartedAt = performance.now();
  if (!currentStand || moduleIndex < 0 || !scene3d.appendModule(moduleState, moduleIndex)) {
    rebuildWall({ resetView: false });
    return;
  }
  timeSceneRefresh(performance.now() - buildStartedAt);
  renderModuleGroupPanel();
  renderCurrentWallResult();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
}

function commitDroppedCatalogModule(moduleState, dropResult, catalogKey = null) {
  if (!dropResult?.ok || !dropResult.placement) {
    return { ok: false, message: dropResult?.message ?? 'Modül bu konuma bırakılamadı.' };
  }

  const canonical = createCatalogModuleState(moduleState, {
    itemKey: getItem(catalogKey)?.widthVariants?.includes(moduleState?.itemKey)
      ? moduleState.itemKey : (catalogKey || moduleState?.itemKey),
  });
  if (!canonical || !hasCanonicalModuleItemKey(canonical)) {
    return { ok: false, message: 'Katalog Item kimliği kaybolduğu için modül sahneye eklenmedi.' };
  }
  if (moduleState?.id) canonical.id = moduleState.id;
  // Drop dialog / sürükleme ezmeleri (box-block W·D·H·opacity vb.)
  const widthCm = Number(moduleState?.widthCm);
  const depthCm = Number(moduleState?.depthCm);
  const heightCm = Number(moduleState?.heightCm);
  if (Number.isFinite(widthCm) && widthCm > 0) canonical.widthCm = widthCm;
  if (Number.isFinite(depthCm) && depthCm > 0) canonical.depthCm = depthCm;
  if (Number.isFinite(heightCm) && heightCm > 0) canonical.heightCm = heightCm;
  if (moduleState?.opacity != null) {
    const opacity = Number(moduleState.opacity);
    if (Number.isFinite(opacity)) {
      canonical.opacity = Math.min(1, Math.max(0, opacity));
    }
  }
  if (moduleState?.surface?.color && canonical.surface) {
    canonical.surface = { ...canonical.surface, color: moduleState.surface.color };
  }

  const previousModules = currentModules.slice();
  try {
    if (dropResult.plan?.placements instanceof Map && dropResult.plan?.orderedModuleIds?.length) {
      // Şeride araya ekleme diğer modüllerin yerini değiştirir: onlar taşınır, yeni modül eklenir.
      const capturedContent = captureModuleContent();
      applyContinuousInsertionPlan(dropResult.plan, [canonical]);
      moduleContextMenu.closePicker();
      scene3d.clearSelection();
      syncSceneAfterModuleChange(capturedContent);
    } else {
      canonical.placement = { ...dropResult.placement };
      currentModules.push(canonical);
      appendModuleToScene(canonical);
    }
  } catch (error) {
    currentModules = previousModules;
    try {
      rebuildWall({ resetView: false });
    } catch (rollbackError) {
      reportError('Bırakma geri alınamadı; sahneyi yenileyin', rollbackError);
    }
    return {
      ok: false,
      message: error?.message || 'Modül sahneye eklenirken durduruldu; önceki sahne korundu.',
    };
  }

  // Katalogdan konan Işıklı Strafor ve varyantı olan öğe tıklanmış gibi seçilir; Özellikler paneli
  // açılır (logo görseli / varyant düğmeleri oradan seçilir).
  if (canonical.type === 'illuminated-foam' || describeModuleVariants(canonical)) {
    window.setTimeout(() => {
      if (!scene3d.selectModuleSurface(canonical.id)) return;
      const context = currentPropertyPanelContext();
      if (context) moduleContextMenu.open(context);
    }, 0);
  }

  return { ok: true, moduleState: canonical };
}

function getContinuousModulePathStartCm(module, segments) {
  const placement = module?.placement;
  const widthCm = Number(module?.widthCm);
  if (!placement || !Number.isFinite(widthCm) || widthCm <= 0) return null;

  const segment = segments.find((candidate) => candidate.wallId === placement.wallId);
  if (!segment) return null;

  let localStartCm = null;
  if (placement.wallId === 'left') {
    localStartCm = Number(currentStand?.yCm) - (Number(placement.yCm) + widthCm);
  } else if (placement.wallId === 'back') {
    localStartCm = Number(placement.xCm);
  } else if (placement.wallId === 'right') {
    localStartCm = Number(placement.yCm);
  }

  if (!Number.isFinite(localStartCm)) return null;
  return Number(segment.offsetCm) + localStartCm;
}

function getContinuousAppendTargetModule() {
  if (!currentStand) return null;
  const segments = getContinuousWallSegments(
    currentStand.standType,
    currentStand.xCm,
    currentStand.yCm,
  );
  if (!segments.length) return null;

  return currentModules
    .map((module) => ({
      module,
      pathStartCm: getContinuousModulePathStartCm(module, segments),
    }))
    .filter((entry) => Number.isFinite(entry.pathStartCm))
    .sort((a, b) => a.pathStartCm - b.pathStartCm)
    .at(-1)?.module ?? null;
}

function planCatalogAppendInsertion(moduleStates) {
  const targetModule = getContinuousAppendTargetModule();
  if (!targetModule) {
    const initialPlan = assignPlannedPlacements(moduleStates, {
      placementMode: 'append',
      context: null,
    });
    return { ...initialPlan, appendMode: 'initial' };
  }

  // wallReflow yan duvar çağrı yönünü zincir yönüne normalize ediyor.
  // Fiziksel zincir sonuna eklemek için yan duvarda caller side ters gönderilir.
  const targetWallId = targetModule.placement?.wallId;
  const side = targetWallId === 'left' || targetWallId === 'right' ? 'left' : 'right';
  const plan = guardPlanAgainstLocks(planContinuousWallInsertion({
    modules: currentModules,
    insertedModules: moduleStates,
    targetModuleId: targetModule.id,
    side,
    standType: currentStand.standType,
    standXCm: currentStand.xCm,
    standYCm: currentStand.yCm,
  }), currentModules);
  return { ...plan, appendMode: 'continuous' };
}

function assignPlannedPlacements(moduleStates, { placementMode = 'append', context = null } = {}) {
  if (!currentStand) return { ok: false, message: 'Önce stand alanını oluştur.' };
  if (placementMode !== 'append' || context) {
    return { ok: false, message: 'Bağlamsal ekleme sürekli duvar motoru üzerinden yapılmalı.' };
  }

  const planned = [];
  let cursorCm = getWallExtentCm(currentModules, 'back');

  for (const moduleState of moduleStates) {
    const placement = createModulePlacement({
      xCm: cursorCm,
      yCm: 0,
      rotationZDeg: getModuleDefaultRotationDeg(moduleState),
      wallId: 'back',
      itemKey: moduleState.itemKey,
    });

    const validation = validatePlacementAgainstModules({
      placement,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      moduleId: moduleState.id,
      moduleType: moduleState.type,
      itemKey: moduleState.itemKey,
      heightCm: moduleState.heightCm,
      shape: moduleState.shape,
      modules: [...currentModules, ...planned],
      standType: currentStand.standType,
      standXCm: currentStand.xCm,
      standYCm: currentStand.yCm,
    });
    if (!validation.ok) return validation;

    moduleState.placement = placement;
    planned.push(moduleState);
    cursorCm += Number(moduleState.widthCm);
  }

  return { ok: true };
}

const NO_FREE_SPOT_MESSAGE = 'Öğe için sahnede müsait yer bulunamadı.';

// Katalogdan "Ekle" (modül bağlamı yok): duvarın sonuna; sığmazsa sahnede müsait bir yere.
function placeCatalogModuleAppend(moduleState) {
  const plan = planCatalogAppendInsertion([moduleState]);
  if (plan.ok) {
    commitModuleAddition(() => {
      if (plan.appendMode === 'continuous') applyContinuousInsertionPlan(plan, [moduleState]);
      else currentModules.push(moduleState);
    });
    return { ok: true };
  }
  const free = scene3d.findFreeCatalogPlacement(moduleState);
  if (free) return commitDroppedCatalogModule(moduleState, free, moduleState.itemKey);
  return { ok: false, message: plan.message ?? NO_FREE_SPOT_MESSAGE };
}

// Sağ tıkla seçilen modülün yanına ekleme (görsel taraf: right / left).
function tryContextSideInsertion(moduleState, context, visualSide) {
  const side = resolveModuleSidePlacement(context, visualSide);
  if (isFreeContextInsertion(context)) {
    const plan = planContextFreeInsertion([moduleState], context, side);
    if (!plan.ok) return plan;
    commitModuleAddition(() => applyFreeInsertionPlan(plan, [moduleState], context, side));
    return { ok: true };
  }
  const plan = planContextContinuousInsertion([moduleState], context, side);
  if (!plan.ok) return plan;
  commitModuleAddition(() => applyContinuousInsertionPlan(plan, [moduleState]));
  return { ok: true };
}

// Sağ tık "Ekle": duvar üstü (wall-overlay) ve tepe (top) davranışlı her öğe tıklanan modülün
// üstüne bırakılır (sürükle-bırak kuralı). Diğerleri sırayla: sağı → solu → hemen önü → sahnede
// müsait yer. Kural Item'a değil davranış ailesine bağlıdır; yeni öğeler kendiliğinden uyar.
function placeCatalogModuleNearContext(moduleState, context) {
  if (isWallOverlayModule(moduleState) || isTopPlacementModule(moduleState)) {
    const result = scene3d.placeCatalogModuleOnModule(moduleState, context.moduleId, {
      clientX: context.clientX,
      clientY: context.clientY,
    });
    return result.ok ? commitDroppedCatalogModule(moduleState, result, moduleState.itemKey) : result;
  }
  if (allowsModuleSideInsert(context)) {
    for (const side of ['right', 'left']) {
      const result = tryContextSideInsertion(moduleState, context, side);
      if (result.ok) return result;
    }
  }
  const placed = scene3d.planCatalogModuleInFrontOf(moduleState, context.moduleId)
    ?? scene3d.findFreeCatalogPlacement(moduleState, context.moduleId);
  if (placed) return commitDroppedCatalogModule(moduleState, placed, moduleState.itemKey);
  return { ok: false, message: NO_FREE_SPOT_MESSAGE };
}

// Katalogdan her seferinde tek öğe eklenir. Varyant ailesinde kartın kendisi (varsayılan varyant)
// konur; varyant Özellikler panelinde seçilir. Yer bulunamazsa { ok: false } döner, pencere açık kalır.
async function addCatalogModule(request) {
  if (!currentStand || !request?.module) return { ok: false };
  const moduleState = createCatalogModuleState(request.module);
  if (!moduleState) return { ok: false, message: 'Seçilen modül hazırlanamadı.' };
  const result = request.context
    ? placeCatalogModuleNearContext(moduleState, request.context)
    : placeCatalogModuleAppend(moduleState);
  if (!result.ok) {
    renderWallResult(result.message ?? NO_FREE_SPOT_MESSAGE, true);
    return result;
  }
  // Eklenen öğe seçili kalır; nereye konduğu görünsün diye ekranda değilse görüş ona kaydırılır.
  scene3d.revealAddedModule(result.moduleState?.id ?? moduleState.id);
  return result;
}

function getContextShelfLightingState(context) {
  const index = findContextModuleIndex(context);
  const moduleState = index >= 0 ? currentModules[index] : null;
  return moduleState?.type === 'shelf' && Boolean(moduleState.shelfLightingOn);
}

function changeContextShelfLighting(context, enabled) {
  const index = findContextModuleIndex(context);
  if (index < 0 || currentModules[index]?.type !== 'shelf') return;

  const nextEnabled = Boolean(enabled);
  currentModules[index].shelfLightingOn = nextEnabled;
  if (!scene3d.setShelfLightingVisible(index, nextEnabled)) {
    rebuildWall({ resetView: false });
  }
  selectionInfo.textContent = nextEnabled
    ? 'Raf altı aydınlatma açıldı.'
    : 'Raf altı aydınlatma kapatıldı.';
}

function applyUprightItemKey(moduleState, itemKey) {
  const upright = createUprightModuleState({ itemKey });
  if (!upright) return false;
  moduleState.itemKey = upright.itemKey;
  moduleState.widthCm = upright.widthCm;
  moduleState.depthCm = upright.depthCm;
  moduleState.heightCm = upright.heightCm;
  // Yükseltilmiş dikme uzayınca tepesi stand tavanını geçmez.
  if (moduleState.placement) {
    moduleState.placement = {
      ...moduleState.placement,
      zCm: clampFloorRelativeBottomZCm(Number(moduleState.placement.zCm || 0), upright.heightCm),
    };
  }
  return true;
}

function applyProfileItemKey(moduleState, itemKey) {
  const profile = createProfileModuleState({ itemKey });
  if (!profile) return false;
  moduleState.itemKey = profile.itemKey;
  moduleState.widthCm = profile.widthCm;
  moduleState.depthCm = profile.depthCm;
  moduleState.heightCm = profile.heightCm;
  return true;
}

// Arka yüz paneli: null = bu modülde yok (menü gizli), true/false = takılı mı.
function getContextBackPanelState(context) {
  const index = findContextModuleIndex(context);
  const moduleState = index >= 0 ? currentModules[index] : null;
  if (!supportsFlatPanelBackStrips(moduleState)) return null;
  return Array.isArray(moduleState.backStrips);
}

function changeContextBackPanels(context, enabled) {
  const index = findContextModuleIndex(context);
  const moduleState = index >= 0 ? currentModules[index] : null;
  if (!supportsFlatPanelBackStrips(moduleState)) return;
  if (enabled) {
    if (!addFlatPanelBackStrips(moduleState)) return;
    selectionInfo.textContent = 'Arka yüze panel eklendi.';
  } else {
    const decorated = (moduleState.backStrips ?? []).some((strip) => (
      strip?.imageAssetId || strip?.fabricGroupId || strip?.isGlass || strip?.isMetalSeparator
    ));
    if (decorated && !window.confirm('Arka yüzdeki görsel ve panel ayarları silinecek. Devam edilsin mi?')) return;
    if (!removeFlatPanelBackStrips(moduleState)) return;
    selectionInfo.textContent = 'Arka yüz panelleri kaldırıldı.';
  }
  rebuildWall({ resetView: false });
}

function changeContextFabricMode(context, enabled) {
  if (!(context?.supportsLightbox ?? context?.supportsFabric)) return;

  const selectedPanels = scene3d.getSelectedSurfaces().filter(
    (surface) => surface.userData.acceptsLightbox === true,
  );
  const result = scene3d.applyFabricMode(selectedPanels, enabled);
  if (!result?.ok) {
    selectionInfo.textContent = result?.message || 'Lightbox Kumaş işlemi uygulanamadı.';
    return;
  }

  selectionInfo.textContent = result.enabled
    ? `${result.panelCount} panel tek parça Lightbox Kumaşa çevrildi.`
    : 'Lightbox Kumaş kaldırıldı; paneller normal görünüme döndü.';
}

function changeContextMeshMode(context, enabled) {
  if (!(context?.supportsMesh ?? context?.supportsFabric)) return;

  const selectedPanels = scene3d.getSelectedSurfaces().filter(
    (surface) => surface.userData.acceptsMesh === true,
  );
  const result = scene3d.applyMeshMode(selectedPanels, enabled);
  if (!result?.ok) {
    selectionInfo.textContent = result?.message || 'Mesh Branda işlemi uygulanamadı.';
    return;
  }

  selectionInfo.textContent = result.enabled
    ? `${result.panelCount} panel tek parça Mesh (Delikli) Brandaya çevrildi.`
    : 'Mesh Branda kaldırıldı; paneller normal görünüme döndü.';
}

function changeContextFabricLighting(context, enabled) {
  if (!context?.isLightboxFabric) return;

  const selectedPanels = scene3d.getSelectedSurfaces().filter(
    (surface) => surface.userData.acceptsLightbox === true,
  );
  const result = scene3d.setFabricLighting(selectedPanels, enabled);
  if (!result?.ok) {
    selectionInfo.textContent = result?.message || 'Lightbox aydınlatması değiştirilemedi.';
    return;
  }

  selectionInfo.textContent = result.enabled
    ? 'Lightbox aydınlatması açıldı · yalnızca bez/görsel parlıyor.'
    : 'Lightbox aydınlatması kapatıldı.';
}

function changeContextMetalSeparatorMode(context, enabled) {
  if (!context?.supportsMetalSeparator) return;

  const selectedPanels = scene3d.getSelectedSurfaces().filter(
    (surface) => surface.userData.acceptsGlass === true,
  );
  if (!selectedPanels.length) return;

  const result = scene3d.applyMetalSeparatorMode(selectedPanels, enabled);
  if (!result?.ok) {
    selectionInfo.textContent = result?.message || 'Metal separatör işlemi uygulanamadı.';
    return;
  }
  productionBomPanel.refresh();
  selectionInfo.textContent = result.enabled
    ? `${result.panelCount} panel tek parça metal separatöre çevrildi.`
    : `${result.panelCount} panel normal panele çevrildi.`;
}

function changeContextPanelGlassMode(context, isGlass) {
  if (!context?.supportsGlass) return;

  const selectedPanels = scene3d.getSelectedSurfaces().filter(
    (surface) => surface.userData.acceptsGlass === true,
  );
  if (!selectedPanels.length) return;

  scene3d.applyGlassMode(selectedPanels, isGlass);
  productionBomPanel.refresh();
  const panelCount = selectedPanels.length;
  selectionInfo.textContent = isGlass
    ? `${panelCount} panel cam panele çevrildi.`
    : `${panelCount} panel normal panele çevrildi.`;
}

// Özellikler paneli ölçü alanları: pencere açılmaz; seçilen öğenin ölçüsü panelde durur ve değer
// değiştikçe sahne canlı güncellenir. Sınırlar eski ölçü pencereleriyle aynıdır.
const SIZE_FIELD_SPECS = Object.freeze({
  'box-block': Object.freeze({
    title: 'Ölçü',
    fields: Object.freeze([
      Object.freeze({ name: 'widthCm', label: 'W · Genişlik (cm)', min: 1, max: 5000 }),
      Object.freeze({ name: 'depthCm', label: 'D · Derinlik (cm)', min: 1, max: 5000 }),
      Object.freeze({ name: 'heightCm', label: 'H · Yükseklik (cm)', min: 1, max: 5000 }),
      Object.freeze({ name: 'opacity', label: 'Opacity (0–1)', min: 0, max: 1, step: 0.05 }),
    ]),
  }),
  'illuminated-foam': Object.freeze({
    title: 'Ölçü',
    note: 'Gövde: 3,5 cm · Duvar boşluğu: 1,5 cm',
    fields: Object.freeze([
      Object.freeze({ name: 'widthCm', label: 'X · Genişlik (cm)', min: 10, max: 5000 }),
      Object.freeze({ name: 'heightCm', label: 'Y · Yükseklik (cm)', min: 5, max: 350 }),
    ]),
  }),
  'tulle-fabric': Object.freeze({
    title: 'Ölçü',
    fields: Object.freeze([
      Object.freeze({ name: 'widthCm', label: 'Genişlik (cm)', min: 1, max: 5000 }),
      Object.freeze({ name: 'heightCm', label: 'Derinlik (cm)', min: 1, max: 5000 }),
    ]),
  }),
});

const ITEM_SIZE_CHOICE_SPECS = Object.freeze({
  upright: Object.freeze({
    title: 'Dikme yüksekliği',
    list: () => listUprightHeightItems(),
    label: (item) => formatUprightLabel(item),
    readPreference: () => readUprightHeightPreference(),
    writePreference: (itemKey) => writeUprightHeightPreference(itemKey),
    apply: (moduleState, itemKey) => applyUprightItemKey(moduleState, itemKey),
    message: (item) => `Dikme yüksekliği: ${item?.name ?? ''}.`,
  }),
  profile: Object.freeze({
    title: 'Profil boyu',
    list: () => listProfileLengthItems(),
    label: (item) => formatProfileLengthLabel(item),
    readPreference: () => readProfileLengthPreference(),
    writePreference: (itemKey) => writeProfileLengthPreference(itemKey),
    apply: (moduleState, itemKey) => applyProfileItemKey(moduleState, itemKey),
    message: (item) => `Profil boyu: ${item?.name ?? ''}.`,
  }),
});

function describeDimensionFields(context) {
  if (context?.kind === 'floor') return context.fields;
  if (context?.multiModuleIds?.length > 1) return null;
  const index = findContextModuleIndex(context);
  const moduleState = index >= 0 ? currentModules[index] : null;
  if (!moduleState) return null;
  const locked = isModuleLocked(moduleState);
  const sizeSpec = SIZE_FIELD_SPECS[moduleState.type];
  if (sizeSpec) {
    return {
      key: moduleState.type,
      title: sizeSpec.title,
      note: sizeSpec.note,
      disabled: locked,
      fields: sizeSpec.fields.map((field) => ({
        ...field,
        value: field.name === 'opacity'
          ? Math.min(1, Math.max(0, Number(moduleState.opacity ?? 1)))
          : Math.round(Number(moduleState[field.name]) || 0),
      })),
    };
  }
  const choiceSpec = ITEM_SIZE_CHOICE_SPECS[moduleState.type];
  if (choiceSpec) {
    return {
      key: moduleState.type,
      title: choiceSpec.title,
      disabled: locked,
      fields: [
        {
          name: 'itemKey',
          type: 'select',
          label: 'Boy',
          options: choiceSpec.list().map((item) => ({ value: item.itemKey, label: choiceSpec.label(item) })),
          value: moduleState.itemKey,
        },
        { name: 'remember', type: 'checkbox', label: 'Bir daha sorma, aynı ölçüde getir', value: Boolean(choiceSpec.readPreference()) },
      ],
    };
  }
  if (!context.hasImage) return null;
  const area = scene3d.describeImageSizeTarget(scene3d.resolveImageBlock(context.surfaceId));
  if (!area.ok) return null;
  return {
    key: 'image',
    title: 'Görsel ölçüsü',
    note: `Seçili alan ${formatCm(area.areaWidthCm)} × ${formatCm(area.areaHeightCm)} cm. Yazarken önizlenir; Enter uygular, Esc vazgeçer.`,
    fields: [
      { name: 'widthCm', label: 'Genişlik (cm)', min: 1, max: 5000, step: 0.1, value: formatCm(area.currentWidthCm) },
      { name: 'heightCm', label: 'Yükseklik (cm)', min: 1, max: 5000, step: 0.1, value: formatCm(area.currentHeightCm) },
    ],
  };
}

// Görsel ölçüsü: yazarken önizleme (kayda yazmaz), Enter / alandan çıkış tek geri alma adımıyla
// uygular, Esc önizlemeyi bırakır.
let imageSizeSession = null;
function endImageSizeSession() {
  imageSizeSession?.preview.cancel();
  imageSizeSession = null;
}

function applyImageDimensionInput(context, values, phase) {
  if (phase === 'cancel') {
    endImageSizeSession();
    return;
  }
  if (imageSizeSession && imageSizeSession.surfaceId !== context.surfaceId) endImageSizeSession();
  if (!imageSizeSession) {
    const block = scene3d.resolveImageBlock(context.surfaceId);
    const area = scene3d.describeImageSizeTarget(block);
    if (!area.ok) {
      selectionInfo.textContent = area.message;
      return;
    }
    designHistory.capture();
    imageSizeSession = { surfaceId: context.surfaceId, preview: scene3d.beginImageSizePreview(block, area.assetId) };
  }
  const dimensions = { widthCm: Number(values.widthCm), heightCm: Number(values.heightCm) };
  if (phase === 'input') {
    imageSizeSession.preview.update(dimensions);
    return;
  }
  const result = imageSizeSession.preview.commit(dimensions);
  endImageSizeSession();
  if (!result.ok) {
    selectionInfo.textContent = result.message;
    return;
  }
  designHistory.capture();
  selectionInfo.textContent = describeSizeResult(result);
}

function applyDimensionInput(context, key, values, phase) {
  if (key === 'floor' || key === 'floor-area') {
    if (phase !== 'change') return;
    const typeSelect = key === 'floor-area' ? floorAreaTypeSelect : floorTypeSelect;
    if (!typeSelect || typeSelect.value === values.itemKey) return;
    typeSelect.value = values.itemKey;
    typeSelect.dispatchEvent(new Event('change'));
    schedulePropertyPanelRefresh();
    return;
  }
  if (key === 'image') {
    applyImageDimensionInput(context, values, phase);
    return;
  }
  if (phase === 'cancel') return;
  const index = findContextModuleIndex(context);
  const moduleState = index >= 0 ? currentModules[index] : null;
  if (!moduleState || moduleState.type !== key) return;
  if (isModuleLocked(moduleState)) {
    renderWallResult(MODULE_LOCKED_MESSAGE, true);
    return;
  }
  const choiceSpec = ITEM_SIZE_CHOICE_SPECS[key];
  if (choiceSpec) {
    if (phase !== 'change') return;
    // Çentik kalkarsa sonraki öğede yine sorulur.
    choiceSpec.writePreference(values.remember ? values.itemKey : null);
    if (values.itemKey === moduleState.itemKey) return;
    if (!choiceSpec.apply(moduleState, values.itemKey)) return;
    selectionInfo.textContent = choiceSpec.message(getItem(values.itemKey));
    rebuildWall({ resetView: false });
    return;
  }
  const sizeSpec = SIZE_FIELD_SPECS[key];
  if (!sizeSpec) return;
  const changed = sizeSpec.fields.some((field) => Number(moduleState[field.name] ?? (field.name === 'opacity' ? 1 : 0)) !== Number(values[field.name]));
  if (!changed) return;
  sizeSpec.fields.forEach((field) => { moduleState[field.name] = Number(values[field.name]); });
  rebuildWall({ resetView: false });
  selectionInfo.textContent = key === 'box-block'
    ? `Modül ${index + 1} · Kutu blok · ${moduleState.widthCm} × ${moduleState.depthCm} × ${moduleState.heightCm} cm · opacity ${moduleState.opacity}`
    : `Modül ${index + 1} · ${key === 'tulle-fabric' ? 'Tül' : 'Işıklı Strafor'} · ${moduleState.widthCm} × ${moduleState.heightCm} cm.`;
}

// Varyant: ailesi olan öğede üyeler Özellikler panelinde düğme olarak her zaman görünür.
function describeVariantChoices(context) {
  if (context?.kind === 'floor' || context?.multiModuleIds?.length > 1) return null;
  const index = findContextModuleIndex(context);
  const moduleState = index >= 0 ? currentModules[index] : null;
  const variants = moduleState ? describeModuleVariants(moduleState) : null;
  return variants ? { ...variants, disabled: isModuleLocked(moduleState) } : null;
}

// Varyant değişince öğenin kimliği, yeri, grubu ve kilidi kalır; yapısı aynı kalan renk, görsel
// ve cam / Lightbox ayarları yeni varyanta taşınır. Ölçü ve tür yeni Item'dan gelir.
const VARIANT_ITEM_KEYS = new Set([
  'id', 'itemKey', 'type', 'widthCm', 'depthCm', 'heightCm', 'variant', 'eyeCount', 'videoWallRows',
  'videoWallCols', 'stripOccupancy', 'modelFile', 'modelRotationYDeg', 'preserveModelScale', 'shape',
  'renderParts', 'unit', 'visualRotationYDeg', 'placement',
]);
const VARIANT_PART_KEYS = ['id', 'itemKey', 'widthCm', 'heightCm', 'depthCm'];

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function carryVariantValue(previous, next) {
  if (Array.isArray(previous) && Array.isArray(next)) {
    return previous.length === next.length
      ? next.map((entry, index) => carryVariantValue(previous[index], entry))
      : next;
  }
  if (!isPlainObject(previous) || !isPlainObject(next)) return next;
  const nextKeys = Object.keys(next);
  // Yüz haritası (faces): aynı yüzler varsa her yüz kendi ayarını taşır.
  if (nextKeys.length && nextKeys.every((key) => isPlainObject(next[key]))) {
    return Object.fromEntries(nextKeys.map((key) => [key, carryVariantValue(previous[key], next[key])]));
  }
  const identity = Object.fromEntries(VARIANT_PART_KEYS.filter((key) => key in next).map((key) => [key, next[key]]));
  return { ...next, ...structuredClone(previous), ...identity };
}

function carryVariantCustomizations(previous, next) {
  const sameStrips = (previous.strips?.length ?? 0) === (next.strips?.length ?? 0);
  for (const [key, value] of Object.entries(previous)) {
    if (VARIANT_ITEM_KEYS.has(key)) continue;
    if (key in next) next[key] = carryVariantValue(value, next[key]);
    else if (!Array.isArray(value) || sameStrips) next[key] = structuredClone(value);
  }
  next.id = previous.id;
  next.placement = { ...previous.placement };
}

// Öğe yerinden oynamaz. Duvar zincirinde yeni genişlik için sonraki (gerekirse önceki) modüller
// itilir. Zincir dışında (ör. ada standı) öğe bitiştiği (snap) kenara göre büyür: solunda bitişik
// öğe varsa sol kenarı sabit kalır, sağdaki bitişik sıra itilir; yalnız sağı bitişikse sağ kenarı
// sabit kalır, soldaki sıra itilir; hiçbir yere bitişik değilse ortası sabit kalır. Sığmıyorsa
// değişiklik reddedilir, öğe başka yere taşınmaz.
const VARIANT_SNAP_TOLERANCE_CM = 1;
// Köşe snap'i: dik duran ince duvar uca duvar kalınlığı kadar uzakta durabilir.
const VARIANT_CORNER_TOLERANCE_CM = 12;
const VARIANT_THIN_DEPTH_CM = 12;

function segmentPointDistanceCm(point, segment) {
  const along = segment.axis === 'x' ? point.xCm : point.yCm;
  const across = segment.axis === 'x' ? point.yCm : point.xCm;
  const outside = Math.max(segment.startCm - along, 0, along - segment.endCm);
  return Math.hypot(outside, across - segment.fixedCm);
}

function standExtentCm(axis) {
  return Number(axis === 'y' ? currentStand.yCm : currentStand.xCm);
}

// Ucun bir yere bitişik (snap'li) olup olmadığı: stand kenarı, aynı hattaki komşu ya da köşedeki
// dik ince duvar.
function variantEdgeIsSnapped(previous, interval, edgeCm) {
  if (edgeCm <= VARIANT_SNAP_TOLERANCE_CM || edgeCm >= standExtentCm(interval.axis) - VARIANT_SNAP_TOLERANCE_CM) {
    return true;
  }
  const cross = Number(previous.placement[crossFieldOf(interval.axis)]);
  const point = interval.axis === 'y' ? { xCm: cross, yCm: edgeCm } : { xCm: edgeCm, yCm: cross };
  return currentModules.some((moduleState) => moduleState.id !== previous.id
    && !isWallOverlayModule(moduleState) && !isTopPlacementModule(moduleState)
    && Number(moduleState.depthCm) <= VARIANT_THIN_DEPTH_CM
    && getModuleGroundSegments(moduleState).some((segment) => (
      segmentPointDistanceCm(point, segment) <= (segment.axis === interval.axis
        ? VARIANT_SNAP_TOLERANCE_CM
        : VARIANT_CORNER_TOLERANCE_CM)
    )));
}

function placementFieldOf(axis) {
  return axis === 'y' ? 'yCm' : 'xCm';
}

function crossFieldOf(axis) {
  return axis === 'y' ? 'xCm' : 'yCm';
}

// Aynı hatta (aynı eksen, aynı derinlik çizgisi) duran, duvar üstü / tepe olmayan öğeler.
function listVariantRowModules(previous, interval) {
  const cross = crossFieldOf(interval.axis);
  return currentModules
    .filter((moduleState) => moduleState.id !== previous.id
      && !isWallOverlayModule(moduleState) && !isTopPlacementModule(moduleState))
    .map((moduleState) => ({ moduleState, interval: getPlacementInterval(moduleState.placement, moduleState.widthCm) }))
    .filter((entry) => entry.interval?.axis === interval.axis
      && Math.abs(Number(entry.moduleState.placement[cross]) - Number(previous.placement[cross])) <= VARIANT_SNAP_TOLERANCE_CM);
}

// Yeni varyantın aday yerleri (sırayla denenir). Her aday: öğenin yeni yeri + itilen öğelerin yerleri.
function planFreeVariantCandidates(previous, next) {
  const interval = getPlacementInterval(previous.placement, previous.widthCm);
  const widthCm = Number(next.widthCm);
  if (!interval) return [{ placement: next.placement, placements: new Map() }];
  const field = placementFieldOf(interval.axis);
  const at = (startCm) => ({ ...next.placement, [field]: startCm });
  // Ortası sabit; stand kenarını aşacaksa stand içine yaslanır.
  const centeredCm = Math.max(0, Math.min(
    interval.startCm - (widthCm - Number(previous.widthCm)) / 2,
    standExtentCm(interval.axis) - widthCm,
  ));
  if (isWallOverlayModule(next) || isTopPlacementModule(next)) {
    // Duvar üstü öğe (TV, raf…) takılı olduğu yerde ortası sabit büyür.
    return [{ placement: at(centeredCm), placements: new Map() }];
  }
  const row = listVariantRowModules(previous, interval);
  // Sol kenar sabit; sağdaki bitişik sıra gerektiği kadar itilir.
  const anchorStart = () => {
    const placements = new Map();
    let cursorCm = interval.startCm + widthCm;
    const ahead = row
      .filter((entry) => entry.interval.startCm >= interval.endCm - VARIANT_SNAP_TOLERANCE_CM)
      .sort((a, b) => a.interval.startCm - b.interval.startCm);
    for (const entry of ahead) {
      if (entry.interval.startCm >= cursorCm - 0.001) break;
      placements.set(entry.moduleState.id, { ...entry.moduleState.placement, [field]: cursorCm });
      cursorCm += Number(entry.moduleState.widthCm);
    }
    return { placement: at(interval.startCm), placements };
  };
  // Sağ kenar sabit; soldaki bitişik sıra gerektiği kadar itilir.
  const anchorEnd = () => {
    const placements = new Map();
    let cursorCm = interval.endCm - widthCm;
    const behind = row
      .filter((entry) => entry.interval.endCm <= interval.startCm + VARIANT_SNAP_TOLERANCE_CM)
      .sort((a, b) => b.interval.endCm - a.interval.endCm);
    for (const entry of behind) {
      if (entry.interval.endCm <= cursorCm + 0.001) break;
      const startCm = cursorCm - Number(entry.moduleState.widthCm);
      placements.set(entry.moduleState.id, { ...entry.moduleState.placement, [field]: startCm });
      cursorCm = startCm;
    }
    return { placement: at(interval.endCm - widthCm), placements };
  };
  const touchesStart = variantEdgeIsSnapped(previous, interval, interval.startCm);
  const touchesEnd = variantEdgeIsSnapped(previous, interval, interval.endCm);
  if (!touchesStart && !touchesEnd) return [{ placement: at(centeredCm), placements: new Map() }];
  // Snaplı kenar önce sabit tutulur; o yöne sığmazsa karşı kenar denenir.
  return touchesStart || !touchesEnd ? [anchorStart(), anchorEnd()] : [anchorEnd(), anchorStart()];
}

function validateVariantModule(moduleState, placement, modules) {
  return validatePlacementAgainstModules({
    placement,
    widthCm: moduleState.widthCm,
    depthCm: moduleState.depthCm,
    moduleId: moduleState.id,
    moduleType: moduleState.type,
    itemKey: moduleState.itemKey,
    heightCm: moduleState.heightCm,
    shape: moduleState.shape,
    modules,
    standType: currentStand.standType,
    standXCm: currentStand.xCm,
    standYCm: currentStand.yCm,
  });
}

// Aday sahneye uygulanmış gibi denetlenir: yeni varyant ve itilen öğeler, değişiklik sonrası sahneye göre.
function checkVariantCandidate(previous, next, candidate) {
  const guarded = guardPlanAgainstLocks({ ok: true, placements: candidate.placements }, currentModules);
  if (!guarded.ok) return guarded;
  const placed = { ...next, placement: candidate.placement };
  const after = currentModules.map((moduleState) => {
    if (moduleState.id === previous.id) return placed;
    const placement = candidate.placements.get(moduleState.id);
    return placement ? { ...moduleState, placement } : moduleState;
  });
  for (const moduleState of after.filter((entry) => entry === placed || candidate.placements.has(entry.id))) {
    const validation = validateVariantModule(
      moduleState,
      moduleState.placement,
      after.filter((entry) => entry.id !== moduleState.id),
    );
    if (!validation.ok) return { ok: false, message: validation.message ?? 'Bu varyant bu konuma sığmıyor.' };
  }
  return { ok: true };
}

function planVariantFit(previous, next) {
  const chain = planContinuousWallReplacement({
    // Zincirde eski modül (eski genişlik) durur; yerine yeni varyant konur.
    modules: withStandEdgeWallIds(currentModules, currentStand.standType, currentStand.xCm),
    replacement: next,
    standType: currentStand.standType,
    standXCm: currentStand.xCm,
    standYCm: currentStand.yCm,
  });
  if (!chain.notInChain) return guardPlanAgainstLocks(chain, currentModules);
  let failure = null;
  for (const candidate of planFreeVariantCandidates(previous, next)) {
    const result = checkVariantCandidate(previous, next, candidate);
    if (result.ok) {
      next.placement = candidate.placement;
      return { ok: true, placements: candidate.placements };
    }
    failure ??= result;
  }
  return failure ?? { ok: false, message: 'Bu varyant bu konuma sığmıyor.' };
}

// Duvar üstü öğeler (TV, logo, raf…) takılı oldukları öğe kayınca onunla birlikte kayar:
// aynı eksende, aynı hatta ve ortası öğenin eski aralığında duranlar.
const VARIANT_MOUNT_DEPTH_CM = 40;

function carryMountedOverlays(before, changedId) {
  const moved = new Set();
  before.forEach((host, hostId) => {
    // Değişen öğenin üstündekiler yerinde kalır; yalnız itilen öğelerin üstündekiler kayar.
    if (hostId === changedId) return;
    const after = currentModules.find((moduleState) => moduleState.id === hostId)?.placement;
    const hostInterval = getPlacementInterval(host.placement, host.widthCm);
    if (!after || !hostInterval) return;
    const field = placementFieldOf(hostInterval.axis);
    const cross = crossFieldOf(hostInterval.axis);
    const delta = Number(after[field]) - Number(host.placement[field]);
    if (!Number.isFinite(delta) || Math.abs(delta) < 0.001) return;
    for (const overlay of currentModules) {
      if (moved.has(overlay.id) || !isWallOverlayModule(overlay)) continue;
      const mount = before.get(overlay.id);
      const mountInterval = mount ? getPlacementInterval(mount.placement, overlay.widthCm) : null;
      if (!mountInterval || mountInterval.axis !== hostInterval.axis) continue;
      if (Math.abs(Number(mount.placement[cross]) - Number(host.placement[cross])) > VARIANT_MOUNT_DEPTH_CM) continue;
      const center = (mountInterval.startCm + mountInterval.endCm) / 2;
      if (center < hostInterval.startCm || center > hostInterval.endCm) continue;
      overlay.placement = { ...overlay.placement, [field]: Number(mount.placement[field]) + delta };
      moved.add(overlay.id);
    }
  });
}

function changeModuleVariant(context, itemKey, optionOn) {
  const index = findContextModuleIndex(context);
  const previous = index >= 0 ? currentModules[index] : null;
  if (!previous || !currentStand) return;
  if (isModuleLocked(previous)) {
    renderWallResult(MODULE_LOCKED_MESSAGE, true);
    return;
  }
  const nextKey = resolveModuleVariantItemKey(previous, itemKey, optionOn);
  const next = nextKey ? createCatalogModuleState({ itemKey: nextKey }, { itemKey: nextKey }) : null;
  if (!next) {
    renderWallResult('Bu varyant bu öğe için kullanılamıyor.', true);
    schedulePropertyPanelRefresh();
    return;
  }
  if (next.itemKey === previous.itemKey) return;
  carryVariantCustomizations(previous, next);
  const plan = planVariantFit(previous, next);
  if (!plan.ok) {
    renderWallResult(plan.message ?? 'Bu varyant bu konuma sığmıyor.', true);
    schedulePropertyPanelRefresh();
    return;
  }
  designHistory.capture();
  // Kaymadan önceki yerler: duvar kimliği stand kenarına göre okunur (serbest bırakılmış duvar öğesi dahil).
  const edgeWallIds = new Map(withStandEdgeWallIds(currentModules, currentStand.standType, currentStand.xCm)
    .map((moduleState) => [moduleState.id, moduleState.placement?.wallId ?? null]));
  const before = new Map(currentModules.map((moduleState) => [moduleState.id, {
    placement: { ...moduleState.placement, wallId: edgeWallIds.get(moduleState.id) },
    wallId: edgeWallIds.get(moduleState.id),
    widthCm: moduleState.widthCm,
  }]));
  currentModules[index] = next;
  plan.placements.forEach((placement, moduleId) => {
    const moduleState = currentModules.find((candidate) => candidate.id === moduleId);
    if (moduleState) moduleState.placement = { ...placement };
  });
  carryMountedOverlays(before, next.id);
  rebuildWall({ resetView: false });
  // Seçim aynı öğede kalır; panel yeni varyantla açık durur.
  scene3d.selectModuleSurface(next.id);
  designHistory.capture();
  selectionInfo.textContent = `${getModuleCatalogLabel(next)} seçildi.`;
}

const moduleContextMenu = createModuleContextMenu({
  onClearSelection: () => {
    moduleDragSidebar?.cancelPlacement();
    scene3d.setMultiSelectMode(false);
    scene3d.clearSelection();
    selectionToolbar.update(null);
    if (!viewport.hasAttribute('tabindex')) viewport.tabIndex = -1;
    viewport.focus({ preventScroll: true });
  },
  onDelete: deleteContextModule,
  onDuplicate: copyContextModule,
  onAdd: addCatalogModule,
  onGlassModeChange: changeContextPanelGlassMode,
  onMetalSeparatorModeChange: changeContextMetalSeparatorMode,
  onFabricModeChange: changeContextFabricMode,
  onMeshModeChange: changeContextMeshMode,
  onFabricLightingChange: changeContextFabricLighting,
  getShelfLightingState: getContextShelfLightingState,
  onShelfLightingChange: changeContextShelfLighting,
  getBackPanelState: getContextBackPanelState,
  onBackPanelChange: changeContextBackPanels,
  onLockChange: changeModuleLock,
  onRotate: (context, deltaDeg) => scene3d.rotateModuleById(context.moduleId, deltaDeg),
  onGroupAction: (action, context) => handleGroupAction(action, {
    groupId: context?.group?.id ?? null,
    moduleId: context?.moduleId ?? null,
    moduleIds: context?.multiModuleIds ?? null,
    addTarget: context?.groupOptions?.addTarget ?? null,
  }),
  onAfterAction: () => schedulePropertyPanelRefresh(),
  getVariantChoices: describeVariantChoices,
  onVariantChange: changeModuleVariant,
  getDimensionFields: describeDimensionFields,
  onDimensionInput: applyDimensionInput,
  surfaceControls: surfaceEditControls
    ? {
      element: surfaceEditControls,
      colorSection: document.querySelector('#surface-color-controls'),
      imageSection: document.querySelector('#surface-image-controls'),
      homeNote: document.querySelector('#surface-controls-moved'),
    }
    : null,
  statusElement: selectionInfo,
});
propertyPanelReady = true;
// Renk / görsel değişince panelin değer özeti güncellenir.
['input', 'change', 'click'].forEach((type) => {
  surfaceEditControls?.addEventListener(type, () => schedulePropertyPanelRefresh());
});

moduleGroupPanel = createModuleGroupPanel({
  list: document.querySelector('#module-groups-list'),
  empty: document.querySelector('#module-groups-empty'),
  document,
  describeModule: (moduleState) => (moduleState ? getModuleCatalogLabel(moduleState) : '—'),
  onAction: (action, { groupId, moduleId }) => handleGroupAction(action, { groupId, moduleId }),
});

groupTemplatePanel = createGroupTemplatePanel({
  list: document.querySelector('#module-templates-list'),
  empty: document.querySelector('#module-templates-empty'),
  document,
  onAction: (action, { templateId }) => void handleGroupTemplateAction(action, templateId),
});

// Kurumsal şablon: grubu organizasyon kataloğuna kaydet (Item değildir; görseller saklanmaz).
async function saveGroupAsTemplate(group) {
  if (!isGroupTemplateRemoteEnabled()) {
    reportGroupResult(GROUP_TEMPLATES_REMOTE_REQUIRED_MESSAGE, true);
    return;
  }
  if (!(capabilities.canCreate || capabilities.canUpdate)) {
    reportGroupResult('Şablon kaydetmek için yetkiniz yok.', true);
    return;
  }
  const built = buildGroupTemplatePayload(currentModules, group.id);
  if (!built.ok) {
    reportGroupResult(built.message, true);
    return;
  }
  const name = window.prompt('Şablon adı', group.name);
  if (name === null) return;
  try {
    const saved = await createGroupTemplate(name, built.payload);
    await refreshGroupTemplates();
    reportGroupResult(`“${saved.name}” şablonu kaydedildi · ${saved.memberCount} parça. Renk, cam ve metal separatör korunur; görseller ve kumaş şablona girmez.`);
  } catch (error) {
    reportGroupResult(`Şablon kaydedilemedi: ${error.message}`, true);
  }
}

async function handleGroupTemplateAction(action, templateId) {
  const template = groupTemplates.find((item) => item.id === templateId);
  if (!template) return;
  try {
    if (action === 'template-place') {
      if (!currentStand) {
        reportGroupResult('Şablonu yerleştirmek için önce sahneyi oluşturun.', true);
        return;
      }
      const detail = await getGroupTemplate(template.id);
      const placed = instantiateGroupTemplate(detail.payload, {
        name: template.name,
        stand: getGroupStand(),
        duplicateModule: duplicateModuleState,
        hasItem: (itemKey) => Boolean(getItem(itemKey)),
      });
      if (!placed.ok) {
        reportGroupResult(placed.message, true);
        return;
      }
      currentModules.push(...placed.clones.map(normalizeModuleItemState));
      syncSceneToModules();
      reportGroupResult(`“${template.name}” yerleştirildi · ${placed.clones.length} parça, yeni grup. Sürükleyerek yerine taşıyın.`
        + (placed.skipped.length ? ` Katalogda olmayan ${placed.skipped.length} parça atlandı: ${placed.skipped.join(', ')}.` : ''));
      return;
    }
    if (action === 'template-rename') {
      const name = window.prompt('Şablonun yeni adı', template.name);
      if (name === null) return;
      const renamed = await renameGroupTemplate(template.id, name);
      await refreshGroupTemplates();
      reportGroupResult(`Şablonun adı “${renamed.name}” oldu.`);
      return;
    }
    if (action === 'template-delete') {
      if (!window.confirm(`“${template.name}” şablonu silinecek. Sahnedeki gruplar etkilenmez. Devam edilsin mi?`)) return;
      await deleteGroupTemplate(template.id);
      await refreshGroupTemplates();
      reportGroupResult(`“${template.name}” şablonu silindi.`);
    }
  } catch (error) {
    reportGroupResult(`Şablon işlemi başarısız: ${error.message}`, true);
  }
}

// Seçim bilgisine kilit durumu: tek kilitli öğede " · Kilitli", toplu seçimde sayılar.
function describeModuleLockSelection(message, selectedModuleIds = []) {
  if (!selectedModuleIds.length) return message;
  const byId = new Map(currentModules.map((module) => [module.id, module]));
  const lockedCount = selectedModuleIds.filter((id) => isModuleLocked(byId.get(id))).length;
  if (selectedModuleIds.length > 1) {
    return `${selectedModuleIds.length} öğe seçili${lockedCount ? ` · ${lockedCount} kilitli` : ''}. `
      + 'Ctrl/Cmd+tık ile ekle/çıkar; Ctrl/Cmd+A ile tümünü seç; toplu işlemler Özellikler panelinde.';
  }
  return lockedCount ? `${message} · Kilitli` : message;
}

// Kilit yalnız proje örneğinin durumudur: sahne yeniden kurulmaz, otomatik kayıt
// modül imzasındaki değişikliği görüp kaydeder.
function changeModuleLock(moduleIds, locked) {
  // Kilitli grubun üyesi tek başına açılamaz; grup kilidi gruptan açılır.
  if (!locked) {
    unlockFullySelectedGroups(currentModules, moduleIds);
    const byId = new Map(currentModules.map((module) => [module.id, module]));
    const groupLockedIds = moduleIds.filter((id) => getModuleGroup(byId.get(id))?.locked === true
      && byId.get(id)?.locked !== true);
    if (groupLockedIds.length) {
      moduleIds = moduleIds.filter((id) => !groupLockedIds.includes(id));
      if (!moduleIds.length) {
        selectionInfo.textContent = GROUP_LOCKED_MESSAGE;
        scene3d.showPlacementFeedback(GROUP_LOCKED_MESSAGE, { durationMs: 2200 });
        return 0;
      }
    }
  }
  const changed = setModulesLocked(currentModules, moduleIds, locked);
  renderModuleGroupPanel();
  const count = moduleIds.length;
  const subject = count > 1 ? `${count} öğe` : 'Öğe';
  selectionInfo.textContent = locked
    ? `${subject} kilitlendi. Taşınamaz, döndürülemez ve silinemez; renk ve görsel değiştirilebilir.`
    : `${subject} kilidi açıldı.`;
  return changed;
}

// Panel bağlamı: sahnenin seçim bağlamına kilit, grup ve seçili yüzey özeti eklenir;
// toplu seçimdeki bir öğeye sağ tıklanırsa panel bütün seçime uygulanır.
function buildPropertyPanelContext(context) {
  if (!context) return null;
  const byId = new Map(currentModules.map((module) => [module.id, module]));
  const selectedIds = scene3d.getSelectedModuleIds();
  const surfaceSummary = summarizeSelectedSurfaces(scene3d.getSelectedSurfaces());
  // Toplu seçim varken panel her zaman bütün seçime uygulanır (sağ tık komşu
  // öğeye kaymış olsa bile); aksi halde "Grup oluştur" görünmüyordu.
  if (selectedIds.length > 1) {
    const groups = new Set(selectedIds.map((id) => getModuleGroup(byId.get(id))?.id ?? null));
    const [onlyGroupId] = groups;
    const selectionGroup = groups.size === 1 && onlyGroupId
      ? getModuleGroup(byId.get(selectedIds[0]))
      : null;
    return {
      ...context,
      surfaceSummary,
      multiModuleIds: selectedIds,
      multiLockedCount: selectedIds.filter((id) => isModuleLocked(byId.get(id))).length,
      groupOptions: describeSelectionGroupOptions(selectedIds, byId),
      selectionGroupName: selectionGroup?.name ?? null,
    };
  }
  const moduleState = byId.get(context.moduleId);
  const group = getModuleGroup(moduleState);
  return {
    ...context,
    surfaceSummary,
    locked: isModuleLocked(moduleState),
    ownLocked: moduleState?.locked === true,
    group: group
      ? { id: group.id, name: group.name, locked: group.locked === true, count: getGroupMembers(currentModules, group.id).length }
      : null,
  };
}

function openModuleContextMenu(context) {
  moduleContextMenu.open(buildPropertyPanelContext(context));
}

// Zemin seçiliyken panel "Zemin" başlığıyla yalnız renk gösterir (parke boyanmaz).
function buildFloorPanelContext() {
  const areaSelected = scene3d.isFloorAreaSelected();
  if (!areaSelected && !scene3d.isFloorSelected()) return null;
  const floorItem = getFloorItem(areaSelected ? currentStand?.floorArea?.itemKey : scene3d.getSelectedFloorType());
  const paintable = !floorItem || floorItem.paintable !== false;
  // Kaplama seçimi Stand Tipi'ndeki mevcut zemin listesidir (tek kaynak): panel o listeyi sürer.
  const typeSelect = areaSelected ? floorAreaTypeSelect : floorTypeSelect;
  return {
    kind: 'floor',
    fields: typeSelect
      ? {
        key: areaSelected ? 'floor-area' : 'floor',
        title: 'Zemin kaplaması',
        fields: [{
          name: 'itemKey',
          type: 'select',
          label: 'Kaplama',
          options: [...typeSelect.options].map((option) => ({ value: option.value, label: option.textContent })),
          value: typeSelect.value,
        }],
      }
      : null,
    title: areaSelected ? 'Zemin alanı' : 'Zemin',
    subtitle: [floorItem?.name, paintable ? '' : 'boyanmaz'].filter(Boolean).join(' · '),
    surfaceSummary: {
      count: 1,
      moduleCount: 0,
      support: { color: paintable ? 'all' : 'none', image: 'none', glass: 'none', lightbox: 'none', mesh: 'none' },
      color: null,
      imageAssetId: null,
    },
  };
}

// Açık / açılacak panelin güncel bağlamı: öğe / yüzey, yoksa zemin, yoksa seçim yok.
function currentPropertyPanelContext() {
  const context = scene3d.getSelectionContext();
  return context ? buildPropertyPanelContext(context) : buildFloorPanelContext();
}

// Sahnede öğeye / yüzeye tek tık (veya dokunma) Özellikler panelini açar; boş alana tık
// paneli kapatır. Sürükleme, kamera hareketi, sağ tık ve kopya yerleştirme paneli açmaz.
const PANEL_CLICK_MOVE_PX = 6;
let panelClickStart = null;
// Kumaş taşıma kilidi ve çoklu seçim tuvalde yayılımı durdursa da tıklamayı yakala.
viewport.addEventListener('pointerdown', (event) => {
  panelClickStart = event.button === 0 && event.isPrimary && !moduleDragSidebar?.isPlacementArmed()
    ? { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY }
    : null;
}, { capture: true });
window.addEventListener('pointerup', (event) => {
  const start = panelClickStart;
  panelClickStart = null;
  if (!start || start.pointerId !== event.pointerId || !currentStand) return;
  if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > PANEL_CLICK_MOVE_PX) return;
  // Sahnenin kendi pointerup seçimi bittikten sonra güncel seçim okunur.
  queueMicrotask(() => {
    const context = currentPropertyPanelContext();
    if (context) moduleContextMenu.open(context);
    else moduleContextMenu.close();
  });
});

// Açık panel seçim, işlem, geri al / ileri al ve sahne kurulumundan sonra güncel seçimle
// yeniden çizilir. Aynı turdaki çağrılar tek çizimde birleşir; kapalı panel için iş yapılmaz.
function schedulePropertyPanelRefresh() {
  if (!propertyPanelReady || propertyPanelRefreshQueued || !moduleContextMenu.isOpen()) return;
  propertyPanelRefreshQueued = true;
  queueMicrotask(() => {
    propertyPanelRefreshQueued = false;
    moduleContextMenu.refresh(currentPropertyPanelContext());
  });
}

// Toplu seçimde grup komutları: her zaman "Grup oluştur"; seçim tek bir grubun
// parçalarını ve grupsuz/başka öğeleri içeriyorsa "Gruba ekle: <grup>".
function describeSelectionGroupOptions(selectedIds, byId) {
  const groups = new Map();
  selectedIds.forEach((id) => {
    const group = getModuleGroup(byId.get(id));
    if (group) groups.set(group.id, group);
  });
  let addTarget = null;
  if (groups.size === 1) {
    const [group] = groups.values();
    const outsiders = selectedIds.filter((id) => getModuleGroup(byId.get(id))?.id !== group.id);
    if (outsiders.length) addTarget = { id: group.id, name: group.name, locked: group.locked === true };
  }
  const selected = new Set(selectedIds);
  const completeGroups = listGroups(currentModules).filter((group) => group.moduleIds.every((id) => selected.has(id)));
  return { canCreate: selectedIds.length >= 2, addTarget, canDissolve: completeGroups.length > 0, dissolveLocked: completeGroups.some((group) => group.locked) };
}

function reportGroupResult(message, isError = false) {
  selectionInfo.textContent = message;
  if (isError) scene3d.showPlacementFeedback(message, { durationMs: 2200 });
}

// Bir öğe aynı anda tek grupta olur: başka gruptaki öğe sorularak taşınır.
function confirmGroupMove(conflicts, targetName) {
  const names = [...new Set(conflicts.map((conflict) => `“${conflict.groupName}”`))].join(', ');
  const subject = conflicts.length > 1 ? `${conflicts.length} öğe` : 'Bu öğe';
  return window.confirm(`${subject} şu an ${names} grubunda. Bu gruptan çıkarılıp “${targetName}” grubuna eklensin mi?`);
}

function handleGroupAction(action, { groupId = null, moduleId = null, moduleIds = null, addTarget = null } = {}) {
  if (!currentStand) return;
  const stand = getGroupStand();
  const group = groupId ? listGroups(currentModules).find((candidate) => candidate.id === groupId) : null;

  if (action === 'group-dissolve-selection') {
    const capturedContent = captureModuleContent();
    const result = dissolveSelectedGroups(currentModules, moduleIds ?? [], { stand });
    if (!result.ok) return reportGroupResult(result.message, true);
    syncSceneAfterModuleChange(capturedContent);
    reportGroupResult(`${result.count} grup çözüldü; parçalar yerinde kaldı.`);
    return;
  }

  if (action === 'group-create') {
    const ids = moduleIds ?? [];
    if (ids.length < 2) {
      reportGroupResult('Grup için Shift+tık ile en az 2 öğe seçin.', true);
      return;
    }
    const name = window.prompt('Grup adı', nextGroupName(currentModules));
    if (name === null) return;
    const capturedContent = captureModuleContent();
    let result = createGroup(currentModules, ids, { name, stand });
    if (!result.ok && result.reason === 'conflict') {
      if (!confirmGroupMove(result.conflicts, name.trim() || nextGroupName(currentModules))) return;
      result = createGroup(currentModules, ids, { name, stand, moveFromOtherGroups: true });
    }
    if (!result.ok) {
      reportGroupResult(result.message ?? 'Grup oluşturulamadı.', true);
      return;
    }
    syncSceneAfterModuleChange(capturedContent);
    const detached = getGroupMembers(currentModules, result.group.id).filter((member) => member.group?.fromWallId).length;
    reportGroupResult(`“${result.group.name}” grubu oluşturuldu · ${result.group.moduleIds.length} parça.`
      + (detached ? ` ${detached} duvar parçası kenardan ayrıldı; grup her yöne taşınabilir.` : ''));
    return;
  }

  if (action === 'group-add') {
    if (!addTarget) return;
    const ids = (moduleIds ?? []).filter((id) => getModuleGroup(currentModules.find((m) => m.id === id))?.id !== addTarget.id);
    const capturedContent = captureModuleContent();
    let result = addToGroup(currentModules, addTarget.id, ids, { stand });
    if (!result.ok && result.reason === 'conflict') {
      if (!confirmGroupMove(result.conflicts, addTarget.name)) return;
      result = addToGroup(currentModules, addTarget.id, ids, { stand, moveFromOtherGroups: true });
    }
    if (!result.ok) {
      reportGroupResult(result.message ?? 'Gruba eklenemedi.', true);
      return;
    }
    syncSceneAfterModuleChange(capturedContent);
    reportGroupResult(`${result.added} öğe “${addTarget.name}” grubuna eklendi.`);
    return;
  }

  if (!group) return;

  if (action === 'group-select') {
    scene3d.selectModulesById(group.moduleIds);
    return;
  }
  if (action === 'group-save-template') {
    void saveGroupAsTemplate(group);
    return;
  }
  if (action === 'group-select-member') {
    if (moduleId) scene3d.selectModulesById([moduleId]);
    return;
  }
  if (action === 'group-rename') {
    const name = window.prompt('Grubun yeni adı', group.name);
    if (name === null) return;
    const result = renameGroup(currentModules, group.id, name);
    renderModuleGroupPanel();
    reportGroupResult(`Grubun adı “${result.name}” oldu.`);
    return;
  }
  if (action === 'group-lock') {
    const locked = !group.locked;
    setGroupLocked(currentModules, group.id, locked);
    renderModuleGroupPanel();
    reportGroupResult(locked
      ? `“${group.name}” grubu kilitlendi · ${group.moduleIds.length} parça taşınamaz, döndürülemez ve silinemez.`
      : `“${group.name}” grubunun kilidi açıldı.`);
    return;
  }
  if (action === 'group-duplicate') {
    const result = planGroupDuplicate(currentModules, group.id, stand, { duplicateModule: duplicateModuleState });
    if (!result.ok) {
      reportGroupResult(result.message, true);
      return;
    }
    currentModules.push(...result.clones);
    syncSceneToModules();
    reportGroupResult(`“${group.name}” çoğaltıldı · yeni grup “${result.group.name}”, ${result.clones.length} parça.`);
    return;
  }
  if (action === 'group-remove-member') {
    const capturedContent = captureModuleContent();
    const result = removeFromGroup(currentModules, moduleId ? [moduleId] : [], { stand });
    if (!result.ok) {
      reportGroupResult(result.message, true);
      return;
    }
    syncSceneAfterModuleChange(capturedContent);
    reportGroupResult(result.dissolved.length
      ? `Parça gruptan çıkarıldı; grupta tek parça kaldığı için “${group.name}” çözüldü.`
      : `Parça “${group.name}” grubundan çıkarıldı.`);
    return;
  }
  if (action === 'group-dissolve') {
    const capturedContent = captureModuleContent();
    const result = dissolveGroup(currentModules, group.id, { stand });
    if (!result.ok) {
      reportGroupResult(result.message, true);
      return;
    }
    syncSceneAfterModuleChange(capturedContent);
    reportGroupResult(`“${group.name}” grubu çözüldü; parçalar yerinde kaldı.`);
    return;
  }
  if (action === 'group-delete') {
    if (group.locked) {
      reportGroupResult(GROUP_LOCKED_MESSAGE, true);
      return;
    }
    const ids = new Set(group.moduleIds);
    currentModules = currentModules.filter((module) => !ids.has(module.id));
    scene3d.clearSelection();
    syncSceneToModules();
    reportGroupResult(`“${group.name}” grubu silindi · ${ids.size} parça.`);
  }
}

moduleDragSidebar = createModuleDragSidebar({
  container: document.querySelector('#module-add-content'),
  viewport,
  canDrag: () => Boolean(currentStand),
  createModuleState: (module, moduleKey) => createCatalogModuleState(module, { itemKey: moduleKey }),
  onPreview: (moduleState, clientX, clientY, rotationZDeg, rotationLocked) => (
    scene3d.previewCatalogModuleDrag(
      moduleState,
      clientX,
      clientY,
      rotationZDeg,
      rotationLocked,
    )
  ),
  onDrop: (droppedState, clientX, clientY, rotationZDeg, rotationLocked, catalogKey) => {
    void (async () => {
      // Varyant ailesinde kartın kendisi (varsayılan varyant) konur; varyant Özellikler panelinde seçilir.
      const moduleState = droppedState;
      const result = scene3d.dropCatalogModuleDrag(
        moduleState,
        clientX,
        clientY,
        rotationZDeg,
        rotationLocked,
      );
      if (!result?.ok) {
        renderWallResult(result?.message ?? 'Modül bu konuma bırakılamadı.', true);
        scene3d.clearCatalogModuleDrag();
        return;
      }
      if (moduleState?.type === 'tulle-fabric') {
        const dimensions = await requestTulleFabricDimensions(moduleState.widthCm, moduleState.heightCm);
        if (!dimensions) {
          scene3d.clearCatalogModuleDrag();
          return;
        }
        moduleState.widthCm = dimensions.widthCm;
        moduleState.heightCm = dimensions.heightCm;
      }
      if (moduleState?.type === 'upright') {
        // Varsayılan seçili duvar yüksekliğinin dikmesi; "Bir daha sorma" tercihi varsa sorulmaz.
        let itemKey = readUprightHeightPreference();
        if (!itemKey) {
          const choice = await requestUprightHeight({
            selectedItemKey: defaultUprightItemKeyForWallHeight(getActiveWallLineHeightCm()),
          });
          if (!choice) {
            scene3d.clearCatalogModuleDrag();
            return;
          }
          itemKey = choice.itemKey;
          if (choice.remember) writeUprightHeightPreference(itemKey);
        }
        applyUprightItemKey(moduleState, itemKey);
      }
      if (moduleState?.type === 'profile') {
        // Varsayılan kartın boyu; "Bir daha sorma" tercihi varsa sorulmaz.
        let itemKey = readProfileLengthPreference();
        if (!itemKey) {
          const choice = await requestProfileLength({ selectedItemKey: moduleState.itemKey });
          if (!choice) {
            scene3d.clearCatalogModuleDrag();
            return;
          }
          itemKey = choice.itemKey;
          if (choice.remember) writeProfileLengthPreference(itemKey);
        }
        applyProfileItemKey(moduleState, itemKey);
      }
      if (moduleState?.type === 'box-block') {
        const dimensions = await requestBoxBlockDimensions({
          widthCm: moduleState.widthCm,
          depthCm: moduleState.depthCm,
          heightCm: moduleState.heightCm,
          opacity: moduleState.opacity,
        });
        if (!dimensions) {
          scene3d.clearCatalogModuleDrag();
          return;
        }
        moduleState.widthCm = dimensions.widthCm;
        moduleState.depthCm = dimensions.depthCm;
        moduleState.heightCm = dimensions.heightCm;
        moduleState.opacity = dimensions.opacity;
      }
      // Dikme ve profilde kart tek (upright_346_5, profile_289); kayıt seçilen boyun anahtarıyla yapılır.
      const commitKey = moduleState?.type === 'upright' || moduleState?.type === 'profile'
        ? moduleState.itemKey : catalogKey;
      const committed = commitDroppedCatalogModule(moduleState, result, commitKey);
      if (!committed.ok) {
        renderWallResult(committed.message ?? 'Modül bu konuma bırakılamadı.', true);
      }
    })();
  },
  onCancel: () => scene3d.clearCatalogModuleDrag(),
});

renderCurrentViewButton?.addEventListener('click', async () => {
  if (!currentStand) {
    renderWallResult('Önce stand sahnesini oluştur.', true);
    return;
  }

  const previousText = renderCurrentViewButton.textContent;
  renderCurrentViewButton.disabled = true;
  renderCurrentViewButton.textContent = 'Render alınıyor…';
  // Render ışıkları ve gölgeyi açar; ilk seferde gölgelendiriciler derlenir ve ekran birkaç
  // saniye donabilir. Yükleme ekranı önce gösterilir, iki kare beklenir ki çizim kilidinden
  // önce gerçekten ekrana gelsin.
  projectLoading.show('Render hazırlanıyor…', 'Işıklar ve gölgeler hesaplanıyor.');
  try {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const result = await scene3d.captureCurrentViewPng({ scale: 3 });
    if (!result.ok || !result.blob) {
      renderWallResult(result.message || 'Render alınamadı.', true);
      return;
    }
    const projectName = (projectNameInput.value.trim() || 'fair-stand')
      .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'fair-stand';
    const url = URL.createObjectURL(result.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = projectName + '-render.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Render hazır · ' + result.width + ' × ' + result.height + ' px PNG.', { kind: 'success' });
  } catch (error) {
    reportError('Render alınamadı', error);
    renderWallResult('Render alınamadı.', true);
  } finally {
    projectLoading.hide();
    renderCurrentViewButton.disabled = false;
    renderCurrentViewButton.textContent = previousText;
  }
});

standTypeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    selectedStandType = button.dataset.standType;
    standTypeButtons.forEach((candidate) => {
      candidate.setAttribute('aria-pressed', String(candidate === button));
    });
    updateStageCreateState();
  });
});

[standSizeXInput, standSizeYInput].forEach((input) => {
  input.addEventListener('input', updateStageCreateState);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !createStageButton.disabled) createStageButton.click();
  });
});
autoDepotSizeSelect?.addEventListener('change', syncAutoDepotControls);
syncAutoDepotControls();

function syncAutoDepotControls() {
  const enabled = Boolean(autoDepotSizeSelect?.value);
  if (autoDepotContentsInput) {
    autoDepotContentsInput.disabled = !enabled;
    if (!enabled) autoDepotContentsInput.checked = false;
  }
  if (autoDepotContentsHint) autoDepotContentsHint.hidden = !enabled;
}

function createAutomaticDepotStates(plan) {
  if (!plan?.ok) return [];
  return plan.specs.map((spec) => {
    if (spec.kind === 'door') {
      const state = createModuleStateFromCatalogKey(resolveWallItemKeyForHeight('wall_door_100_350', activeWallHeightCm()));
      if (!state) return null;
      state.placement = { ...spec.placement };
      state.autoDepot = true;
      return state;
    }
    const descriptor = {
      ...spec,
      type: spec.kind === 'wall' ? 'flat-panel' : spec.kind,
    };
    // Depo duvarı da standın yüksekliğindeki düz duvardır.
    if (descriptor.type === 'flat-panel') {
      descriptor.itemKey = spec.itemKey
        ? resolveWallItemKeyForHeight(spec.itemKey, activeWallHeightCm())
        : resolveAutomaticWallFlatPanelItemKey(spec.widthCm, activeWallHeightCm());
    }
    const state = createModuleStateFromDescriptor(descriptor);
    if (!state) return null;
    state.placement = { ...spec.placement };
    state.autoDepot = true;
    return state;
  }).filter(Boolean);
}

function readWallHeightCm() {
  const value = Number(wallHeightSelect?.value);
  return WALL_LINE_HEIGHTS_CM.includes(value) ? value : CATALOG_WALL_LINE_HEIGHT_CM;
}

/** Standın duvar yüksekliği (cm). Eski projelerde alan yoktur: 350. */
function activeWallHeightCm() {
  const value = Number(currentStand?.wallHeightCm);
  return WALL_LINE_HEIGHTS_CM.includes(value) ? value : CATALOG_WALL_LINE_HEIGHT_CM;
}

/** Otomatik duvar parçası: seçilen yükseklikteki düz duvar. */
function createAutomaticWallState(widthCm, wallHeightCm) {
  const moduleState = createModuleStateFromDescriptor({
    type: 'flat-panel',
    widthCm,
    itemKey: resolveAutomaticWallFlatPanelItemKey(widthCm, wallHeightCm),
  });
  moduleState.locked = true;
  return moduleState;
}

function readSceneSetupFromControls() {
  const standSetup = readStandSetup();
  if (!standSetup.ok) return { ok: false, message: standSetup.message };
  const setup = { ...standSetup, wallHeightCm: readWallHeightCm() };

  const depotConfig = autoDepotSizeSelect?.value ? {
    enabled: true,
    sizeKey: autoDepotSizeSelect.value,
    includeContents: Boolean(autoDepotContentsInput?.checked),
  } : { enabled: false, sizeKey: null, includeContents: false };

  const depotPlan = depotConfig.enabled ? planAutomaticDepot({
    standType: setup.standType,
    standXCm: setup.xCm,
    standYCm: setup.yCm,
    sizeKey: depotConfig.sizeKey,
    includeContents: depotConfig.includeContents,
  }) : null;

  if (depotPlan && !depotPlan.ok) {
    return { ok: false, message: depotPlan.message };
  }

  const fasciaRows = Number(autoFasciaRowsSelect?.value) || 0;
  const fasciaConfig = fasciaRows ? { enabled: true, rows: fasciaRows } : { enabled: false, rows: null };
  const fasciaPlan = fasciaConfig.enabled ? planAutomaticFascia({
    standType: setup.standType,
    standXCm: setup.xCm,
    standYCm: setup.yCm,
    rows: fasciaRows,
  }) : null;

  if (fasciaPlan && !fasciaPlan.ok) {
    return { ok: false, message: fasciaPlan.message };
  }

  const furnitureConfig = { enabled: Boolean(autoFurnitureInput?.checked) };
  const furniturePlan = furnitureConfig.enabled ? planAutomaticFurniture({
    standXCm: setup.xCm,
    standYCm: setup.yCm,
    depot: depotPlan,
  }) : null;

  if (furniturePlan && !furniturePlan.ok) {
    return { ok: false, message: furniturePlan.message };
  }

  return { ok: true, setup, depotConfig, depotPlan, fasciaConfig, fasciaPlan, furnitureConfig, furniturePlan };
}

/** Otomatik stand mobilyaları: katalog Item'ı olarak oluşur, kilitsizdir; kullanıcı taşıyıp silebilir. */
function createAutomaticFurnitureStates(plan) {
  if (!plan?.ok) return [];
  return plan.specs.map((spec) => {
    const state = createModuleStateFromCatalogKey(spec.itemKey);
    if (!state) return null;
    state.placement = { ...spec.placement };
    return state;
  }).filter(Boolean);
}

/** Otomatik alınlık modülleri: Z, wall-short / dikme öğesinin kendi varsayılanından gelir. */
function createAutomaticFasciaStates(plan) {
  if (!plan?.ok) return [];
  const states = [];
  for (const panel of plan.panels) {
    const itemKey = resolveFasciaPanelItemKey(panel.widthCm, plan.rows);
    const state = itemKey ? createModuleStateFromCatalogKey(itemKey) : null;
    if (!state) continue;
    state.placement = { ...panel.placement, zCm: resolveItemDefaultZCm(itemKey) };
    state.locked = true;
    state.autoFascia = true;
    states.push(state);
  }
  const uprightKey = resolveFasciaUprightItemKey(activeWallHeightCm());
  for (const upright of plan.uprights) {
    const state = uprightKey ? createModuleStateFromCatalogKey(uprightKey) : null;
    if (!state) continue;
    // Plan noktası panel hatlarının birleşimidir; sahne yatay modülde xCm'i sol kenar sayar
    // (gövde xCm + genişlik/2'de). Dikmenin merkezi birleşime otursun diye yarım genişlik geri alınır.
    state.placement = {
      ...upright.placement,
      xCm: Number(upright.placement.xCm) - Number(state.widthCm) / 2,
    };
    state.locked = true;
    state.autoFascia = true;
    states.push(state);
  }
  return states;
}

function appendAutomaticWallLamps(standXCm, standYCm) {
  const lampItem = getTopLightItemForType('led-floodlight');
  if (!lampItem) return;
  const walls = currentModules.filter(
    (moduleState) => moduleState.type === 'flat-panel' && moduleState.placement,
  );
  const planned = planAutomaticWallLampPlacements({
    modules: walls,
    standXCm,
    standYCm,
    lampWidthCm: Number(lampItem.dimensions?.widthCm) || 50,
  });
  for (const placement of planned) {
    const lamp = createModuleStateFromDescriptor({ type: 'led-floodlight' });
    if (!lamp) continue;
    lamp.placement = snapPlacementToItemAnchor(lamp, placement, currentModules) ?? { ...placement };
    currentModules.push(lamp);
  }
}

function appendAutomaticDepotLamps() {
  const lampItem = getTopLightItemForType('led-floodlight');
  if (!lampItem) return;
  const planned = planAutomaticDepotLampPlacements({
    modules: currentModules.filter((moduleState) => moduleState.depotSide || moduleState.autoDepot),
    lampWidthCm: Number(lampItem.dimensions?.widthCm) || 50,
  });
  for (const placement of planned) {
    const lamp = createModuleStateFromDescriptor({ type: 'led-floodlight' });
    if (!lamp) continue;
    lamp.placement = snapPlacementToItemAnchor(lamp, placement, currentModules) ?? { ...placement };
    currentModules.push(lamp);
  }
}

function rebuildSceneFromSetup({ setup, depotConfig, depotPlan, fasciaConfig, fasciaPlan, furnitureConfig, furniturePlan }) {
  dismissWallLockNotice();
  currentModules = [];
  moduleContextMenu.close();
  moduleContextMenu.closePicker();

  setActiveWallLineHeightCm(setup.wallHeightCm);
  const stage = scene3d.createStage({
    widthCm: setup.xCm,
    depthCm: setup.yCm,
    standType: setup.standType,
    resetView: true,
  });
  if (!stage.ok) {
    renderStageResult(stage.message, true);
    return false;
  }

  currentStand = assignStandFloorItem({ ...setup, depot: depotConfig, fascia: fasciaConfig, furniture: furnitureConfig }, floorTypeSelect.value);
  setActiveWallLineHeightCm(activeWallHeightCm());
  syncSaveProjectButton();
  scene3d.setFloorType(floorTypeSelect.value);
  viewportEmpty.hidden = true;
  viewportToolbar.hidden = false;
  setStandEditingEnabled(true);

  if (setup.standType === 'island') {
    currentModules = [];
  } else {
    const automaticWall = composeAutomaticStandWall({
      wallWidthCm: getAutomaticWallCapacityCm({
        standType: setup.standType,
        standXCm: setup.xCm,
        standYCm: setup.yCm,
      }),
      standType: setup.standType,
      standXCm: setup.xCm,
      standYCm: setup.yCm,
    });
    if (!automaticWall.ok) {
      renderStageResult(automaticWall.message, true);
      return false;
    }

    currentModules = automaticWall.widths.map((widthCm, index) => {
      const moduleState = createAutomaticWallState(widthCm, setup.wallHeightCm);
      moduleState.placement = { ...automaticWall.placements[index] };
      return moduleState;
    });

    if (depotPlan?.ok) {
      const customBack = composeAutomaticBackWallWithDepot({
        standXCm: setup.xCm,
        depotOriginXCm: depotPlan.originXCm,
        depotWidthCm: depotPlan.widthCm,
        sizeKey: depotPlan.sizeKey,
      });
      if (!customBack.ok) {
        renderStageResult(customBack.message, true);
        return false;
      }

      currentModules = currentModules.filter(
        (moduleState) => moduleState.placement?.wallId !== 'back',
      );
      const backStates = customBack.modules.map((entry) => {
        const moduleState = createAutomaticWallState(entry.widthCm, setup.wallHeightCm);
        moduleState.placement = { ...entry.placement };
        if (entry.depotBack) {
          moduleState.autoDepotBack = true;
          moduleState.depotBack = true;
        }
        return moduleState;
      });
      currentModules.push(...backStates);

      if (setup.standType === 'l-left' || setup.standType === 'l-right') {
        const customSide = composeAutomaticSideWallWithDepot({
          standType: setup.standType,
          standXCm: setup.xCm,
          standYCm: setup.yCm,
          depotDepthCm: depotPlan.depthCm,
        });
        if (!customSide.ok) {
          renderStageResult(customSide.message, true);
          return false;
        }
        currentModules = currentModules.filter(
          (moduleState) => moduleState.placement?.wallId !== customSide.wallId,
        );
        const sideStates = customSide.modules.map((entry) => {
          const moduleState = createAutomaticWallState(entry.widthCm, setup.wallHeightCm);
          moduleState.placement = { ...entry.placement };
          if (entry.depotSide) {
            moduleState.autoDepotBack = true;
            moduleState.depotSide = true;
          }
          return moduleState;
        });
        currentModules.push(...sideStates);
      }
    }
  }

  appendAutomaticWallLamps(setup.xCm, setup.yCm);
  if (depotPlan?.ok) {
    currentModules.push(...createAutomaticDepotStates(depotPlan));
    appendAutomaticDepotLamps();
  }
  // Lambalardan sonra: alınlık flat-panel'leri otomatik duvar lambası planına girmez.
  currentModules.push(...createAutomaticFasciaStates(fasciaPlan));
  currentModules.push(...createAutomaticFurnitureStates(furniturePlan));
  rebuildWall({ resetView: true });

  const label = STAND_TYPE_LABELS[setup.standType];
  renderStageResult(
    `${label} · ${setup.xCm} × ${setup.yCm} cm aktif alan · ${setup.sceneWidthM} × ${setup.sceneDepthM} m toplam sahne`,
  );
  renderStandSummaryChip(setup);
  syncFloorAreaControls();
  resetDesignHistory();
  return true;
}

createStageButton.addEventListener('click', async () => {
  const sceneSetup = readSceneSetupFromControls();
  if (!sceneSetup.ok) {
    renderStageResult(sceneSetup.message, true);
    return;
  }
  const { setup, depotConfig, depotPlan, fasciaConfig, fasciaPlan, furnitureConfig, furniturePlan } = sceneSetup;

  if (currentStand || currentModules.length || autosaveController.isEnabled()) {
    const currentProjectName = projectNameInput.value.trim() || 'Adsız Proje';
    const confirmed = window.confirm(
      'Yeni proje oluşturulacak.\n\n'
        + (autosaveController.isEnabled()
          ? '• Açık kayıtlı proje: "' + currentProjectName + '" korunacak.\n'
          : '• Mevcut kaydedilmemiş sahne ve düzenlemeler temizlenecek.\n')
        + '• Mevcut modüller, renkler ve görseller yeni projeye taşınmayacak.\n\n'
        + 'Devam edilsin mi?',
    );
    if (!confirmed) return;
  }

  const projectNameSuffix = buildAutomaticProjectNameSuffix(setup.standType, setup.xCm, setup.yCm);
  const projectName = await requestProjectName({ mode: 'create', suffix: projectNameSuffix });
  if (!projectName) return;

  autosaveController.disable();
  activeProjectId = createProjectId();
  activeProjectCreatedAt = Date.now();
  setProjectName(projectName);
  projectSelect.selectedIndex = -1;
  clearRegisteredAssets();
  beginLiveSession(revisionSession, { projectId: activeProjectId, designSignature: null });
  renderRevisionList();
  projectStatus.textContent = 'Yeni proje hazırlanıyor: ' + projectName + '…';

  if (!rebuildSceneFromSetup({ setup, depotConfig, depotPlan, fasciaConfig, fasciaPlan, furnitureConfig, furniturePlan })) return;

  try {
    await persistActiveProject({ quiet: true, reason: 'init' });
    autosaveController.enableFromCurrentState();
    projectStatus.textContent = 'Oluşturuldu ve kaydedildi: ' + projectName;
    // Kart sahneyi kilitlemez; cevap beklenmeden ilk ipucu da açılır.
    void offerWallLockRelease();
    onboardingTips.maybeShow();
  } catch (error) {
    reportError('Yeni proje ilk kayıt sırasında kaydedilemedi', error);
    autosaveController.disable();
    projectStatus.textContent = 'Proje oluşturuldu ancak kaydedilemedi.';
  }
});

floorTypeSelect.addEventListener('change', () => {
  if (!currentStand) return;
  currentStand = assignStandFloorItem(currentStand, floorTypeSelect.value);
  scene3d.setFloorType(floorTypeSelect.value);
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
});

function syncFloorAreaTypeSelect(selectedKey) {
  if (!floorAreaTypeSelect) return;
  const preferred = getFloorItem(selectedKey)?.itemKey ?? defaultOverrideItemKey(floorTypeSelect.value);
  floorAreaTypeSelect.replaceChildren(...listFloorItems().map((item) => {
    const option = document.createElement('option');
    option.value = item.itemKey;
    option.textContent = getFloorSelectLabel(item);
    return option;
  }));
  floorAreaTypeSelect.value = preferred;
}

function floorAreaStatusText(area) {
  if (!area) return 'Baz zemin tüm standı kaplar. İstersen içine bir dikdörtgen alan ekle.';
  const label = getFloorItem(area.itemKey)?.name ?? area.itemKey;
  return `Alan: ${label} · ${area.xCm},${area.yCm} · ${area.widthCm}×${area.depthCm} cm. Dışarıda kalan zemin baz kaplamadır.`;
}

function syncFloorAreaControls() {
  if (!floorAreaControls) return;
  const ready = Boolean(currentStand);
  floorAreaControls.hidden = !ready;
  if (!ready) return;
  const area = currentStand.floorArea ?? null;
  if (floorAreaAddButton) floorAreaAddButton.disabled = Boolean(area);
  if (floorAreaDrawButton) floorAreaDrawButton.disabled = !area;
  if (floorAreaDeleteButton) floorAreaDeleteButton.disabled = !area;
  for (const input of [floorAreaXInput, floorAreaYInput, floorAreaWidthInput, floorAreaDepthInput, floorAreaTypeSelect]) {
    if (input) input.disabled = !area;
  }
  if (!area) {
    if (floorAreaStatus) floorAreaStatus.textContent = floorAreaStatusText(null);
    return;
  }
  if (floorAreaXInput) floorAreaXInput.value = String(area.xCm);
  if (floorAreaYInput) floorAreaYInput.value = String(area.yCm);
  if (floorAreaWidthInput) floorAreaWidthInput.value = String(area.widthCm);
  if (floorAreaDepthInput) floorAreaDepthInput.value = String(area.depthCm);
  syncFloorAreaTypeSelect(area.itemKey);
  if (floorAreaStatus) floorAreaStatus.textContent = floorAreaStatusText(area);
}

function commitFloorArea(nextArea) {
  if (!currentStand) return { ok: false, message: 'Önce stand alanını oluştur.' };
  const checked = validateFloorArea(nextArea, currentStand);
  if (!checked.ok) {
    syncFloorAreaControls();
    if (floorAreaStatus) floorAreaStatus.textContent = checked.message;
    return checked;
  }
  currentStand = { ...currentStand, floorArea: checked.area };
  scene3d.setFloorArea(checked.area);
  scene3d.setFloorAreaDrawArmed(false);
  if (floorAreaDrawButton) floorAreaDrawButton.setAttribute('aria-pressed', 'false');
  syncFloorAreaControls();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
  return checked;
}

function readFloorAreaFields() {
  return {
    xCm: floorAreaXInput?.value,
    yCm: floorAreaYInput?.value,
    widthCm: floorAreaWidthInput?.value,
    depthCm: floorAreaDepthInput?.value,
    itemKey: floorAreaTypeSelect?.value,
    color: currentStand?.floorArea?.color ?? null,
  };
}

floorAreaAddButton?.addEventListener('click', () => {
  if (!currentStand || currentStand.floorArea) return;
  const rect = defaultFloorAreaRect(currentStand);
  if (!rect) {
    if (floorAreaStatus) floorAreaStatus.textContent = 'Bu stand ölçüsüne 50 cm dikdörtgen sığmıyor.';
    return;
  }
  commitFloorArea({
    ...rect,
    itemKey: defaultOverrideItemKey(currentStand.itemKey),
    color: null,
  });
});

floorAreaDrawButton?.addEventListener('click', () => {
  if (!currentStand?.floorArea) return;
  const armed = floorAreaDrawButton.getAttribute('aria-pressed') === 'true';
  const next = !armed;
  floorAreaDrawButton.setAttribute('aria-pressed', String(next));
  scene3d.setFloorAreaDrawArmed(next, (draft) => {
    floorAreaDrawButton.setAttribute('aria-pressed', 'false');
    if (!draft?.ok) {
      if (floorAreaStatus) {
        floorAreaStatus.textContent = draft?.message || 'Alan 50 cm aralığında ve stand içinde olmalı.';
      }
      return;
    }
    commitFloorArea({
      ...draft.area,
      itemKey: currentStand?.floorArea?.itemKey ?? floorAreaTypeSelect?.value,
      color: currentStand?.floorArea?.color ?? null,
    });
  });
  if (next && floorAreaStatus) {
    floorAreaStatus.textContent = 'Zeminde sürükleyerek dikdörtgeni yeniden çiz. Aralık 50 cm.';
  }
});

floorAreaDeleteButton?.addEventListener('click', () => {
  if (!currentStand?.floorArea) return;
  const { floorArea, ...rest } = currentStand;
  currentStand = rest;
  scene3d.setFloorArea(null);
  scene3d.setFloorAreaDrawArmed(false);
  floorAreaDrawButton?.setAttribute('aria-pressed', 'false');
  syncFloorAreaControls();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
});

function onFloorAreaFieldChange() {
  if (!currentStand?.floorArea) return;
  const nextItem = getFloorItem(floorAreaTypeSelect?.value);
  const previous = currentStand.floorArea;
  const color = nextItem?.itemKey === previous.itemKey ? previous.color : null;
  commitFloorArea({ ...readFloorAreaFields(), color });
}

for (const input of [floorAreaXInput, floorAreaYInput, floorAreaWidthInput, floorAreaDepthInput]) {
  input?.addEventListener('change', onFloorAreaFieldChange);
}
floorAreaTypeSelect?.addEventListener('change', onFloorAreaFieldChange);

clearWallButton.addEventListener('click', () => {
  const sceneSetup = readSceneSetupFromControls();
  if (!sceneSetup.ok) {
    renderStageResult(sceneSetup.message, true);
    return;
  }

  rebuildSceneFromSetup(sceneSetup);
});

resetModuleFeaturesButton.addEventListener('click', () => {
  if (!currentModules.length) {
    renderWallResult('Sıfırlanacak modül yok.');
    return;
  }

  // Kilitli Işıklı Strafor silinmez ve olduğu gibi kalır; kilit "özellik" değildir, korunur.
  const illuminatedFoamCount = currentModules.filter(
    (module) => module?.type === 'illuminated-foam' && !isModuleLocked(module),
  ).length;
  const confirmed = window.confirm(
    'Tüm modül özellikleri varsayılan ayarlarına dönecektir. Onaylıyor musunuz?\n\n'
      + 'Kaldırılacak özellikler:\n'
      + '• Atanan resimler\n'
      + '• Atanan cam özellikleri\n'
      + '• Atanan renkler\n'
      + '• Diğer panel özelleştirmeleri\n'
      + (illuminatedFoamCount > 0 ? `• ${illuminatedFoamCount} Işıklı Strafor sahneden silinecek\n` : '')
      + '\nDiğer modül türleri, genişlikleri, sıraları ve FAZ 2 yerleşimleri korunacaktır.',
  );
  if (!confirmed) return;

  const resetCandidates = currentModules.filter(
    (module) => module?.type !== 'illuminated-foam',
  );
  const resetModules = resetCandidates.map((module) => createCatalogModuleState(
    module,
    { preservePlacement: true },
  ));
  if (resetModules.some((module) => !module)) {
    selectionInfo.textContent = 'Bazı modül türleri varsayılan ayarlarına döndürülemedi.';
    return;
  }

  const resetBySourceId = new Map();
  resetCandidates.forEach((module, index) => {
    // Kilit ve grup özellik değildir; korunur. Grup kilidi öğe kilidine çevrilmez.
    if (module.locked === true) resetModules[index].locked = true;
    if (module.group) resetModules[index].group = { ...module.group };
    resetBySourceId.set(module.id, resetModules[index]);
  });
  currentModules = currentModules
    .map((module) => (module?.type === 'illuminated-foam'
      ? (isModuleLocked(module) ? module : null)
      : resetBySourceId.get(module.id)))
    .filter(Boolean);
  selectedFoamModuleId = null;
  if (foamLightControls) foamLightControls.hidden = true;
  moduleContextMenu.close();
  moduleContextMenu.closePicker();
  rebuildWall({ resetView: false });
  syncColorEditorFromHex('#ffffff');
  selectionInfo.textContent = illuminatedFoamCount > 0
    ? `Tüm özellikler kaldırıldı. ${illuminatedFoamCount} Işıklı Strafor sahneden silindi; diğer modüllerin dizilimi ve yerleşimi korundu.`
    : 'Tüm modüller varsayılan ayarlarına döndürüldü. Modül dizilimi ve yerleşimi korundu.';
});

function applyActiveColorToSelection({ showMissingSelection = false } = {}) {
  if (scene3d.isFloorAreaSelected()) {
    const floorType = currentStand?.floorArea?.itemKey;
    const floorItem = getFloorItem(floorType);
    if (floorItem && !floorItem.paintable) {
      selectionInfo.textContent = 'Parke zemini boyanamaz; hazır parke seçeneklerinden biri kullanılacak.';
      return false;
    }
    const applied = scene3d.setFloorAreaColor(colorInput.value);
    if (applied && currentStand?.floorArea) {
      currentStand = {
        ...currentStand,
        floorArea: { ...currentStand.floorArea, color: applied },
      };
      const label = floorItem?.name ?? 'Zemin';
      selectionInfo.textContent = label + ' zemin alanı · renk ' + applied.toUpperCase() + ' uygulandı.';
      return true;
    }
  }

  if (scene3d.isFloorSelected()) {
    const floorType = scene3d.getSelectedFloorType();
    const floorItem = getFloorItem(floorType);
    if (floorItem && !floorItem.paintable) {
      selectionInfo.textContent = 'Parke zemini boyanamaz; hazır parke seçeneklerinden biri kullanılacak.';
      return false;
    }
    const applied = scene3d.setFloorColor(colorInput.value);
    if (applied) {
      const label = floorItem?.name ?? 'Karolaj';
      if (currentStand) currentStand = { ...currentStand, floorColor: applied };
      selectionInfo.textContent = label + ' zemini · renk ' + applied.toUpperCase() + ' uygulandı.';
      return true;
    }
  }

  const selected = scene3d.getSelectedSurfaces();
  if (!selected.length) {
    if (showMissingSelection) {
      selectionInfo.textContent = 'Önce 3D sahnede boyamak istediğin panel, panel bloğu, modül veya zemini seç.';
    }
    return false;
  }

  scene3d.applyColor(selected, colorInput.value);
  return true;
}

const {
  syncFromHex: syncColorEditorFromHex,
  syncFromRgbInputs,
  syncFromCmykInputs,
} = createColorEditorController({
  colorInput,
  colorHexInput,
  colorRgbInputs,
  colorCmykInputs,
  onApply: () => applyActiveColorToSelection(),
});

applyColorButton.addEventListener('click', () => {
  applyActiveColorToSelection({ showMissingSelection: true });
});

colorInput.addEventListener('input', () => {
  syncColorEditorFromHex(colorInput.value, { apply: true });
});

colorHexInput.addEventListener('input', () => {
  const raw = colorHexInput.value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(raw)) return;
  syncColorEditorFromHex(raw, { apply: true });
});

colorHexInput.addEventListener('change', () => {
  if (!syncColorEditorFromHex(colorHexInput.value, { apply: true })) {
    syncColorEditorFromHex(colorInput.value);
  }
});

Object.values(colorRgbInputs).forEach((input) => {
  input.addEventListener('input', syncFromRgbInputs);
});

Object.values(colorCmykInputs).forEach((input) => {
  input.addEventListener('input', syncFromCmykInputs);
});

function cloneProjectState(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function clearRegisteredAssets() {
  imageAssets.forEach((asset) => { if (asset.url) URL.revokeObjectURL(asset.url); });
  imageAssets.clear();
  activeAssetId = null;
  closeAssetContextMenu();
  renderAssetLibrary();
  assetStatus.textContent = 'Görsel seçilmedi.';
}

function syncSaveProjectButton() {
  const sceneReady = Boolean(currentStand);
  if (saveProjectButton?.getAttribute('aria-busy') !== 'true') {
    setSaveProjectEnabled(saveProjectButton, sceneReady);
  }
  if (saveAsProjectButton?.getAttribute('aria-busy') !== 'true') {
    setSaveProjectEnabled(saveAsProjectButton, sceneReady);
  }
}

function buildProjectSnapshot() {
  return {
    id: activeProjectId,
    name: projectNameInput.value.trim() || 'Adsız Proje',
    version: 1,
    createdAt: activeProjectCreatedAt,
    customerId: activeCustomerId,
    stand: cloneProjectState(currentStand),
    modules: cloneProjectState(currentModules),
  };
}

function getProjectStateSignature() {
  const snapshot = buildProjectSnapshot();
  return JSON.stringify({
    name: snapshot.name,
    stand: snapshot.stand,
    modules: snapshot.modules,
  });
}

function designSignature() {
  const snapshot = buildProjectSnapshot();
  return JSON.stringify({
    stand: snapshot.stand,
    modules: snapshot.modules,
  });
}

function syncProjectNameDisplay() {
  if (!projectNameDisplay) return;
  const name = projectNameInput?.value.trim() || 'Adsız Proje';
  projectNameDisplay.textContent = formatProjectTitle(name, displayedRevisionNumber(revisionSession));
}

function renderRevisionList() {
  if (!projectRevisions || !projectRevisionList) return;
  const revisions = [...(revisionSession.revisions || [])]
    .sort((left, right) => Number(right.revisionNumber) - Number(left.revisionNumber));
  const activeNumber = displayedRevisionNumber(revisionSession);
  projectRevisionList.replaceChildren();
  syncProjectNameDisplay();
  if (!revisions.length) {
    projectRevisions.open = false;
    projectRevisions.hidden = true;
    return;
  }
  projectRevisions.hidden = false;
  revisions.forEach((revision) => {
    const button = document.createElement('button');
    button.type = 'button';
    const revisionNumber = Number(revision.revisionNumber);
    const active = activeNumber === revisionNumber;
    button.className = active ? 'primary' : 'ghost';
    button.dataset.revisionNumber = String(revisionNumber);
    const updatedAt = Number(revision.updatedAt);
    const when = Number.isFinite(updatedAt)
      ? new Date(updatedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
      : '';
    button.textContent = when ? `R${revisionNumber} · ${when}` : `R${revisionNumber}`;
    if (active) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => {
      void selectRevision(revisionNumber);
    });
    projectRevisionList.appendChild(button);
  });
}

function rememberServerRevisions(stored) {
  if (Array.isArray(stored?.revisions)) revisionSession.revisions = stored.revisions;
}

function acceptCreatedRevision(stored) {
  const numbers = (stored?.revisions || [])
    .map((revision) => Number(revision.revisionNumber))
    .filter((number) => Number.isInteger(number) && number > 0);
  if (!numbers.length) return;
  noteRevisionCreated(revisionSession, Math.max(...numbers));
}

const autosaveController = createAutosaveController({
  getSignature: getProjectStateSignature,
  persist: persistActiveProject,
  setStatus: (message) => { projectStatus.textContent = message; },
  onError: (error) => reportError('Otomatik kayıt başarısız', error),
});

// Otomatik kayıt süresi: tarayıcıda saklanan dakika seçimi; 0 = kapalı.
function applyAutosaveInterval(minutes) {
  autosaveController.setDelayMinutes(minutes);
  if (autosaveIntervalSelect) autosaveIntervalSelect.value = String(minutes);
}
applyAutosaveInterval(readAutosaveMinutes());
autosaveIntervalSelect?.addEventListener('change', () => {
  applyAutosaveInterval(writeAutosaveMinutes(autosaveIntervalSelect.value));
});

// Geri al / İleri al. Tasarım imzası (stand + modüller) karşılaştırılır; sahnenin
// kendi içinde yaptığı değişiklikler de yakalanır. Geçmiş kaydedilmez.
function floorDefaultColorHex(itemKey) {
  const value = getFloorItem(itemKey)?.defaultColor;
  if (Number.isInteger(value)) return `#${value.toString(16).padStart(6, '0')}`;
  return typeof value === 'string' ? value : null;
}

// Geri al / ileri al: kopyadaki modül içerik olarak şimdikiyle aynıysa mevcut nesne kullanılır.
// Ekrandaki yüzeyler bu nesnelere bağlıdır (renk/görsel buradan yazılır) ve sahne bu modüllere
// dokunmaz; yalnız gerçekten değişen modüller yeniden kurulur.
function reuseUnchangedModules(previousModules, nextModules) {
  const previousById = new Map(previousModules.map((module) => [module.id, module]));
  return nextModules.map((next) => {
    const previous = previousById.get(next?.id);
    return previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
  });
}

function applyDesignSnapshot(snapshot) {
  const design = JSON.parse(snapshot);
  currentModules = reuseUnchangedModules(currentModules, design.modules ?? []);
  if (currentStand && design.stand) {
    currentStand = design.stand;
    setActiveWallLineHeightCm(activeWallHeightCm());
    scene3d.setFloorType(currentStand.itemKey);
    const floorColor = currentStand.floorColor ?? floorDefaultColorHex(currentStand.itemKey);
    if (floorColor) scene3d.setFloorColor(floorColor);
    scene3d.setFloorArea(currentStand.floorArea ?? null);
    syncFloorTypeSelect(currentStand.itemKey);
    syncFloorAreaControls();
  }
  moduleContextMenu.close();
  moduleContextMenu.closePicker();
  scene3d.clearSelection();
  syncSceneToModules();
}

// Sahneyi currentModules'e eşitler; grup temizliği bir modülü değiştirirse veya sahne
// eşitleyemezse tam kurulum yapılır.
function syncSceneToModules({ rebuiltIds = null } = {}) {
  const beforeSignature = moduleLayoutSignature(currentModules);
  pruneGroups(currentModules, getGroupStand());
  const buildStartedAt = performance.now();
  if (moduleLayoutSignature(currentModules) !== beforeSignature
    || !currentStand
    || !scene3d.syncModules(currentModules, { rebuiltIds })) {
    rebuildWall({ resetView: false });
    return;
  }
  timeSceneRefresh(performance.now() - buildStartedAt);
  renderModuleGroupPanel();
  renderCurrentWallResult();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
  schedulePropertyPanelRefresh();
}

// Modülleri yerinde değiştiren işlemler (grup işlemleri, şeride araya ekleme) için: işlemden
// önce her modülün içeriği (yer ve grup bilgisi hariç) kaydedilir. Sonra yalnız içeriği değişen
// modül yeniden yaratılır, yalnız yeri değişen taşınır; grup bilgisini sahne canlı okur.
function moduleContentSignature(moduleState) {
  const { placement, group, ...content } = moduleState ?? {};
  return JSON.stringify(content);
}

function captureModuleContent() {
  return new Map(currentModules.map((moduleState) => [moduleState, moduleContentSignature(moduleState)]));
}

function syncSceneAfterModuleChange(capturedContent) {
  const rebuiltIds = new Set(currentModules
    .filter((moduleState) => capturedContent.has(moduleState)
      && capturedContent.get(moduleState) !== moduleContentSignature(moduleState))
    .map((moduleState) => moduleState.id));
  syncSceneToModules({ rebuiltIds });
}

function syncDesignHistoryButtons({ canUndo, canRedo }) {
  if (designUndoButton) designUndoButton.disabled = !canUndo;
  if (designRedoButton) designRedoButton.disabled = !canRedo;
}

const designHistory = createDesignHistory({
  readSnapshot: designSignature,
  applySnapshot: applyDesignSnapshot,
  onChange: syncDesignHistoryButtons,
});

function runDesignHistory(direction) {
  const done = direction === 'undo' ? designHistory.undo() : designHistory.redo();
  if (direction === 'undo') {
    selectionInfo.textContent = done
      ? 'Geri alındı. İleri almak için Ctrl+Y.'
      : 'Geri alınacak adım yok.';
  } else {
    selectionInfo.textContent = done
      ? 'İleri alındı.'
      : 'İleri alınacak adım yok.';
  }
  schedulePropertyPanelRefresh();
  return done;
}

// Proje açılınca, yeni proje kurulunca veya sahne temizlenince geçmiş baştan başlar.
// Geçmiş revizyon görünümünde de geri alma açıktır (silme onay sormaz, Geri al ile döner).
function resetDesignHistory({ enabled = true } = {}) {
  designHistory.setEnabled(enabled);
  designHistory.reset();
}

async function refreshProjectList(selectedId = activeProjectId) {
  const projects = await listCachedProjects();
  projectSelect.innerHTML = '';
  if (!projects.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Kayıtlı proje yok';
    projectSelect.appendChild(option);
    return projects;
  }
  projects.forEach((project) => {
    const option = document.createElement('option');
    option.value = project.id;
    option.textContent = project.name || 'Adsız Proje';
    projectSelect.appendChild(option);
  });
  if (projects.some((project) => project.id === selectedId)) projectSelect.value = selectedId;
  return projects;
}

async function loadAssetsForActiveProject() {
  clearRegisteredAssets();
  const assets = await loadImageAssets(activeProjectId);
  assets.forEach(registerAsset);
  if (assets.length) setActiveAsset(assets.at(-1).id);
  else renderAssetLibrary();
}

// CRM'de yeni proje rotası (/stand-projects/new?customerId=…) proje kaydedilince projenin adresine
// (/stand-projects/{id}) çevrilir; sayfa yenilenince sihirbaz yeniden açılmaz, kayıtlı proje açılır.
// Açılan / farklı kaydedilen / içe aktarılan projede de adres etkin projeyi gösterir. Editör yeniden
// kurulmaz (replaceState). Host adresi stand-projects altında değilse (bağımsız editör) dokunulmaz.
function syncHostProjectUrl(projectId) {
  if (!projectId || !isProjectRemoteEnabled()) return;
  const hostWindow = getFairStandHostWindow();
  const pathname = hostWindow.location?.pathname ?? '';
  const match = pathname.match(/^(.*\/stand-projects)\/[^/]+\/?$/);
  if (!match) return;
  const next = `${match[1]}/${encodeURIComponent(projectId)}`;
  if (pathname === next && !hostWindow.location.search) return;
  hostWindow.history.replaceState(hostWindow.history.state, '', next);
}

async function persistActiveProject({ quiet = false, reason = 'design' } = {}) {
  const decision = resolveRevisionWrite({
    session: revisionSession,
    reason,
    designSignature: designSignature(),
  });
  if (!decision.writePayload) {
    return { enableAutosave: false, stored: null };
  }
  const stored = await saveProject(buildProjectSnapshot(), {
    revisionMode: decision.revisionMode,
    revisionNumber: decision.revisionNumber,
  });
  activeProjectCreatedAt = stored.createdAt;
  rememberServerRevisions(stored);
  if (decision.revisionMode === 'create') acceptCreatedRevision(stored);
  revisionSession.baselineDesign = designSignature();
  renderRevisionList();
  await refreshProjectList(stored.id);
  syncHostProjectUrl(stored.id);
  if (!quiet) projectStatus.textContent = 'Kaydedildi: ' + stored.name;
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
  return { enableAutosave: revisionSession.mode === 'live', stored };
}

async function showProjectCustomerName() {
  if (!projectCustomerDisplay) return;
  try {
    const name = await loadCustomerDisplayName(activeCustomerId);
    projectCustomerDisplay.textContent = name || TEMPORARY_CUSTOMER_LABEL;
  } catch (error) {
    reportError('Müşteri adı yüklenemedi', error);
    projectCustomerDisplay.textContent = TEMPORARY_CUSTOMER_LABEL;
  }
}

async function restoreProject(project, { historicalRevisionNumber = null, sessionRevisionNumber = null } = {}) {
  if (!project) return;
  autosaveController.disable();
  dismissWallLockNotice();
  activeProjectId = project.id;
  syncHostProjectUrl(project.id);
  if (project.customerId) activeCustomerId = project.customerId;
  void showProjectCustomerName();
  activeProjectCreatedAt = Number(project.createdAt) || Date.now();
  setProjectName(project.name || 'Adsız Proje');
  currentModules = (cloneProjectState(project.modules) || []).map(normalizeModuleItemState);
  currentStand = cloneProjectState(project.stand);
  setActiveWallLineHeightCm(activeWallHeightCm());
  syncSaveProjectButton();
  moduleContextMenu.close();
  moduleContextMenu.closePicker();

  // Sahne yeniden kurulmadan önce proje görsel URL'leri hazır olmalı.
  // Yoksa kayıtlı imageAssetId ilk açılışta çözülemez.
  await timeProjectOpenStep('assets-register', () => loadAssetsForActiveProject());
  const missingImageCount = countMissingImageReferences();

  if (currentStand) {
    selectedStandType = currentStand.standType;
    standTypeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.standType === selectedStandType));
    });
    standSizeXInput.value = formatMeters(currentStand.xCm);
    standSizeYInput.value = formatMeters(currentStand.yCm);
    if (wallHeightSelect) wallHeightSelect.value = String(activeWallHeightCm());
    const resolvedFloor = resolveStandFloorItemKey(currentStand);
    currentStand = assignStandFloorItem(currentStand, resolvedFloor);
    syncFloorTypeSelect(resolvedFloor);
    if (autoDepotSizeSelect) {
      autoDepotSizeSelect.value = currentStand.depot?.enabled ? (currentStand.depot.sizeKey || '100x100') : '';
    }
    syncAutoDepotControls();
    if (autoDepotContentsInput) autoDepotContentsInput.checked = Boolean(currentStand.depot?.includeContents);
    syncAutoDepotControls();
    if (autoFasciaRowsSelect) {
      autoFasciaRowsSelect.value = currentStand.fascia?.enabled ? String(currentStand.fascia.rows || 1) : '';
    }
    // Alanı olmayan eski projelerde mobilya otomatiği çalışmamıştır.
    if (autoFurnitureInput) autoFurnitureInput.checked = Boolean(currentStand.furniture?.enabled);
    const endSceneBuild = beginProjectOpenStep('scene-build');
    const stage = scene3d.createStage({
      widthCm: currentStand.xCm,
      depthCm: currentStand.yCm,
      standType: currentStand.standType,
      resetView: true,
    });
    if (!stage.ok) throw new Error(stage.message || 'Proje sahnesi oluşturulamadı.');
    scene3d.setFloorType(currentStand.itemKey);
    if (currentStand.floorColor) scene3d.setFloorColor(currentStand.floorColor);
    if (currentStand.floorArea != null) {
      const area = validateFloorArea(currentStand.floorArea, currentStand);
      if (area.ok && area.area) {
        currentStand = { ...currentStand, floorArea: area.area };
        scene3d.setFloorArea(area.area);
      } else {
        const { floorArea, ...rest } = currentStand;
        currentStand = rest;
        scene3d.setFloorArea(null);
      }
    } else {
      scene3d.setFloorArea(null);
    }
    syncFloorAreaControls();
    viewportEmpty.hidden = true;
    viewportToolbar.hidden = false;
    setStandEditingEnabled(true);
    rebuildWall({ resetView: true });
    endSceneBuild();
    updateStageCreateState();
    const restoredSetup = validateStandSetup({
      standType: currentStand.standType,
      xCm: currentStand.xCm,
      yCm: currentStand.yCm,
    });
    if (restoredSetup.ok) {
      const label = STAND_TYPE_LABELS[restoredSetup.standType];
      renderStageResult(
        `${label} · ${restoredSetup.xCm} × ${restoredSetup.yCm} cm aktif alan · ${restoredSetup.sceneWidthM} × ${restoredSetup.sceneDepthM} m toplam sahne`,
      );
    }
    renderStandSummaryChip(restoredSetup);
  } else {
    renderStandSummaryChip(null);
    currentModules = [];
    selectedStandType = null;
    standTypeButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
    standSizeXInput.value = DEFAULT_STAND_WIDTH_M;
    standSizeYInput.value = DEFAULT_STAND_DEPTH_M;
    setStandEditingEnabled(false);
    productionBomPanel.close();
    updateStageCreateState();
  }

  if (historicalRevisionNumber != null) {
    beginHistoricalView(revisionSession, {
      projectId: project.id,
      revisionNumber: historicalRevisionNumber,
      designSignature: designSignature(),
      revisions: project.revisions || revisionSession.revisions,
    });
    renderRevisionList();
    resetDesignHistory();
    projectStatus.textContent = `Geçmiş revizyon R${historicalRevisionNumber} · salt okunur${missingImageNotice(missingImageCount)}`;
    return;
  }

  beginLiveSession(revisionSession, {
    projectId: project.id,
    designSignature: designSignature(),
    revisions: project.revisions || [],
  });
  if (sessionRevisionNumber != null) noteRevisionCreated(revisionSession, sessionRevisionNumber);
  renderRevisionList();
  autosaveController.enableFromCurrentState();
  resetDesignHistory();
  projectStatus.textContent = 'Açıldı: ' + (project.name || 'Adsız Proje') + missingImageNotice(missingImageCount);
}

// Projede bağlantısı olup dosyası yüklenemeyen görseller (ör. sunucuda dosya eksik).
function countMissingImageReferences() {
  const referenced = collectImageAssetReferenceIds([currentModules, currentStand]);
  return [...referenced].filter((assetId) => !getAssetUrl(assetId)).length;
}

function missingImageNotice(count) {
  if (count > 0) showToast(`${count} görsel bulunamadı; ilgili yüzeyler kendi rengiyle gösteriliyor.`);
  return count > 0 ? ` · ${count} görsel bulunamadı, ilgili yüzeyler kendi rengiyle gösteriliyor` : '';
}

async function selectRevision(revisionNumber) {
  const shown = displayedRevisionNumber(revisionSession);
  if (shown === Number(revisionNumber)) return;
  if (Number(revisionNumber) === maxRevisionNumber(revisionSession.revisions)) {
    await returnToLiveProject();
    return;
  }
  await openHistoricalRevision(revisionNumber);
}

async function openHistoricalRevision(revisionNumber) {
  if (!activeProjectId || revisionSession.mode === 'historical' && revisionSession.viewingRevisionNumber === revisionNumber) {
    return;
  }
  projectLoading.show(`R${revisionNumber} yükleniyor…`, 'Revizyon sahnesi hazırlanıyor.');
  projectStatus.textContent = `R${revisionNumber} açılıyor…`;
  try {
    const snapshot = await loadProjectRevision(activeProjectId, revisionNumber);
    const payload = snapshot?.payload || {};
    await restoreProject({
      id: activeProjectId,
      name: projectNameInput.value.trim() || 'Adsız Proje',
      version: 1,
      createdAt: activeProjectCreatedAt,
      customerId: activeCustomerId,
      stand: payload.stand ?? snapshot?.stand ?? null,
      modules: Array.isArray(payload.modules) ? payload.modules : (snapshot?.modules || []),
      revisions: revisionSession.revisions,
    }, { historicalRevisionNumber: revisionNumber });
    await waitForSceneToFill();
  } catch (error) {
    reportError('Revizyon açılamadı', error);
    projectStatus.textContent = 'Revizyon açılamadı.';
  } finally {
    projectLoading.hide();
  }
}

async function returnToLiveProject() {
  if (!activeProjectId) return;
  const latest = maxRevisionNumber(revisionSession.revisions);
  const label = latest ? `R${latest}` : 'Proje';
  projectLoading.show(`${label} yükleniyor…`, 'Revizyon sahnesi hazırlanıyor.');
  projectStatus.textContent = `${label} açılıyor…`;
  try {
    const project = await loadProject(activeProjectId, projectOpenLoadOptions());
    if (!project) {
      projectStatus.textContent = `${label} bulunamadı.`;
      return;
    }
    await restoreProject(project);
    await waitForSceneToFill();
  } catch (error) {
    reportError('Revizyon açılamadı', error);
    projectStatus.textContent = `${label} açılamadı.`;
  } finally {
    projectLoading.hide();
  }
}

function resetToFirstOpenState() {
  autosaveController.disable();
  moduleContextMenu.close();
  moduleContextMenu.closePicker();
  scene3d.clearCatalogModuleDrag();
  scene3d.clearWall({ resetView: true });
  scene3d.clearSelection();

  currentModules = [];
  currentStand = null;
  setActiveWallLineHeightCm(CATALOG_WALL_LINE_HEIGHT_CM);
  syncSaveProjectButton();
  selectedStandType = null;
  selectedFoamModuleId = null;
  standTypeButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  standSizeXInput.value = DEFAULT_STAND_WIDTH_M;
  standSizeYInput.value = DEFAULT_STAND_DEPTH_M;
  if (autoDepotSizeSelect) autoDepotSizeSelect.value = '';
  syncAutoDepotControls();
  if (autoFasciaRowsSelect) autoFasciaRowsSelect.value = '';
  if (autoFurnitureInput) autoFurnitureInput.checked = true;
  syncFloorTypeSelect();
  if (foamLightControls) foamLightControls.hidden = true;

  activeProjectId = createProjectId();
  activeProjectCreatedAt = Date.now();
  setProjectName('Adsız Proje');
  clearRegisteredAssets();

  viewportEmpty.hidden = false;
  newProjectWizard.show();
  viewportToolbar.hidden = true;
  setStandEditingEnabled(false);
  productionBomPanel.close();
  updateStageCreateState();
  syncColorEditorFromHex('#ffffff');
  resetDesignHistory();
  selectionInfo.textContent = DEFAULT_SELECTION_HINT;
  beginLiveSession(revisionSession, { projectId: null, designSignature: null });
  renderRevisionList();
  projectStatus.textContent = 'Aktif proje henüz kaydedilmedi.';
}

function registerAsset(asset) {
  const previous = imageAssets.get(asset.id);
  if (previous?.url) URL.revokeObjectURL(previous.url);

  imageAssets.set(asset.id, {
    ...asset,
    url: URL.createObjectURL(asset.blob),
  });
}

function closeAssetContextMenu() {
  assetContextMenu.hidden = true;
  assetContextAssetId = null;
}

function openAssetContextMenu(assetId, clientX, clientY) {
  const asset = imageAssets.get(assetId);
  if (!asset) return;

  assetContextAssetId = assetId;
  assetContextMenu.querySelector('.module-context-title').textContent = `Görsel · ${asset.name}`;
  assetContextMenu.hidden = false;

  const margin = 8;
  const rect = assetContextMenu.getBoundingClientRect();
  const left = Math.max(margin, Math.min(clientX, window.innerWidth - rect.width - margin));
  const top = Math.max(margin, Math.min(clientY, window.innerHeight - rect.height - margin));
  assetContextMenu.style.left = `${left}px`;
  assetContextMenu.style.top = `${top}px`;
}

function getImageAssetUsageCount(assetId) {
  return countImageAssetReferences(currentModules, assetId)
    + countImageAssetReferences(currentStand, assetId);
}

async function requestDeleteImageAsset(assetId) {
  const asset = imageAssets.get(assetId);
  if (!asset) return false;

  const usageCount = getImageAssetUsageCount(assetId);
  const confirmed = window.confirm(
    usageCount > 0
      ? `"${asset.name}" şu anda sahnede bir veya daha fazla yere atanmış.\n\nBu görseli silersen atandığı panel/bezlerden de kaldırılacak.\n\nYine de silinsin mi?`
      : `"${asset.name}" görseli görsel kütüphanesinden kalıcı olarak silinecek.\n\nDevam edilsin mi?`,
  );
  if (!confirmed) return false;

  closeAssetContextMenu();

  if (usageCount > 0) {
    // Canlı sahneyi önce Kaldır davranışıyla temizle; blob silme/persist beklenmez.
    scene3d.clearImageAssetById(assetId);
    clearImageAssetReferences(currentModules, assetId);
    clearImageAssetReferences(currentStand, assetId);
  }
  // Silinen görsele geri dönülemez: o an kullanılmasa da eski adımlar ona bağlı olabilir
  // ve geri alınınca boş yüzey gösterirdi. Geçmiş burada baştan başlar.
  resetDesignHistory();
  selectionInfo.textContent = 'Görsel silindiği için geri alma geçmişi sıfırlandı.';

  try {
    // Kayıtlı projede önce referansları kalıcılaştır; ardından blob'u sil.
    // Böylece proje hiçbir zaman silinmiş bir asset'e bilinçli olarak bağlı bırakılmaz.
    // Otomatik kayıt kapalıyken kaydedilmez (yalnız Kaydet); kayıtlı sürüm o yüzeyleri görselsiz açar.
    if (usageCount > 0 && !autosaveController.isAutoSaveOff()
      && (autosaveController.isEnabled() || revisionSession.mode === 'historical')) {
      autosaveController.clearPending();
      const cleared = await persistActiveProject({ quiet: true });
      if (cleared?.enableAutosave !== false) autosaveController.markSavedState();
    }

    // Sunucu SoT önce (orphan kalmasın); 404 = henüz upload edilmemiş, local silmeye devam.
    if (isProjectRemoteEnabled()) {
      await deleteProjectAsset(activeProjectId, assetId);
    }

    const deleted = await deleteImageAsset(activeProjectId, assetId);
    if (!deleted) throw new Error('Görsel kaydı bulunamadı veya bu projeye ait değil.');

    if (asset.url) URL.revokeObjectURL(asset.url);
    imageAssets.delete(assetId);

    if (activeAssetId === assetId) {
      activeAssetId = [...imageAssets.values()]
        .sort((a, b) => a.createdAt - b.createdAt)
        .at(-1)?.id ?? null;
    }
    renderAssetLibrary();

    // Otomatik kayıt kapalıyken kaydedilmez; değişiklik Kaydet'i bekler.
    if (!autosaveController.isAutoSaveOff()
      && (currentStand || autosaveController.isEnabled() || revisionSession.mode === 'historical')) {
      try {
        autosaveController.clearPending();
        const removed = await persistActiveProject({ quiet: true });
        if (removed?.enableAutosave !== false) autosaveController.enableFromCurrentState();
      } catch (persistError) {
        reportError('Görsel silindi ama otomatik kayıt başarısız', persistError);
        assetStatus.textContent = 'Görsel silindi · otomatik kayıt başarısız.';
        return true;
      }
    }

    assetStatus.textContent = usageCount > 0
      ? 'Görsel silindi · atandığı yerlerden de kaldırıldı.'
      : 'Görsel silindi.';
    return true;
  } catch (error) {
    reportError('Görsel silinemedi', error);
    assetStatus.textContent = `Görsel silinemedi: ${error?.message || 'Bilinmeyen hata.'}`;
    return false;
  }
}

function setActiveAsset(assetId, { focus = false } = {}) {
  activeAssetId = assetId;
  renderAssetLibrary();
  if (focus && assetId) {
    const activeTile = [...assetLibraryElement.querySelectorAll('.asset-tile')]
      .find((tile) => tile.dataset.assetId === assetId);
    activeTile?.focus({ preventScroll: true });
  }
  const asset = imageAssets.get(assetId);
  assetStatus.textContent = asset
    ? `Aktif görsel: ${asset.name}`
    : 'Görsel seçilmedi.';
}

function renderAssetLibrary() {
  assetLibraryElement.innerHTML = '';

  if (!imageAssets.size) {
    const empty = document.createElement('p');
    empty.className = 'asset-empty';
    empty.textContent = 'Henüz görsel yok. Bir kez yüklediğinde burada kalır.';
    assetLibraryElement.appendChild(empty);
    return;
  }

  [...imageAssets.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .forEach((asset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'asset-tile';
      button.classList.toggle('active', asset.id === activeAssetId);
      button.dataset.assetId = asset.id;
      button.title = asset.name;

      const image = document.createElement('img');
      image.src = asset.url;
      image.alt = asset.name;

      const label = document.createElement('span');
      label.textContent = asset.name;

      button.append(image, label);
      button.addEventListener('click', () => {
        closeAssetContextMenu();
        setActiveAsset(asset.id, { focus: true });
      });
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveAsset(asset.id, { focus: true });
        openAssetContextMenu(asset.id, event.clientX, event.clientY);
      });
      assetLibraryElement.appendChild(button);
    });
}

function formatCm(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  if (!Number.isFinite(rounded)) return '';
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function describeSizeResult(result) {
  const sizeLabel = result.heightCm
    ? `${formatCm(result.widthCm)} × ${formatCm(result.heightCm)} cm`
    : `${formatCm(result.widthCm)} cm genişlik, yükseklik orandan`;
  const areaLabel = `${formatCm(result.areaWidthCm)} × ${formatCm(result.areaHeightCm)} cm`;
  if (!result.heightCm || !result.areaWidthCm || !result.areaHeightCm) {
    return `Görsel seçili ${areaLabel} alana ${sizeLabel} uygulandı.`;
  }
  const widthRatio = result.areaWidthCm / result.widthCm;
  const heightRatio = result.areaHeightCm / result.heightCm;
  if (widthRatio > 1.001 || heightRatio > 1.001) {
    return `Görsel ${sizeLabel} ölçüye daraltıldı. ${areaLabel} alanda boşluklar tekrarla doldu.`;
  }
  if (widthRatio < 0.999 || heightRatio < 0.999) {
    return `Görsel ${sizeLabel}. ${areaLabel} alandan taşıyor.`;
  }
  return `Görsel seçili alana ${sizeLabel} olarak oturdu.`;
}

function requestTulleFabricDimensions(defaultWidthCm, defaultHeightCm) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', 'tulle-size-title');
    form.style.cssText = 'width:min(360px,100%);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a';
    form.innerHTML = '<strong id="tulle-size-title" style="font-size:16px">Tül ölçüsü</strong><span style="color:#64748b">Genişlik ve derinliği cm olarak gir.</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label style="display:grid;gap:5px">Genişlik (cm)<input name="width" type="number" min="1" max="5000" step="1" value="'+Math.round(defaultWidthCm)+'" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label><label style="display:grid;gap:5px">Derinlik (cm)<input name="height" type="number" min="1" max="5000" step="1" value="'+Math.round(defaultHeightCm)+'" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label></div><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-cancel>İptal</button><button type="submit" class="primary">Yerleştir</button></div>';
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish(null);
    };
    const finish = (value) => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(value);
    };
    form.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) finish(null);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const widthCm = Number(data.get('width'));
      const heightCm = Number(data.get('height'));
      if (!(widthCm >= 1 && widthCm <= 5000 && heightCm >= 1 && heightCm <= 5000)) return;
      finish({ widthCm, heightCm });
    });
    document.addEventListener('keydown', onKeyDown, true);
    form.querySelector('input[name="width"]')?.focus();
  });
}

function requestBoxBlockDimensions({
  widthCm: defaultWidthCm = 100,
  depthCm: defaultDepthCm = 50,
  heightCm: defaultHeightCm = 50,
  opacity: defaultOpacity = 1,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', 'box-block-size-title');
    form.style.cssText = 'width:min(400px,100%);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a';
    const opacityValue = Math.min(1, Math.max(0, Number(defaultOpacity) || 1));
    form.innerHTML = [
      '<strong id="box-block-size-title" style="font-size:16px">Kutu blok · ölçü ve opacity</strong>',
      '<span style="color:#64748b">W / D / H (cm) ve saydamlık. Döndürme adımı / defaultZ item kaydından gelir.</span>',
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">',
      `<label style="display:grid;gap:5px">W · Genişlik<input name="width" type="number" min="1" max="5000" step="1" value="${Math.round(Number(defaultWidthCm) || 100)}" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label>`,
      `<label style="display:grid;gap:5px">D · Derinlik<input name="depth" type="number" min="1" max="5000" step="1" value="${Math.round(Number(defaultDepthCm) || 50)}" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label>`,
      `<label style="display:grid;gap:5px">H · Yükseklik<input name="height" type="number" min="1" max="5000" step="1" value="${Math.round(Number(defaultHeightCm) || 50)}" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label>`,
      '</div>',
      `<label style="display:grid;gap:5px">Opacity (0–1)<input name="opacity" type="number" min="0" max="1" step="0.05" value="${opacityValue}" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label>`,
      '<div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-cancel>İptal</button><button type="submit" class="primary">Uygula</button></div>',
    ].join('');
    overlay.appendChild(form);
    document.body.appendChild(overlay);
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      finish(null);
    };
    const finish = (value) => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(value);
    };
    form.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) finish(null);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const widthCm = Number(data.get('width'));
      const depthCm = Number(data.get('depth'));
      const heightCm = Number(data.get('height'));
      const opacity = Number(data.get('opacity'));
      if (!(widthCm >= 1 && widthCm <= 5000
        && depthCm >= 1 && depthCm <= 5000
        && heightCm >= 1 && heightCm <= 5000
        && opacity >= 0 && opacity <= 1)) return;
      finish({ widthCm, depthCm, heightCm, opacity });
    });
    document.addEventListener('keydown', onKeyDown, true);
    form.querySelector('input[name="width"]')?.focus();
  });
}

foamLightColorInput?.addEventListener('input',()=>{
  if(!selectedFoamModuleId) return;
  const moduleState=currentModules.find((module)=>module.id===selectedFoamModuleId);
  if(!moduleState||moduleState.type!=='illuminated-foam') return;
  const color=String(foamLightColorInput.value||'#ffffff').toLowerCase();
  moduleState.haloColor=color;
  scene3d.setIlluminatedFoamHaloColor?.(moduleState.id,color);
  const moduleIndex=currentModules.indexOf(moduleState);
  selectionInfo.textContent=`Modül ${moduleIndex+1} · Işıklı Strafor · ${moduleState.widthCm} × ${moduleState.heightCm} cm · ${moduleState.depthCm||3.5} cm kalınlık · ışık ${color}.`;
});

assetContextMenu.querySelector('[data-asset-action="delete"]').addEventListener('click', () => {
  const assetId = assetContextAssetId;
  closeAssetContextMenu();
  if (assetId) void requestDeleteImageAsset(assetId);
});

document.addEventListener('pointerdown', (event) => {
  if (!assetContextMenu.contains(event.target)) closeAssetContextMenu();

  if (!assetLibraryElement.contains(event.target)) {
    const focused = document.activeElement;
    if (focused?.classList?.contains('asset-tile')) focused.blur();
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !assetContextMenu.hidden) {
    closeAssetContextMenu();
    return;
  }
  if (event.key !== 'Delete') return;

  const focused = document.activeElement;
  if (!focused?.classList?.contains('asset-tile')) return;
  const assetId = focused.dataset.assetId;
  if (!assetId || assetId !== activeAssetId) return;

  // Sahnenin mevcut Delete-modül kısayolundan önce görsel silme niyetini tüket.
  event.preventDefault();
  event.stopImmediatePropagation();
  void requestDeleteImageAsset(assetId);
}, { capture: true });

// Geri al / İleri al kısayolları. Metin kutularında tarayıcının kendi geri alması çalışır.
function onDesignHistoryKeyDown(event) {
  if (isEditableKeyboardTarget(event.target)) return;
  const shortcut = resolveViewKeyboardShortcut(event);
  if (shortcut?.type !== 'undo' && shortcut?.type !== 'redo') return;
  if (!currentStand) return;
  event.preventDefault();
  runDesignHistory(shortcut.type);
}
window.addEventListener('keydown', onDesignHistoryKeyDown);
window.addEventListener('keydown', onCopyPasteKeyDown);

function onSceneSelectionKeyDown(event) {
  if (event.defaultPrevented || event.repeat || !currentStand || isEditableKeyboardTarget(event.target)) return;
  const target = event.target;
  if (target !== document.body && !viewport.contains(target)
    && !target?.closest?.('.selection-toolbar, .module-context-menu, .selection-property-panel')) return;
  const shortcut = resolveViewKeyboardShortcut(event);
  if (shortcut?.type === 'select-all') {
    event.preventDefault();
    event.stopImmediatePropagation();
    scene3d.selectModulesById(currentModules.map((moduleState) => moduleState.id));
    // Tümü seçilince toplu işlemler Özellikler panelinde açılır.
    const context = scene3d.getSelectionContext();
    if (context) openModuleContextMenu(context);
    else moduleContextMenu.close();
  } else if (String(event.key).toLowerCase() === 'delete' && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const ids = scene3d.getSelectedModuleIds();
    if (ids.length <= 1) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    deleteSelectedModules(ids);
  }
}
window.addEventListener('keydown', onSceneSelectionKeyDown, { capture: true });

designUndoButton?.addEventListener('click', () => runDesignHistory('undo'));
designRedoButton?.addEventListener('click', () => runDesignHistory('redo'));

// Bir kullanıcı işlemi bittiğinde (bırakma, menü komutu, tuş bırakma, form değişikliği)
// tasarım değiştiyse tek adım olarak kaydedilir. Diğer handler'lar bitsin diye bir tur beklenir.
// Gözden kaçan değişiklikleri saniyede bir çalışan izleyici yakalar.
function scheduleDesignHistoryCapture() {
  window.setTimeout(() => designHistory.capture(), 0);
}
window.addEventListener('pointerup', scheduleDesignHistoryCapture);
window.addEventListener('keyup', scheduleDesignHistoryCapture);
document.addEventListener('change', scheduleDesignHistoryCapture);
const designHistoryWatch = setInterval(() => designHistory.capture(), 1000);

async function initializeAssetLibrary() {
  try {
    const assets = await loadImageAssets(activeProjectId);
    assets.forEach(registerAsset);
    if (assets.length) activeAssetId = assets.at(-1).id;
    renderAssetLibrary();
    if (activeAssetId) setActiveAsset(activeAssetId);
  } catch (error) {
    reportError('Görsel arşivi açılamadı', error);
    assetStatus.textContent = 'Tarayıcı görsel arşivini açamadı.';
  }
}

// Işıklı Strafor: panelin görsel bölümünden seçilen SVG straforun logosu olur (yalnız SVG).
function selectedIlluminatedFoamModules(selected) {
  if (!selected.length || !selected.every((surface) => surface.userData.moduleType === 'illuminated-foam')) return null;
  const ids = new Set(selected.map((surface) => surface.userData.moduleId));
  return currentModules.filter((moduleState) => ids.has(moduleState.id));
}

function setIlluminatedFoamLogo(modules, assetId) {
  if (assetId) {
    const asset = imageAssets.get(assetId);
    const isSvg = asset?.type === 'image/svg+xml' || /\.svg$/i.test(asset?.name || '');
    if (!isSvg) {
      selectionInfo.textContent = 'Işıklı Strafor logosu için SVG görsel kullan.';
      return false;
    }
  }
  modules.forEach((moduleState) => { moduleState.imageAssetId = assetId ?? null; });
  syncSceneToModules({ rebuiltIds: new Set(modules.map((moduleState) => moduleState.id)) });
  modules.forEach((moduleState) => scene3d.selectModuleSurface(moduleState.id));
  selectionInfo.textContent = assetId ? 'Işıklı Strafor logosu uygulandı.' : 'Işıklı Strafor logosu kaldırıldı.';
  return true;
}

function applyActiveImageToSelection(fit = 'cover') {
  const selected = scene3d.getSelectedSurfaces();
  if (!selected.length) {
    selectionInfo.textContent = 'Görsel uygulamak için önce bir panel veya panel bloğu seç.';
    return false;
  }
  if (!activeAssetId) {
    assetStatus.textContent = 'Önce arşivden bir görsel seç veya yeni görsel yükle.';
    return false;
  }
  const foamModules = selectedIlluminatedFoamModules(selected);
  if (foamModules) return setIlluminatedFoamLogo(foamModules, activeAssetId);

  const allCounterPanels = selected.every(
    (surface) => surface.userData.moduleType === 'counter',
  );
  if (allCounterPanels) {
    const panelsByFace = new Map();
    selected.forEach((surface) => {
      const face = surface.userData.surfaceRole ?? 'front';
      if (!panelsByFace.has(face)) panelsByFace.set(face, []);
      panelsByFace.get(face).push(surface);
    });

    let appliedPanelCount = 0;
    for (const panels of panelsByFace.values()) {
      const faceResult = scene3d.applyRectImageAsset(panels, activeAssetId, fit);
      if (!faceResult.ok) {
        selectionInfo.textContent = faceResult.message;
        return false;
      }
      appliedPanelCount += faceResult.panelCount ?? panels.length;
    }

    const fitLabel = fit === 'cover' ? 'Doldur' : 'Sığdır';
    selectionInfo.textContent = `${panelsByFace.size} banko cephesinde ${appliedPanelCount} panele tek parça görsel · ${fitLabel}.`;
    return true;
  }

  const result = scene3d.applyRectImageAsset(selected, activeAssetId, fit);
  if (!result.ok) {
    selectionInfo.textContent = result.message;
    return false;
  }

  const fitLabel = fit === 'cover' ? 'Doldur' : 'Sığdır';
  if (result.mode === 'fabric-group') {
    selectionInfo.textContent = result.fabricType === 'mesh'
      ? `Tek parça Mesh (Delikli) Brandaya görsel uygulandı · ${fitLabel}.`
      : `Tek parça Lightbox Kumaşa görsel uygulandı · ${fitLabel}.`;
  } else if (result.mode === 'rect-group') {
    selectionInfo.textContent = `${result.columnCount} × ${result.rowCount} blokta ${result.panelCount} panele görsel · ${fitLabel}.`;
  } else {
    selectionInfo.textContent = `Görsel seçili panele uygulandı · ${fitLabel}.`;
  }
  return true;
}

imageInput.addEventListener('change', async () => {
  const file = imageInput.files?.[0];
  imageInput.value = '';
  if (!file) return;
  if (!isAllowedImportImageType(file.type)) {
    assetStatus.textContent = IMAGE_UPLOAD_TYPE_MESSAGE;
    return;
  }
  if (!isImageUploadWithinSizeLimit(file.size)) {
    showToast(formatImageUploadTooLargeMessage());
    return;
  }

  try {
    const asset = await saveImageAsset(activeProjectId, file);
    markAssetDirty(activeProjectId, asset.id);
    registerAsset(asset);
    setActiveAsset(asset.id);

    const selected = scene3d.getSelectedSurfaces();
    if (selected.length) applyActiveImageToSelection('cover');

    // Otomatik kayıt kapalıyken kaydedilmez; değişiklik Kaydet'i bekler.
    if (!autosaveController.isAutoSaveOff()
      && (currentStand || autosaveController.isEnabled() || revisionSession.mode === 'historical')) {
      try {
        autosaveController.clearPending();
        const added = await persistActiveProject({ quiet: true });
        if (added?.enableAutosave !== false) autosaveController.enableFromCurrentState();
      } catch (persistError) {
        reportError('Görsel eklendi ama otomatik kayıt başarısız', persistError);
        assetStatus.textContent = 'Görsel eklendi · otomatik kayıt başarısız.';
      }
    }
  } catch (error) {
    const message = error?.message || 'Görsel arşive kaydedilemedi.';
    reportError(message, error);
    if (message === formatImageUploadTooLargeMessage()) return;
    assetStatus.textContent = message;
  }
});

renameProjectButton?.addEventListener('click', async () => {
  const currentName = projectNameInput.value.trim() || 'Adsız Proje';
  const projectNameSuffix = currentStand
    ? buildAutomaticProjectNameSuffix(currentStand.standType, currentStand.xCm, currentStand.yCm)
    : '';
  const editableName = getEditableProjectName(currentName, projectNameSuffix);
  const nextName = await requestProjectName({ defaultName: editableName, mode: 'rename', suffix: projectNameSuffix });
  if (!nextName || nextName === currentName) return;
  setProjectName(nextName);
  if (currentStand || autosaveController.isEnabled()) {
    try {
      autosaveController.clearPending();
      const renamed = await persistActiveProject({ quiet: true, reason: 'metadata' });
      if (renamed?.enableAutosave !== false) autosaveController.enableFromCurrentState();
      projectStatus.textContent = 'Proje adı değiştirildi ve kaydedildi: ' + nextName;
    } catch (error) {
      reportError('Proje adı değiştirilemedi', error);
      projectStatus.textContent = 'Proje adı değiştirildi ancak kaydedilemedi.';
    }
  } else {
    projectStatus.textContent = 'Proje adı hazır: ' + nextName;
  }
});

saveProjectButton.addEventListener('click', async () => {
  setButtonBusy(saveProjectButton, true, 'Kaydediliyor');
  projectStatus.textContent = 'Proje kaydediliyor…';
  try {
    autosaveController.clearPending();
    const saved = await persistActiveProject({ reason: 'design' });
    if (saved?.enableAutosave !== false) autosaveController.enableFromCurrentState();
    // Geçmiş revizyonda değişiklik yoksa yazılacak bir şey yoktur; durum "kaydediliyor"da kalmaz.
    if (!saved?.stored) {
      projectStatus.textContent = revisionSession.mode === 'historical'
        ? `Geçmiş revizyon R${revisionSession.viewingRevisionNumber} açık · değişiklik yok, kaydedilmedi.`
        : 'Kaydedilecek değişiklik yok.';
    }
  } catch (error) {
    reportError('Proje kaydedilemedi', error);
    projectStatus.textContent = 'Proje kaydedilemedi.';
  } finally {
    setButtonBusy(saveProjectButton, false);
    syncSaveProjectButton();
  }
});

saveAsProjectButton?.addEventListener('click', async () => {
  if (!currentStand) return;
  const currentName = projectNameInput.value.trim() || 'Adsız Proje';
  const projectNameSuffix = currentStand
    ? buildAutomaticProjectNameSuffix(currentStand.standType, currentStand.xCm, currentStand.yCm)
    : '';
  const editableName = getEditableProjectName(currentName, projectNameSuffix);
  const suggestedEditable = suggestSaveAsEditableName(editableName);
  const nextName = await requestProjectName({
    defaultName: suggestedEditable,
    mode: 'save-as',
    suffix: projectNameSuffix,
  });
  if (!nextName) return;

  setButtonBusy(saveAsProjectButton, true, 'Kopyalanıyor');
  projectStatus.textContent = 'Proje farklı kaydediliyor…';
  let createdProjectId = null;
  let storageTouched = false;
  try {
    const sourceAssets = [...imageAssets.values()].map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      createdAt: asset.createdAt,
      blob: asset.blob,
    }));
    const newProjectId = createProjectId();
    const { project, assets } = buildSaveAsClone({
      snapshot: buildProjectSnapshot(),
      assets: sourceAssets,
      newProjectId,
      newName: nextName,
    });
    createdProjectId = project.id;
    storageTouched = true;
    for (const asset of assets) {
      await saveImportedImageAsset(project.id, asset);
      markAssetDirty(project.id, asset.id);
    }
    const savedAs = await saveProject(project, { revisionMode: 'create' });
    const stored = await loadProject(project.id);
    if (!stored) throw new Error('Farklı kaydedilen proje tekrar okunamadı.');
    const createdNumber = Math.max(
      0,
      ...(savedAs?.revisions || []).map((revision) => Number(revision.revisionNumber) || 0),
    );
    await restoreProject(stored, {
      sessionRevisionNumber: createdNumber > 0 ? createdNumber : null,
    });
    projectStatus.textContent = `Farklı kaydedildi · ${assets.length} görsel: ${stored.name}`;
  } catch (error) {
    if (storageTouched && createdProjectId) {
      try {
        await deleteProjectWithAssets(createdProjectId);
        await refreshProjectList(activeProjectId);
      } catch (cleanupError) {
        console.warn('Başarısız farklı kaydet temizlenemedi:', cleanupError);
      }
    }
    reportError('Proje farklı kaydedilemedi', error);
    projectStatus.textContent = `Proje farklı kaydedilemedi: ${error?.message || 'Bilinmeyen hata.'}`;
  } finally {
    setButtonBusy(saveAsProjectButton, false);
    syncSaveProjectButton();
  }
});

function safeArchiveName(name) {
  return (name || 'fair-stand-project')
    .replace(/[^a-zA-Z0-9ğüşöçıİĞÜŞÖÇ._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'fair-stand-project';
}

exportProjectButton.addEventListener('click', async () => {
  const projectId = projectSelect.value || activeProjectId;
  if (!projectId) return;
  setButtonBusy(exportProjectButton, true, 'Hazırlanıyor');
  projectStatus.textContent = 'Proje ZIP hazırlanıyor…';
  try {
    if (projectId === activeProjectId) await persistActiveProject({ quiet: true, reason: 'export' });
    let blob;
    let assetCount = 0;
    if (isProjectRemoteEnabled()) {
      blob = await exportProjectZip(projectId);
      const project = await loadProject(projectId);
      assetCount = (await loadImageAssets(projectId)).length;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeArchiveName(project?.name)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else {
      const project = await loadProject(projectId);
      if (!project) throw new Error('Dışarı aktarılacak proje bulunamadı.');
      const assets = await loadImageAssets(projectId);
      assetCount = assets.length;
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const manifestAssets = [];
      for (const asset of assets) {
        const ext = (asset.name?.match(/\.[a-zA-Z0-9]+$/)?.[0] || '') || '';
        const path = `assets/${asset.id}${ext}`;
        zip.file(path, asset.blob);
        manifestAssets.push({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          createdAt: asset.createdAt,
          path,
        });
      }
      zip.file('project.json', JSON.stringify({
        archiveVersion: 1,
        exportedAt: Date.now(),
        project,
        assets: manifestAssets,
      }, null, 2));
      blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${safeArchiveName(project.name)}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    projectStatus.textContent = `Dışarı aktarıldı · ${assetCount} görsel`;
  } catch (error) {
    reportError('Proje dışarı aktarılamadı', error);
    projectStatus.textContent = 'Proje dışarı aktarılamadı.';
  } finally {
    setButtonBusy(exportProjectButton, false);
  }
});

importProjectButton.addEventListener('click', () => importProjectFileInput.click());

importProjectFileInput.addEventListener('change', async () => {
  const file = importProjectFileInput.files?.[0];
  importProjectFileInput.value = '';
  if (!file) return;
  if (!isAllowedImportZipFile(file)) {
    projectStatus.textContent = 'Yalnız ZIP proje paketi içe aktarılır.';
    return;
  }
  setButtonBusy(importProjectButton, true, 'Aktarılıyor');
  projectLoading.show('Proje içe aktarılıyor…', 'ZIP paketi ve görseller hazırlanıyor.');
  projectStatus.textContent = 'Proje içe aktarılıyor…';

  let importedProjectId = null;
  let importStorageTouched = false;

  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(file);
    const manifestEntry = zip.file('project.json');
    if (!manifestEntry) throw new Error('ZIP içinde project.json bulunamadı.');

    const manifest = JSON.parse(await manifestEntry.async('text'));
    const manifestCheck = validateProjectArchiveManifest(manifest);
    if (!manifestCheck.ok) throw new Error(manifestCheck.message);

    // Sunucu her projeyi bir müşteriye bağlar. Paket ve açık editör müşterisizse ham API hatası yerine yol gösterilir.
    if (isProjectRemoteEnabled() && !(manifest.project.customerId || activeCustomerId)) {
      projectStatus.textContent = IMPORT_REQUIRES_CUSTOMER_MESSAGE;
      return;
    }

    const manifestAssets = manifest.assets || [];
    importedProjectId = createProjectId();

    const idMap = new Map();
    const preparedAssets = [];
    for (const asset of manifestAssets) {
      const assetCheck = validateImportedAssetRecord(asset);
      if (!assetCheck.ok) throw new Error(assetCheck.message);
      if (idMap.has(asset.id)) throw new Error(`Tekrarlanan asset kimliği: ${asset.id}`);

      const entry = zip.file(asset.path);
      if (!entry || entry.dir) throw new Error(`Eksik asset: ${asset.path}`);
      const blob = await entry.async('blob');
      const newAssetId = globalThis.crypto?.randomUUID?.()
        ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      idMap.set(asset.id, newAssetId);
      preparedAssets.push({
        id: newAssetId,
        name: asset.name,
        type: asset.type,
        createdAt: asset.createdAt,
        blob: new Blob([blob], { type: asset.type || blob.type }),
      });
    }

    // Storage'a dokunmadan önce ZIP'in tamamı ve bütün asset'ler doğrulanmış olur.
    const importedProject = remapImageAssetReferences({
      ...manifest.project,
      id: importedProjectId,
      name: manifest.project.name || 'İçe Aktarılan Proje',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      customerId: manifest.project.customerId || activeCustomerId,
    }, idMap);

    // Asset'ler önce IndexedDB'ye yazılır; saveProject (remote) loadImageAssets ile
    // sunucuya yükler. Tersi olursa proje SoT'a boş asset listesiyle gider.
    importStorageTouched = true;
    for (const asset of preparedAssets) {
      await saveImportedImageAsset(importedProjectId, asset);
      markAssetDirty(importedProjectId, asset.id);
    }
    const importedSaved = await saveProject(importedProject, { revisionMode: 'create' });

    await refreshProjectList(importedProjectId);
    const project = await loadProject(importedProjectId);
    if (!project) throw new Error('İçe aktarılan proje tekrar okunamadı.');
    if (!project.revisions?.length && importedSaved?.revisions) project.revisions = importedSaved.revisions;
    const importedNumber = Math.max(
      0,
      ...(project.revisions || []).map((revision) => Number(revision.revisionNumber) || 0),
    );
    await restoreProject(project, {
      sessionRevisionNumber: importedNumber > 0 ? importedNumber : null,
    });
    projectStatus.textContent = `İçe aktarıldı · ${preparedAssets.length} görsel`;
    // Hata fırlatmaz; içe aktarma başarılı sayıldıktan sonra yalnız sahnenin dolmasını bekler.
    await waitForSceneToFill();
  } catch (error) {
    if (importStorageTouched && importedProjectId) {
      try {
        await deleteProjectWithAssets(importedProjectId);
        await refreshProjectList();
      } catch (cleanupError) {
        console.warn('Başarısız içe aktarma temizlenemedi:', cleanupError);
      }
    }
    reportError('Proje içe aktarılamadı', error);
    projectStatus.textContent = `Proje ZIP içe aktarılamadı: ${error?.message || 'Bilinmeyen hata.'}`;
  } finally {
    projectLoading.hide();
    setButtonBusy(importProjectButton, false);
  }
});

// Sahne kurulduktan sonra görseller ve 3D modeller tek tek gelir. Yükleme ekranı hepsi
// gelene kadar açık kalır; yarım sahne gösterilmez. Takılan bir yükleme ekranı kilitlemesin
// diye SCENE_FILL_TIMEOUT_MS sonra ekran yine kapanır.
const SCENE_FILL_TIMEOUT_MS = 30000;

// Proje açılışında aşamalar: proje verisi → görseller indiriliyor (n / N) → sahne kuruluyor →
// görseller ve 3D modeller yükleniyor (n / N). Proje verisi gelir gelmez 3D modeller başlar.
function projectOpenLoadOptions() {
  return {
    onProjectData: (project) => {
      prefetchModuleModels(project?.modules);
    },
    onAssetProgress: ({ done, total }) => {
      if (total > 0) projectLoading.setDetail(`Görseller indiriliyor… ${done} / ${total}`);
    },
  };
}

async function waitForSceneToFill() {
  const result = await waitForSceneAssets({
    timeoutMs: SCENE_FILL_TIMEOUT_MS,
    onProgress: ({ done, total }) => {
      if (total > 0) projectLoading.setDetail(`Görseller ve 3D modeller yükleniyor… ${done} / ${total}`);
    },
  });
  if (result.timedOut) {
    projectStatus.textContent = `${projectStatus.textContent} · Bazı görsel/modeller hâlâ yükleniyor.`;
  } else {
    projectLoading.setDetail('Sahne çiziliyor…');
    scene3d.requestRender?.();
    await waitForNextRender();
  }
  return result;
}

async function openStoredProject(projectId) {
  if (!projectId) {
    projectStatus.textContent = 'Açılacak kayıtlı proje yok.';
    return false;
  }

  projectLoading.show('Proje yükleniyor…', 'Proje verisi alınıyor…');
  setButtonBusy(openProjectButton, true, 'Açılıyor');
  projectStatus.textContent = 'Proje yükleniyor…';
  startProjectOpenTiming(projectId);
  let timingFinished = false;
  try {
    const project = await loadProject(projectId, projectOpenLoadOptions());
    if (!project) {
      projectStatus.textContent = 'Proje bulunamadı.';
      return false;
    }
    projectLoading.setDetail('Sahne kuruluyor…');
    await restoreProject(project);
    // Ölçümde "proje açıldı" sahne kurulunca biter; sahnenin dolması ayrı satırda yazılır.
    timingFinished = true;
    finishProjectOpenTiming({ ok: true, moduleCount: currentModules.length });
    await waitForSceneToFill();
    return true;
  } catch (error) {
    reportError('Proje açılamadı', error);
    projectStatus.textContent = 'Proje açılamadı.';
    return false;
  } finally {
    if (!timingFinished) finishProjectOpenTiming({ ok: false });
    projectLoading.hide();
    setButtonBusy(openProjectButton, false);
  }
}

function restoreProjectSelectToActiveProject() {
  const hasActiveOption = [...projectSelect.options]
    .some((option) => option.value === activeProjectId);
  if (hasActiveOption) projectSelect.value = activeProjectId;
  else projectSelect.selectedIndex = -1;
}

projectSelect.addEventListener('change', async () => {
  const projectId = projectSelect.value;
  if (!shouldConfirmProjectSwitch(activeProjectId, projectId)) return;

  const currentProjectName = projectNameInput.value.trim() || 'Adsız Proje';
  const targetProjectName = projectSelect.selectedOptions?.[0]?.textContent?.trim() || 'Adsız Proje';
  const confirmed = window.confirm(
    formatProjectSwitchMessage(currentProjectName, targetProjectName),
  );
  if (!confirmed) {
    restoreProjectSelectToActiveProject();
    projectStatus.textContent = 'Proje değişikliği iptal edildi.';
    return;
  }

  const opened = await openStoredProject(projectId);
  if (!opened) restoreProjectSelectToActiveProject();
});

openProjectButton.addEventListener('click', async () => {
  await openStoredProject(projectSelect.value);
});

deleteProjectButton.addEventListener('click', async () => {
  const projectId = projectSelect.value;
  if (!projectId) return;
  const projectName = projectSelect.selectedOptions?.[0]?.textContent?.trim() || projectNameInput.value.trim() || 'Proje';
  const confirmed = window.confirm(projectName + ' ve bu projeye ait tüm görseller silinecek. Devam edilsin mi?');
  if (!confirmed) return;
  try {
    const deletingActive = projectId === activeProjectId;
    await deleteProjectWithAssets(projectId);
    if (deletingActive) resetToFirstOpenState();
    await refreshProjectList();
    if (!deletingActive) projectStatus.textContent = 'Proje silindi.';
  } catch (error) { reportError('Proje silinemedi', error); projectStatus.textContent = 'Proje silinemedi.'; }
});

fillImageButton.addEventListener('click', () => {
  applyActiveImageToSelection('cover');
});

fitImageButton.addEventListener('click', () => {
  applyActiveImageToSelection('contain');
});

clearTextureButton.addEventListener('click', () => {
  const selected = scene3d.getSelectedSurfaces();
  if (!selected.length) {
    selectionInfo.textContent = 'Önce bir panel veya panel bloğu seç.';
    return;
  }
  const foamModules = selectedIlluminatedFoamModules(selected);
  if (foamModules) {
    setIlluminatedFoamLogo(foamModules, null);
    return;
  }
  scene3d.clearImage(selected);
  selectionInfo.textContent = 'Seçili panel veya panel bloğundaki görsel kaldırıldı.';
});

// Kaydedilmemiş değişiklik varken sayfa kapatılırsa tarayıcı uyarı gösterir.
function onBeforeUnloadWarnUnsaved(event) {
  if (!autosaveController.hasUnsavedChanges()) return;
  event.preventDefault();
  event.returnValue = '';
}

function onPageHide() {
  autosaveController.disable();
  imageAssets.forEach((asset) => {
    if (asset.url) URL.revokeObjectURL(asset.url);
  });
}

// Sekme gizlenince (başka sekme, pencere küçültme, kapatma öncesi) bekleyen değişiklik kaydedilir.
function onVisibilityChangeSave() {
  if (document.visibilityState !== 'hidden') return;
  void autosaveController.saveNowIfDirty();
}

window.addEventListener('beforeunload', onBeforeUnloadWarnUnsaved);
window.addEventListener('pagehide', onPageHide);
document.addEventListener('visibilitychange', onVisibilityChangeSave);

setStandEditingEnabled(false);
updateStageCreateState();
syncColorEditorFromHex(colorInput.value);
initializeAssetLibrary();
initHelpGuide();
renderStandStandardsList(document.querySelector('#stand-standards-list'));

function applyProjectCapabilityVisibility() {
  const hide = (el, shouldHide) => {
    if (!el) return;
    el.hidden = Boolean(shouldHide);
    if (shouldHide) el.setAttribute('aria-hidden', 'true');
    else el.removeAttribute('aria-hidden');
  };
  // New blank project needs create; existing open needs update. Allow either for Kaydet.
  hide(saveProjectButton, !(capabilities.canCreate || capabilities.canUpdate));
  hide(deleteProjectButton, !capabilities.canDelete);
  // Permission is inside this call. The settings switch runs after it and cannot reveal a denied button.
  applyArchiveButtonVisibility(document, capabilities);
}

applyProjectCapabilityVisibility();
syncSaveProjectButton();
void showProjectCustomerName();

void refreshProjectList().catch((error) => reportError('Proje listesi açılamadı', error));
void refreshGroupTemplates();
if (initialProjectId) {
  void openStoredProject(initialProjectId);
} else {
  // Yeni proje: boş sahnede kurulum sihirbazı.
  newProjectWizard.show();
}

// Otomatik kayıt kapalıyken "← Standlar" (sayfa içi geçiş; tarayıcı uyarısı çıkmaz) kaydedilmemiş
// değişiklik varsa onay sorar. Açıkken çıkış arka planda kaydeder.
function onLeaveEditorClick(event) {
  if (!event.target?.closest?.('.sidebar-back')) return;
  if (!autosaveController.isAutoSaveOff() || !autosaveController.hasUnsavedChanges()) return;
  if (window.confirm('Kaydedilmemiş değişiklikler var.\n\nKaydetmeden çıkılsın mı?')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}
document.addEventListener('click', onLeaveEditorClick, true);

const historicalEditWatch = setInterval(() => {
  if (revisionSession.mode !== 'historical' || revisionSession.hasCreatedRevision || revisionSession.historicalEditArmed) return;
  if (designSignature() === revisionSession.baselineDesign) return;
  revisionSession.historicalEditArmed = true;
  autosaveController.enableFromCurrentState();
  autosaveController.schedule();
}, 1000);

  return function stopFairStandConfigurator() {
    document.removeEventListener('click', onLeaveEditorClick, true);
    clearInterval(historicalEditWatch);
    clearInterval(designHistoryWatch);
    window.removeEventListener('keydown', onDesignHistoryKeyDown);
    window.removeEventListener('keydown', onCopyPasteKeyDown);
    window.removeEventListener('keydown', onSceneSelectionKeyDown, true);
    window.removeEventListener('pointerup', scheduleDesignHistoryCapture);
    window.removeEventListener('keyup', scheduleDesignHistoryCapture);
    document.removeEventListener('change', scheduleDesignHistoryCapture);
    window.removeEventListener('beforeunload', onBeforeUnloadWarnUnsaved);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibilityChangeSave);
    // CRM içinde başka sayfaya geçilirken bekleyen değişiklik arka planda kaydedilir
    // (otomatik kayıt kapalıyken kaydedilmez; "← Standlar" önce onay sorar).
    void autosaveController?.saveNowIfDirty?.().catch(() => {});
    autosaveController?.disable?.();
    productionBomPanel?.destroy?.();
    selectionToolbar?.destroy?.();
    window.removeEventListener('fair-stand:delete-selected-module', onDeleteSelectedModule);
    scene3d?.dispose?.();
    unbindProjectActionSaveGuard?.();
  };
}

const standaloneRoot = typeof document !== 'undefined' ? document.getElementById('app') : null;
if (standaloneRoot) {
  startFairStandConfigurator();
}
