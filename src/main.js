import { createStandScene } from './scene3d.js';
import { initHelpGuide } from './helpGuide.js';
import { planAutomaticDepot } from './autoDepot.js';
import {
  composeAutomaticStandWall,
  composeAutomaticBackWallWithDepot,
  composeAutomaticSideWallWithDepot,
  getAutomaticWallCapacityCm,
  planAutomaticWallLampPlacements,
  planAutomaticDepotLampPlacements,
} from './automaticWall.js';
import {
  createModuleStateFromCatalogKey,
  createModuleStateFromDescriptor,
  duplicateModuleState,
  hasCanonicalModuleItemKey,
  normalizeModuleItemState,
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
import { describeRectSelection } from './rectSelection.js';
import { createModuleContextMenu, allowsModuleSideInsert } from './moduleContextMenu.js';
import { createModuleDragSidebar } from './moduleDragSidebar.js';
import { createColorEditorController } from './colorEditorController.js';
import { STAND_TYPE_LABELS, validateStandSetup } from './standSetup.js';
import { validateStandAxisCapacity } from './standCapacity.js';
import {
  createModulePlacement,
  getWallAxis,
  getWallExtentCm,
  getWallUsedCm,
  inferStandEdgeWallId,
  planFreeSideInsertion,
  validatePlacementAgainstModules,
  withStandEdgeWallIds,
} from './modulePlacement.js';
import { getContinuousWallSegments, planContinuousWallInsertion } from './wallReflow.js';
import { getModuleDefaultRotationDeg, isTopPlacementModule } from './moduleBehavior.js';
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
  setModulesLocked,
} from './moduleLock.js';
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
import { formatCapacityPopup, renderStageResult as renderStageResultInto, renderWallResult } from './stageFeedback.js';
import { getFloorItem, getFloorSelectLabel, getTopLightItemForType, listFloorItems, resolveItemDefaultZCm, resolveItemKey, resolveStandFloorItemKey } from './items.js';
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

let moduleDeleteConfirmOpen = false;

export function startFairStandConfigurator(options = {}) {
  let cancelled = false;
  let stopRuntime = () => {};

  const boot = bootstrapFairStandCatalog()
    .then(() => {
      if (cancelled) return;
      stopRuntime = startFairStandConfiguratorRuntime(options);
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
const viewportToolbar = document.querySelector('#viewport-toolbar');
const viewportToolbarToggle = document.querySelector('#viewport-toolbar-toggle');
const toggleProductionBomButton = document.querySelector('#toggle-production-bom');
const renderCurrentViewButton = document.querySelector('#render-current-view');
const designUndoButton = document.querySelector('#design-undo');
const designRedoButton = document.querySelector('#design-redo');
const standTypeButtons = [...document.querySelectorAll('[data-stand-type]')];
const standSizeXInput = document.querySelector('#stand-size-x');
const standSizeYInput = document.querySelector('#stand-size-y');
const createStageButton = document.querySelector('#create-stage');
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
const autoDepotEnabledInput = document.querySelector('#auto-depot-enabled');
const autoDepotSizeSelect = document.querySelector('#auto-depot-size');
const autoDepotContentsInput = document.querySelector('#auto-depot-contents');
const stageResult = document.querySelector('#stage-result');
const openModuleCatalogButton = document.querySelector('#open-module-catalog');
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
let pendingCatalogAdds = [];
let catalogAddFlushScheduled = false;
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
  <button type="button" role="menuitem" data-asset-action="illuminated-foam">Işıklı Strafora Dönüştür</button>
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
  },
  getAssetUrl,
  (context) => openModuleContextMenu(context),
  (floorSelection) => {
    const message = floorSelection?.target === 'area'
      ? describeFloorAreaSelection(floorSelection)
      : describeFloorSelection(floorSelection);
    if (message) selectionInfo.textContent = message;
  },
);

function renderStageResult(message, isError = false) {
  renderStageResultInto(stageResult, message, isError);
}

function setStandEditingEnabled(enabled) {
  openModuleCatalogButton.disabled = !enabled;
  clearWallButton.disabled = !enabled;
  moduleDragSidebar?.setEnabled(Boolean(enabled && currentStand));
  if (!enabled) {
    scene3d.setFloorAreaDrawArmed(false);
    if (floorAreaControls) floorAreaControls.hidden = true;
  }
}

function readStandSetup() {
  return validateStandSetup({
    standType: selectedStandType,
    xCm: standSizeXInput.value,
    yCm: standSizeYInput.value,
  });
}

function syncWallLengthFromSetup(setup) {
  if (!setup?.ok) return;

  const capacityCm = getAutomaticWallCapacityCm({
    standType: setup.standType,
    standXCm: setup.xCm,
    standYCm: setup.yCm,
  });
  if (!Number.isFinite(capacityCm)) return;

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

function defaultCurrentCapacityCm(axis) {
  if (axis === 'x') return getWallUsedCm(currentModules, 'back');
  return Math.max(
    getWallUsedCm(currentModules, 'left'),
    getWallUsedCm(currentModules, 'right'),
  );
}

function validateCurrentAxisCapacity(
  axis,
  addedCm,
  currentCm = defaultCurrentCapacityCm(axis),
  { popupTitle = null } = {},
) {
  const result = validateStandAxisCapacity({
    axis,
    currentCm,
    addedCm,
    xCm: currentStand?.xCm,
    yCm: currentStand?.yCm,
  });

  if (!result.ok) {
    renderWallResult(result.message, true);
    if (popupTitle && Number.isFinite(result.projectedCm)) {
      window.alert(formatCapacityPopup(result, popupTitle));
    }
  }
  return result;
}

function rebuildWall({ resetView = true } = {}) {
  if (!currentStand) {
    renderWallResult('Önce stand alanını oluştur.', true);
    return;
  }

  scene3d.buildWall(currentModules, { resetView });
  renderCurrentWallResult();
  if (productionBomPanel.isOpen()) productionBomPanel.refresh();
}

function findContextModuleIndex(context) {
  if (!context) return -1;
  const byId = currentModules.findIndex((module) => module.id === context.moduleId);
  if (byId >= 0) return byId;
  return Number.isInteger(context.moduleIndex) ? context.moduleIndex : -1;
}

function deleteContextModule(context) {
  if (moduleDeleteConfirmOpen) return;
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) return;

  const module = currentModules[index];
  if (isModuleLocked(module)) {
    renderWallResult(MODULE_LOCKED_MESSAGE, true);
    scene3d.showPlacementFeedback(MODULE_LOCKED_MESSAGE, { durationMs: 2200 });
    return;
  }
  moduleDeleteConfirmOpen = true;
  let confirmed = false;
  try {
    confirmed = window.confirm(
      `Modül ${index + 1} · ${module.widthCm} cm silinecek. Bu modüldeki renk ve görsel düzenlemeleri de kaybolacak. Devam edilsin mi?`,
    );
  } finally {
    queueMicrotask(() => {
      moduleDeleteConfirmOpen = false;
    });
  }
  if (!confirmed) return;

  currentModules.splice(index, 1);
  rebuildWall({ resetView: false });
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

function duplicateContextModule(context, side) {
  const index = findContextModuleIndex(context);
  if (index < 0 || index >= currentModules.length) return;

  const sourceModule = currentModules[index];
  const duplicate = duplicateModuleState(sourceModule);
  if (!duplicate) return;

  if (isTopPlacementModule(sourceModule) && sourceModule.placement) {
    const sourcePlacement = sourceModule.placement;
    const placement = { ...sourcePlacement };
    if (!Number.isFinite(Number(placement.zCm))) {
      placement.zCm = resolveItemDefaultZCm(sourceModule);
    }
    const deltaCm = side === 'left' ? -20 : 20;
    const widthCm = Number(duplicate.widthCm) || 50;

    if (sourcePlacement.wallId === 'back') {
      placement.xCm = Math.min(
        Math.max(0, Number(currentStand?.xCm) - widthCm),
        Math.max(0, Number(sourcePlacement.xCm) + deltaCm),
      );
      placement.yCm = 0;
    } else if (sourcePlacement.wallId === 'left' || sourcePlacement.wallId === 'right') {
      placement.yCm = Math.min(
        Math.max(0, Number(currentStand?.yCm) - widthCm),
        Math.max(0, Number(sourcePlacement.yCm) + deltaCm),
      );
      placement.xCm = sourcePlacement.wallId === 'right' ? Number(currentStand?.xCm) : 0;
    }

    duplicate.placement = placement;
    currentModules.push(duplicate);
    rebuildWall({ resetView: false });
    return;
  }

  if (resolveContextEdgeWallId(sourceModule) !== 'free') {
    const plan = planContextContinuousInsertion([duplicate], context, side);
    if (!plan.ok) {
      renderWallResult(plan.message, true);
      window.alert(`Modül çoğaltılamadı\n\n${plan.message}`);
      return;
    }

    applyContinuousInsertionPlan(plan, [duplicate]);
    rebuildWall({ resetView: false });
    return;
  }

  const plan = planContextFreeInsertion([duplicate], context, side);
  if (!plan.ok) {
    renderWallResult(plan.message, true);
    window.alert(`Modül çoğaltılamadı\n\n${plan.message}`);
    return;
  }

  applyFreeInsertionPlan(plan, [duplicate], context, side);
  rebuildWall({ resetView: false });
}

function assignStandFloorItem(stand, itemKey) {
  return { ...stand, itemKey: resolveStandFloorItemKey(itemKey) };
}

function createCatalogModuleState(module, { preservePlacement = false, itemKey = null } = {}) {
  if (!module) return null;
  const canonicalKey = itemKey || module.itemKey || resolveItemKey(module);
  const state = createModuleStateFromCatalogKey(canonicalKey)
    ?? createModuleStateFromDescriptor(module, { itemKey: canonicalKey });
  if (!state) return null;
  if (preservePlacement && module.placement) {
    state.placement = { ...module.placement };
  }
  return state;
}

function commitDroppedCatalogModule(moduleState, dropResult, catalogKey = null) {
  if (!dropResult?.ok || !dropResult.placement) {
    return { ok: false, message: dropResult?.message ?? 'Modül bu konuma bırakılamadı.' };
  }

  const canonical = createCatalogModuleState(moduleState, {
    itemKey: catalogKey || moduleState?.itemKey,
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
      applyContinuousInsertionPlan(dropResult.plan, [canonical]);
    } else {
      canonical.placement = { ...dropResult.placement };
      currentModules.push(canonical);
    }
    rebuildWall({ resetView: false });
  } catch (error) {
    currentModules = previousModules;
    try {
      rebuildWall({ resetView: false });
    } catch (rollbackError) {
      console.warn('Drop geri alma rebuild başarısız:', rollbackError);
    }
    return {
      ok: false,
      message: error?.message || 'Modül sahneye eklenirken durduruldu; önceki sahne korundu.',
    };
  }

  return { ok: true, moduleState: canonical };
}

function getRequestWallId({ context = null } = {}) {
  return context?.placement?.wallId ?? 'back';
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

function validateCatalogAddBatch({
  entries = [],
  context = null,
  placement = 'append',
} = {}) {
  if (placement === 'append' || !context) {
    const moduleStates = entries.map((entry) => createCatalogModuleState(entry.module));
    if (moduleStates.some((moduleState) => !moduleState)) {
      return { ok: false, message: 'Seçilen modüller hazırlanamadı.' };
    }

    const plan = planCatalogAppendInsertion(moduleStates);
    if (!plan.ok) {
      renderWallResult(plan.message, true);
      window.alert(`Modüller eklenemedi\n\n${plan.message}`);
    }
    return plan;
  }

  let moduleStates = entries.map((entry) => createCatalogModuleState(entry.module));
  if (moduleStates.some((moduleState) => !moduleState)) {
    return { ok: false, message: 'Seçilen modüller hazırlanamadı.' };
  }

  if ((placement === 'left' || placement === 'right') && isFreeContextInsertion(context)) {
    // Picker sağ eklemede gönderim sırasını ters çevirir; burada tekrar görsel
    // seçim sırasına döndürüp serbest komşu planına veriyoruz.
    const visualOrderedStates = placement === 'right'
      ? [...moduleStates].reverse()
      : moduleStates;
    const plan = planContextFreeInsertion(visualOrderedStates, context, placement);
    if (!plan.ok) {
      renderWallResult(plan.message, true);
      window.alert(`Modüller eklenemedi\n\n${plan.message}`);
    }
    return plan;
  }

  if (placement === 'left' || placement === 'right') {
    moduleStates = [...moduleStates].reverse();
  }

  const plan = planContextContinuousInsertion(moduleStates, context, placement);
  if (!plan.ok) {
    renderWallResult(plan.message, true);
    window.alert(`Modüller eklenemedi\n\n${plan.message}`);
  }
  return plan;
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

function flushCatalogModuleAdds() {
  catalogAddFlushScheduled = false;
  const requests = pendingCatalogAdds;
  pendingCatalogAdds = [];

  if (!currentStand || !requests.length) return;

  const firstRequest = requests[0];
  let moduleStates = requests.map((request) => createCatalogModuleState(request.module));
  if (moduleStates.some((moduleState) => !moduleState)) return;

  const placementMode = firstRequest.placement ?? 'append';
  const context = firstRequest.context ?? null;

  if (placementMode === 'append' && !context) {
    const plan = planCatalogAppendInsertion(moduleStates);
    if (!plan.ok) {
      renderWallResult(plan.message, true);
      window.alert(`Modüller eklenemedi\n\n${plan.message}`);
      return;
    }

    if (plan.appendMode === 'continuous') {
      applyContinuousInsertionPlan(plan, moduleStates);
    } else {
      currentModules.push(...moduleStates);
    }
    rebuildWall({ resetView: false });
    return;
  }

  if ((placementMode === 'left' || placementMode === 'right') && context) {
    if (!allowsModuleSideInsert(context)) {
      renderWallResult('Bu modülün yanına ekleme yapılamaz.', true);
      return;
    }
    if (isFreeContextInsertion(context)) {
      const visualOrderedStates = placementMode === 'right'
        ? [...moduleStates].reverse()
        : moduleStates;
      const plan = planContextFreeInsertion(visualOrderedStates, context, placementMode);
      if (!plan.ok) {
        renderWallResult(plan.message, true);
        window.alert(`Modüller eklenemedi\n\n${plan.message}`);
        return;
      }

      applyFreeInsertionPlan(plan, visualOrderedStates, context, placementMode);
      rebuildWall({ resetView: false });
      return;
    }

    moduleStates = [...moduleStates].reverse();
    const plan = planContextContinuousInsertion(moduleStates, context, placementMode);
    if (!plan.ok) {
      renderWallResult(plan.message, true);
      window.alert(`Modüller eklenemedi\n\n${plan.message}`);
      return;
    }

    applyContinuousInsertionPlan(plan, moduleStates);
    rebuildWall({ resetView: false });
    return;
  }

  const placementPlan = assignPlannedPlacements(moduleStates, {
    placementMode,
    context,
  });
  if (!placementPlan.ok) {
    renderWallResult(placementPlan.message, true);
    window.alert(`Modüller eklenemedi\n\n${placementPlan.message}`);
    return;
  }

  currentModules.push(...moduleStates);
  rebuildWall({ resetView: false });
}

function addCatalogModule(request) {
  if (!currentStand || !request?.module) return;

  pendingCatalogAdds.push(request);
  if (catalogAddFlushScheduled) return;

  catalogAddFlushScheduled = true;
  queueMicrotask(flushCatalogModuleAdds);
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

async function resizeContextIlluminatedFoam(context) {
  const index = findContextModuleIndex(context);
  if (index < 0) return;
  const moduleState = currentModules[index];
  if (isModuleLocked(moduleState)) {
    renderWallResult(MODULE_LOCKED_MESSAGE, true);
    scene3d.showPlacementFeedback(MODULE_LOCKED_MESSAGE, { durationMs: 2200 });
    return;
  }
  if (moduleState?.type === 'tulle-fabric') {
    const dimensions = await requestTulleFabricDimensions(moduleState.widthCm, moduleState.heightCm);
    if (!dimensions) return;
    moduleState.widthCm = dimensions.widthCm;
    moduleState.heightCm = dimensions.heightCm;
    rebuildWall({ resetView: false });
    selectionInfo.textContent = `Modül ${index + 1} · Tül · ${moduleState.widthCm} × ${moduleState.heightCm} cm · Z ${moduleState.placement?.zCm ?? 0} cm.`;
    return;
  }
  if (moduleState?.type === 'illuminated-foam') {
    const dimensions = await requestIlluminatedFoamDimensions(moduleState.widthCm, moduleState.heightCm);
    if (!dimensions) return;
    moduleState.widthCm = dimensions.widthCm;
    moduleState.heightCm = dimensions.heightCm;
    rebuildWall({ resetView: false });
    selectionInfo.textContent = `Modül ${index + 1} · Işıklı Strafor · ${moduleState.widthCm} × ${moduleState.heightCm} cm · ${moduleState.depthCm || 3.5} cm kalınlık · ışık ${moduleState.haloColor || '#ffffff'}.`;
    return;
  }
  if (moduleState?.type === 'box-block') {
    const dimensions = await requestBoxBlockDimensions({
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      heightCm: moduleState.heightCm,
      opacity: moduleState.opacity,
    });
    if (!dimensions) return;
    moduleState.widthCm = dimensions.widthCm;
    moduleState.depthCm = dimensions.depthCm;
    moduleState.heightCm = dimensions.heightCm;
    moduleState.opacity = dimensions.opacity;
    rebuildWall({ resetView: false });
    selectionInfo.textContent = `Modül ${index + 1} · Kutu blok · ${moduleState.widthCm} × ${moduleState.depthCm} × ${moduleState.heightCm} cm · opacity ${moduleState.opacity}`;
  }
}
const moduleContextMenu = createModuleContextMenu({
  onDelete: deleteContextModule,
  onDuplicate: duplicateContextModule,
  onResize: resizeContextIlluminatedFoam,
  onImageResize: resizeContextImage,
  onAdd: addCatalogModule,
  onValidateAddBatch: validateCatalogAddBatch,
  onGlassModeChange: changeContextPanelGlassMode,
  onMetalSeparatorModeChange: changeContextMetalSeparatorMode,
  onFabricModeChange: changeContextFabricMode,
  onMeshModeChange: changeContextMeshMode,
  onFabricLightingChange: changeContextFabricLighting,
  getShelfLightingState: getContextShelfLightingState,
  onShelfLightingChange: changeContextShelfLighting,
  onLockChange: changeModuleLock,
});

// Seçim bilgisine kilit durumu: tek kilitli öğede " · Kilitli", toplu seçimde sayılar.
function describeModuleLockSelection(message, selectedModuleIds = []) {
  if (!selectedModuleIds.length) return message;
  const byId = new Map(currentModules.map((module) => [module.id, module]));
  const lockedCount = selectedModuleIds.filter((id) => isModuleLocked(byId.get(id))).length;
  if (selectedModuleIds.length > 1) {
    return `${selectedModuleIds.length} öğe seçili${lockedCount ? ` · ${lockedCount} kilitli` : ''}. `
      + 'Shift+tık ile ekle/çıkar; sağ tık ile hepsini kilitle veya kilidini aç.';
  }
  return lockedCount ? `${message} · Kilitli` : message;
}

// Kilit yalnız proje örneğinin durumudur: sahne yeniden kurulmaz, otomatik kayıt
// modül imzasındaki değişikliği görüp kaydeder.
function changeModuleLock(moduleIds, locked) {
  const changed = setModulesLocked(currentModules, moduleIds, locked);
  const count = moduleIds.length;
  const subject = count > 1 ? `${count} öğe` : 'Öğe';
  selectionInfo.textContent = locked
    ? `${subject} kilitlendi. Taşınamaz, döndürülemez ve silinemez; renk ve görsel değiştirilebilir.`
    : `${subject} kilidi açıldı.`;
  return changed;
}

// Sağ tık bağlamına kilit bilgisi eklenir; toplu seçimdeki bir öğeye sağ tıklanırsa
// menü bütün seçime uygulanır.
function openModuleContextMenu(context) {
  if (!context) {
    moduleContextMenu.open(null);
    return;
  }
  const byId = new Map(currentModules.map((module) => [module.id, module]));
  const selectedIds = scene3d.getSelectedModuleIds();
  if (selectedIds.length > 1 && selectedIds.includes(context.moduleId)) {
    moduleContextMenu.open({
      ...context,
      multiModuleIds: selectedIds,
      multiLockedCount: selectedIds.filter((id) => isModuleLocked(byId.get(id))).length,
    });
    return;
  }
  moduleContextMenu.open({ ...context, locked: isModuleLocked(byId.get(context.moduleId)) });
}

moduleDragSidebar = createModuleDragSidebar({
  anchorButton: openModuleCatalogButton,
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
  onDrop: (moduleState, clientX, clientY, rotationZDeg, rotationLocked, catalogKey) => {
    void (async () => {
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
      const committed = commitDroppedCatalogModule(moduleState, result, catalogKey);
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
  try {
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
    renderWallResult('Render hazır · ' + result.width + ' × ' + result.height + ' px PNG.');
  } catch (error) {
    console.warn('Render alınamadı:', error);
    renderWallResult('Render alınamadı.', true);
  } finally {
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
autoDepotEnabledInput?.addEventListener('change', syncAutoDepotControls);
syncAutoDepotControls();

function syncAutoDepotControls() {
  const enabled = Boolean(autoDepotEnabledInput?.checked);
  if (autoDepotSizeSelect) autoDepotSizeSelect.disabled = !enabled;
  if (autoDepotContentsInput) {
    autoDepotContentsInput.disabled = !enabled;
    if (!enabled) autoDepotContentsInput.checked = false;
  }
}

function createAutomaticDepotStates(plan) {
  if (!plan?.ok) return [];
  return plan.specs.map((spec) => {
    if (spec.kind === 'door') {
      const state = createModuleStateFromCatalogKey('wall_door_100_350');
      if (!state) return null;
      state.placement = { ...spec.placement };
      state.autoDepot = true;
      return state;
    }
    const descriptor = {
      ...spec,
      type: spec.kind === 'wall' ? 'flat-panel' : spec.kind,
    };
    const state = createModuleStateFromDescriptor(descriptor);
    if (!state) return null;
    state.placement = { ...spec.placement };
    state.autoDepot = true;
    return state;
  }).filter(Boolean);
}

function readSceneSetupFromControls() {
  const setup = readStandSetup();
  if (!setup.ok) return { ok: false, message: setup.message };

  const depotConfig = autoDepotEnabledInput?.checked ? {
    enabled: true,
    sizeKey: autoDepotSizeSelect?.value || '100x100',
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

  return { ok: true, setup, depotConfig, depotPlan };
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

function rebuildSceneFromSetup({ setup, depotConfig, depotPlan }) {
  currentModules = [];
  moduleContextMenu.close();
  moduleContextMenu.closePicker();

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

  currentStand = assignStandFloorItem({ ...setup, depot: depotConfig }, floorTypeSelect.value);
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
      const moduleState = createModuleStateFromDescriptor({ type: 'flat-panel', widthCm });
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
        const moduleState = createModuleStateFromDescriptor({
          type: 'flat-panel',
          widthCm: entry.widthCm,
        });
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
          const moduleState = createModuleStateFromDescriptor({
            type: 'flat-panel',
            widthCm: entry.widthCm,
          });
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
  rebuildWall({ resetView: true });

  const label = STAND_TYPE_LABELS[setup.standType];
  renderStageResult(
    `${label} · ${setup.xCm} × ${setup.yCm} cm aktif alan · ${setup.sceneWidthM} × ${setup.sceneDepthM} m toplam sahne`,
  );
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
  const { setup, depotConfig, depotPlan } = sceneSetup;

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

  if (!rebuildSceneFromSetup({ setup, depotConfig, depotPlan })) return;

  try {
    await persistActiveProject({ quiet: true, reason: 'init' });
    autosaveController.enableFromCurrentState();
    projectStatus.textContent = 'Oluşturuldu ve kaydedildi: ' + projectName;
  } catch (error) {
    console.warn('Yeni proje ilk kayıt sırasında kaydedilemedi:', error);
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

openModuleCatalogButton.addEventListener('click', () => {
  if (!currentStand) return;
  moduleContextMenu.openPicker({ placement: 'append' });
});

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
    if (isModuleLocked(module)) resetModules[index].locked = true;
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
  onError: (error) => console.warn('Otomatik kayıt başarısız:', error),
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

function applyDesignSnapshot(snapshot) {
  const design = JSON.parse(snapshot);
  currentModules = design.modules ?? [];
  if (currentStand && design.stand) {
    currentStand = design.stand;
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
  rebuildWall({ resetView: false });
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
  return done;
}

// Proje açılınca, yeni proje kurulunca veya sahne temizlenince geçmiş baştan başlar.
// Geçmiş revizyon görünümünde geri alma kapalıdır.
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
    console.warn('Müşteri adı yüklenemedi:', error);
    projectCustomerDisplay.textContent = TEMPORARY_CUSTOMER_LABEL;
  }
}

async function restoreProject(project, { historicalRevisionNumber = null, sessionRevisionNumber = null } = {}) {
  if (!project) return;
  autosaveController.disable();
  activeProjectId = project.id;
  if (project.customerId) activeCustomerId = project.customerId;
  void showProjectCustomerName();
  activeProjectCreatedAt = Number(project.createdAt) || Date.now();
  setProjectName(project.name || 'Adsız Proje');
  currentModules = (cloneProjectState(project.modules) || []).map(normalizeModuleItemState);
  currentStand = cloneProjectState(project.stand);
  syncSaveProjectButton();
  moduleContextMenu.close();
  moduleContextMenu.closePicker();

  // Sahne yeniden kurulmadan önce proje görsel URL'leri hazır olmalı.
  // Yoksa kayıtlı imageAssetId ilk açılışta çözülemez.
  await loadAssetsForActiveProject();
  const missingImageCount = countMissingImageReferences();

  if (currentStand) {
    selectedStandType = currentStand.standType;
    standTypeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.standType === selectedStandType));
    });
    standSizeXInput.value = String(currentStand.xCm);
    standSizeYInput.value = String(currentStand.yCm);
    const resolvedFloor = resolveStandFloorItemKey(currentStand);
    currentStand = assignStandFloorItem(currentStand, resolvedFloor);
    syncFloorTypeSelect(resolvedFloor);
    if (autoDepotEnabledInput) autoDepotEnabledInput.checked = Boolean(currentStand.depot?.enabled);
    if (autoDepotSizeSelect && currentStand.depot?.sizeKey) autoDepotSizeSelect.value = currentStand.depot.sizeKey;
    if (autoDepotContentsInput) autoDepotContentsInput.checked = Boolean(currentStand.depot?.includeContents);
    syncAutoDepotControls();
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
  } else {
    currentModules = [];
    selectedStandType = null;
    standTypeButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
    standSizeXInput.value = '';
    standSizeYInput.value = '';
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
    resetDesignHistory({ enabled: false });
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
  } catch (error) {
    console.warn('Revizyon açılamadı:', error);
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
    const project = await loadProject(activeProjectId);
    if (!project) {
      projectStatus.textContent = `${label} bulunamadı.`;
      return;
    }
    await restoreProject(project);
  } catch (error) {
    console.warn('Revizyon açılamadı:', error);
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
  syncSaveProjectButton();
  selectedStandType = null;
  selectedFoamModuleId = null;
  pendingCatalogAdds = [];
  standTypeButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
  standSizeXInput.value = '';
  standSizeYInput.value = '';
  if (autoDepotEnabledInput) autoDepotEnabledInput.checked = false;
  syncAutoDepotControls();
  syncFloorTypeSelect();
  if (foamLightControls) foamLightControls.hidden = true;

  activeProjectId = createProjectId();
  activeProjectCreatedAt = Date.now();
  setProjectName('Adsız Proje');
  clearRegisteredAssets();

  viewportEmpty.hidden = false;
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
  const foamAction = assetContextMenu.querySelector('[data-asset-action="illuminated-foam"]');
  const isSvg = asset.type === 'image/svg+xml' || /\.svg$/i.test(asset.name || '');
  if (foamAction) foamAction.hidden = !isSvg;
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
    if (usageCount > 0 && (autosaveController.isEnabled() || revisionSession.mode === 'historical')) {
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

    if (currentStand || autosaveController.isEnabled() || revisionSession.mode === 'historical') {
      try {
        autosaveController.clearPending();
        const removed = await persistActiveProject({ quiet: true });
        if (removed?.enableAutosave !== false) autosaveController.enableFromCurrentState();
      } catch (persistError) {
        console.warn('Görsel silindi ama otomatik kayıt başarısız:', persistError);
        assetStatus.textContent = 'Görsel silindi · otomatik kayıt başarısız.';
        return true;
      }
    }

    assetStatus.textContent = usageCount > 0
      ? 'Görsel silindi · atandığı yerlerden de kaldırıldı.'
      : 'Görsel silindi.';
    return true;
  } catch (error) {
    console.warn('Görsel silinemedi:', error);
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

let illuminatedFoamAssetDragCleanup = null;

function getSvgAspectRatioFromText(svgText) {
  const documentNode = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (documentNode.querySelector('parsererror')) return 4;
  const svg = documentNode.documentElement;
  const viewBox = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (viewBox.length === 4 && viewBox.every(Number.isFinite) && viewBox[2] > 0 && viewBox[3] > 0) {
    return viewBox[2] / viewBox[3];
  }
  const width = Number.parseFloat(svg.getAttribute('width'));
  const height = Number.parseFloat(svg.getAttribute('height'));
  return width > 0 && height > 0 ? width / height : 4;
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

function requestImageAreaDimensions(area) {
  const areaWidth = formatCm(area.areaWidthCm);
  const areaHeight = formatCm(area.areaHeightCm);
  const widthValue = formatCm(area.currentWidthCm);
  const heightValue = formatCm(area.currentHeightCm);
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', 'image-area-size-title');
    form.style.cssText = 'width:min(400px,100%);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a';
    form.innerHTML = [
      '<strong id="image-area-size-title" style="font-size:16px">Görsel ölçüsü</strong>',
      `<span style="color:#64748b">Seçili alan ${areaWidth} × ${areaHeight} cm. Görsel önce bu ölçüde oturur. Küçültürsen boşluklar tekrarlanır, büyütürsen taşar.</span>`,
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">',
      `<label style="display:grid;gap:5px">Genişlik (cm)<input name="width" type="number" min="1" max="5000" step="0.1" value="${widthValue}" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label>`,
      `<label style="display:grid;gap:5px">Yükseklik (cm)<input name="height" type="number" min="1" max="5000" step="0.1" value="${heightValue}" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label>`,
      '</div>',
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
      const heightCm = Number(data.get('height'));
      if (!(widthCm >= 1 && widthCm <= 5000 && heightCm >= 1 && heightCm <= 5000)) return;
      finish({ widthCm, heightCm });
    });
    document.addEventListener('keydown', onKeyDown, true);
    form.querySelector('input[name="width"]')?.focus();
    form.querySelector('input[name="width"]')?.select();
  });
}

async function resizeContextImage(context) {
  const block = scene3d.resolveImageBlock(context?.surfaceId);
  const area = scene3d.describeImageSizeTarget(block);
  if (!area.ok) {
    selectionInfo.textContent = area.message;
    return;
  }
  const dimensions = await requestImageAreaDimensions(area);
  if (!dimensions) return;
  const result = scene3d.applySizeImageAsset(block, area.assetId, dimensions);
  if (!result.ok) {
    selectionInfo.textContent = result.message;
    return;
  }
  selectionInfo.textContent = describeSizeResult(result);
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

function requestIlluminatedFoamDimensions(defaultWidthCm, defaultHeightCm) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', 'foam-size-title');
    form.style.cssText = 'width:min(360px,100%);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a';
    form.innerHTML = '<strong id="foam-size-title" style="font-size:16px">Işıklı Strafor Ölçüsü</strong><span style="color:#64748b">Gerçek dış ölçüyü cm olarak gir.</span><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label style="display:grid;gap:5px">X · Genişlik (cm)<input name="width" type="number" min="10" max="5000" step="1" value="'+Math.round(defaultWidthCm)+'" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label><label style="display:grid;gap:5px">Y · Yükseklik (cm)<input name="height" type="number" min="5" max="350" step="1" value="'+Math.round(defaultHeightCm)+'" required style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px"></label></div><span style="color:#64748b">Gövde: 3,5 cm · Duvar boşluğu: 1,5 cm</span><div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-cancel>İptal</button><button type="submit" class="primary">Yerleştir</button></div>';
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
      if (!(widthCm >= 10 && widthCm <= 5000 && heightCm >= 5 && heightCm <= 350)) return;
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

async function beginIlluminatedFoamAssetDrag(assetId) {
  const asset = imageAssets.get(assetId);
  if (!asset) return false;
  const isSvg = asset.type === 'image/svg+xml' || /\.svg$/i.test(asset.name || '');
  if (!isSvg) {
    assetStatus.textContent = 'Işıklı Strafor için SVG görsel kullan.';
    return false;
  }
  if (!currentStand) {
    assetStatus.textContent = 'Önce stand sahnesini oluştur.';
    return false;
  }

  if (illuminatedFoamAssetDragCleanup) illuminatedFoamAssetDragCleanup();

  const svgText = await asset.blob.text();
  const aspect=Math.max(0.1,getSvgAspectRatioFromText(svgText));
  const defaultWidthCm=200;
  const defaultHeightCm=Math.max(10,defaultWidthCm/aspect);
  const dimensions=await requestIlluminatedFoamDimensions(defaultWidthCm,defaultHeightCm);
  if(!dimensions){ assetStatus.textContent='Işıklı Strafor oluşturma iptal edildi.'; return false; }
  const moduleState=createModuleStateFromDescriptor({type:'illuminated-foam',widthCm:dimensions.widthCm,heightCm:dimensions.heightCm,haloColor:'#ffffff'},{imageAssetId:asset.id});
  let lastPreview = null;

  const onPointerMove = (event) => {
    lastPreview = scene3d.previewCatalogModuleDrag(moduleState, event.clientX, event.clientY, 0, false);
  };
  const cleanup = () => {
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
    scene3d.clearCatalogModuleDrag();
    illuminatedFoamAssetDragCleanup = null;
  };
  const onPointerUp = (event) => {
    const result = scene3d.dropCatalogModuleDrag(moduleState, event.clientX, event.clientY, 0, false);
    if (!result.ok || !result.placement) {
      assetStatus.textContent = result.message || 'Işıklı Strafor bu konuma bırakılamadı.';
      return;
    }
    moduleState.placement = { ...result.placement };
    currentModules.push(moduleState);
    cleanup();
    rebuildWall({ resetView: false });
    assetStatus.textContent=`Işıklı Strafor sahneye eklendi · ${moduleState.widthCm} × ${moduleState.heightCm} cm · 3,5 cm kalınlık · 1,5 cm ışık boşluğu.`;
  };
  const onKeyDown = (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    cleanup();
    assetStatus.textContent = 'Işıklı Strafor yerleştirme iptal edildi.';
  };

  document.addEventListener('pointermove', onPointerMove, true);
  document.addEventListener('pointerup', onPointerUp, true);
  document.addEventListener('keydown', onKeyDown, true);
  illuminatedFoamAssetDragCleanup = cleanup;
  assetStatus.textContent = 'Işıklı Strafor hazır · mouse ile duvara götür ve tıkla.';
  return Boolean(lastPreview) || true;
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

assetContextMenu.querySelector('[data-asset-action="illuminated-foam"]').addEventListener('click', () => {
  const assetId = assetContextAssetId;
  closeAssetContextMenu();
  if (assetId) void beginIlluminatedFoamAssetDrag(assetId);
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
    console.warn('Görsel arşivi açılamadı:', error);
    assetStatus.textContent = 'Tarayıcı görsel arşivini açamadı.';
  }
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
    window.alert(formatImageUploadTooLargeMessage());
    return;
  }

  try {
    const asset = await saveImageAsset(activeProjectId, file);
    markAssetDirty(activeProjectId, asset.id);
    registerAsset(asset);
    setActiveAsset(asset.id);

    const selected = scene3d.getSelectedSurfaces();
    if (selected.length) applyActiveImageToSelection('cover');

    if (currentStand || autosaveController.isEnabled() || revisionSession.mode === 'historical') {
      try {
        autosaveController.clearPending();
        const added = await persistActiveProject({ quiet: true });
        if (added?.enableAutosave !== false) autosaveController.enableFromCurrentState();
      } catch (persistError) {
        console.warn('Görsel eklendi ama otomatik kayıt başarısız:', persistError);
        assetStatus.textContent = 'Görsel eklendi · otomatik kayıt başarısız.';
      }
    }
  } catch (error) {
    console.warn('Görsel kaydedilemedi:', error);
    const message = error?.message || 'Görsel arşive kaydedilemedi.';
    if (message === formatImageUploadTooLargeMessage()) {
      window.alert(message);
      return;
    }
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
      console.warn('Proje adı değiştirilemedi:', error);
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
  } catch (error) {
    console.warn('Proje kaydedilemedi:', error);
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
    console.warn('Proje farklı kaydedilemedi:', error);
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
    console.warn('Proje dışarı aktarılamadı:', error);
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
  } catch (error) {
    if (importStorageTouched && importedProjectId) {
      try {
        await deleteProjectWithAssets(importedProjectId);
        await refreshProjectList();
      } catch (cleanupError) {
        console.warn('Başarısız içe aktarma temizlenemedi:', cleanupError);
      }
    }
    console.warn('Proje içe aktarılamadı:', error);
    projectStatus.textContent = `Proje ZIP içe aktarılamadı: ${error?.message || 'Bilinmeyen hata.'}`;
  } finally {
    projectLoading.hide();
    setButtonBusy(importProjectButton, false);
  }
});

async function openStoredProject(projectId) {
  if (!projectId) {
    projectStatus.textContent = 'Açılacak kayıtlı proje yok.';
    return false;
  }

  projectLoading.show('Proje yükleniyor…', 'Görseller ve sahne hazırlanıyor.');
  setButtonBusy(openProjectButton, true, 'Açılıyor');
  projectStatus.textContent = 'Proje yükleniyor…';
  try {
    const project = await loadProject(projectId);
    if (!project) {
      projectStatus.textContent = 'Proje bulunamadı.';
      return false;
    }
    await restoreProject(project);
    return true;
  } catch (error) {
    console.warn('Proje açılamadı:', error);
    projectStatus.textContent = 'Proje açılamadı.';
    return false;
  } finally {
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
  } catch (error) { console.warn('Proje silinemedi:', error); projectStatus.textContent = 'Proje silinemedi.'; }
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

void refreshProjectList().catch((error) => console.warn('Proje listesi açılamadı:', error));
if (initialProjectId) {
  void openStoredProject(initialProjectId);
}

const historicalEditWatch = setInterval(() => {
  if (revisionSession.mode !== 'historical' || revisionSession.hasCreatedRevision || revisionSession.historicalEditArmed) return;
  if (designSignature() === revisionSession.baselineDesign) return;
  revisionSession.historicalEditArmed = true;
  autosaveController.enableFromCurrentState();
  autosaveController.schedule();
}, 1000);

  return function stopFairStandConfigurator() {
    clearInterval(historicalEditWatch);
    clearInterval(designHistoryWatch);
    window.removeEventListener('keydown', onDesignHistoryKeyDown);
    window.removeEventListener('pointerup', scheduleDesignHistoryCapture);
    window.removeEventListener('keyup', scheduleDesignHistoryCapture);
    document.removeEventListener('change', scheduleDesignHistoryCapture);
    window.removeEventListener('beforeunload', onBeforeUnloadWarnUnsaved);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('visibilitychange', onVisibilityChangeSave);
    // CRM içinde başka sayfaya geçilirken bekleyen değişiklik arka planda kaydedilir.
    void autosaveController?.saveNowIfDirty?.().catch(() => {});
    autosaveController?.disable?.();
    productionBomPanel?.destroy?.();
    window.removeEventListener('fair-stand:delete-selected-module', onDeleteSelectedModule);
    scene3d?.dispose?.();
    unbindProjectActionSaveGuard?.();
  };
}

const standaloneRoot = typeof document !== 'undefined' ? document.getElementById('app') : null;
if (standaloneRoot) {
  startFairStandConfigurator();
}
