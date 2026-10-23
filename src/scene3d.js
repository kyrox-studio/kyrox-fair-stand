import * as THREE from 'three';
import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { getModuleCatalogItem, getModuleCatalogLabel } from './catalog.js';
import { STAND_DIMENSIONS } from './standDimensions.js';
import { createSlottedProfileGeometry } from './profileGeometry.js';
import { WALL_PANEL_BAND_PITCH_CM, fitPanelToFrameOpening, resolveModuleBandPitchCm } from './wallPanelBand.js';
import {
  GLASS_APPEARANCE,
  TABLE_GLASS_APPEARANCE,
  TABLE_GLASS_RENDER_TRANSMISSION,
  PANEL_GLASS_BACKING_APPEARANCE,
  getMaterialAppearance,
} from './theme.js';
import { surfaceCapabilityUserData } from './itemCapabilities.js';
import {
  getCommercialItemForType,
  getFloorItem,
  getItem,
  itemDefaultColorCss,
  getShowcaseBodyDefinition,
  isCarpetFloorItem,
  isGridTileFloorItem,
  isParquetFloorItem,
  listFloorItems,
  listRegisteredItems,
  applyItemPlacementZCm,
  isWallShortFamilyDescriptor,
  itemMovesVertically,
  getActiveWallLineHeightCm,
  resolveItemDefaultZCm,
  resolveModuleSceneBoxCm,
  requireModuleSceneBoxCm,
  clampHeightToStandCeilingCm,
  getProceduralFrameCrossSectionM,
  resolveRecipePanelThicknessCm,
  resolveSceneDimensions,
  resolveShelfRows,
} from './items.js';
import {
  buildLiveAssemblyParts,
  computeAssemblyPartsAabbCm,
  computeAssemblySceneFitTransform,
  isAssemblyFramePartType,
  isAssemblyPanelPartType,
  isAssemblyRenderableChild,
  isAssemblyTopPartType,
  itemHasAssemblyLayout,
  listModuleFaceStates,
  readItemBoxCm,
  resolveAssemblyPartVisual,
} from './itemAssembly.js';
import { snapPlacementToItemAnchor } from './itemSnap.js';
import { rectangleFromCorners } from './floorArea.js';
import { resolveModuleStripOccupancy } from './stripOccupancy.js';
import { createHorizontalImageLayout } from './horizontalImageLayout.js';
import { createRectImageLayout, visualImageColumnItems } from './rectImageLayout.js';
import { createConnectedPanelModulePath, createPanelRangeSelection, createRectSelection } from './rectSelection.js';
import { applyColorOverride, createDefaultImageTransform, ensureBoxBlockFaces } from './designState.js';
import {
  applyGlassOverride,
  applyMetalSeparatorOverride,
  bindRendererSurfaceState,
  clearFabricFields,
  cloneSurfaceStateForRenderer,
  syncRendererSurfaceState,
} from './surfaceStateBinding.js';
import { createViewCube, resolveHomeViewDirection } from './viewCube.js';
import { isEditableKeyboardTarget, resolveViewKeyboardShortcut } from './viewKeyboardShortcuts.js';
import { computeGroupSizeSlice, computeImageFit, computeImageSizeTile, resolveImageTileHeightCm } from './imageFit.js';
import { formatPlacementFeedbackMessage, formatWallOverlayFeedback, hasPlacementFeedbackPointer } from './placementFeedback.js';
import { SCENE_SURROUND_M } from './sceneDimensions.js';
import {
  WALL_OVERLAY_DEFAULT_CENTER_CM,
  clampWallOverlayZCm,
  createModulePlacement,
  getAllowedWallIds,
  getModulePlacementSnapCm,
  getWallOverlayZBoundsCm,
  isVerticalModuleRotation,
  normalizeModuleRotationZDeg,
  rotateModuleRotationZDeg,
  rotateModulePlacementAroundCenter,
  snapPanelSeamOverlayPlacement,
  snapPlacementToStand,
  snapPlacementToModules,
  stepPanelSeamOverlayPlacement,
  clampFloorRelativeBottomZCm,
  clampMountBottomZCm,
  stepMountBottomZCm,
  stepTulleFabricZCm,
  stepWallShortFloorZCm,
  validatePlacementAgainstModules,
} from './modulePlacement.js';
import {
  planContinuousModuleInsert,
  planContinuousModuleMove,
} from './moduleMove.js';
import { MODULE_LOCKED_MESSAGE, describeLockedBlock, guardPlanAgainstLocks, isModuleLocked } from './moduleLock.js';
import {
  GROUP_MOVE_STEP_CM,
  GROUP_ROTATE_STEP_DEG,
  getGroupMembers,
  getModuleGroupId,
  planGroupRotate,
  planGroupTranslate,
} from './moduleGroups.js';
import { getModuleBehavior, getModuleGhostBehavior, isFreePlacementModule, isTopPlacementModule, isWallOverlayModule, resolveModuleRotationDeltaDeg, supportsWallOverlayMount, usesPanelSeamOverlaySnap } from './moduleBehavior.js';
import { createModuleCatalogPreview } from './moduleDragSidebar.js';
import { noteSceneRender, trackSceneModel, trackSceneTextureLoader } from './sceneAssetLoading.js';

function frameColorForModule(moduleState) {
  const item = getItem(moduleState?.itemKey);
  if ((item?.type === 'profile' || item?.type === 'upright') && Number.isInteger(item.defaultColor)) {
    return itemDefaultColorCss(item);
  }
  const rows = item?.composition?.mode === 'recipe' ? item.composition.items : [];
  const children = rows.map((row) => getItem(row?.itemKey)).filter(Boolean);
  const profile = children.find((child) => child.type === 'profile' && Number.isInteger(child.defaultColor));
  if (profile) return itemDefaultColorCss(profile);
  const upright = children.find((child) => child.type === 'upright' && Number.isInteger(child.defaultColor));
  if (upright) return itemDefaultColorCss(upright);
  // Sentetik baza katmanı / eksik itemKey: kayıtlı herhangi bir profil rengine düş.
  const fallbackProfile = listRegisteredItems().find(
    (candidate) => candidate.type === 'profile' && Number.isInteger(candidate.defaultColor),
  );
  if (fallbackProfile) return itemDefaultColorCss(fallbackProfile);
  throw new TypeError(`Missing frame defaultColor for ${item?.itemKey ?? 'unknown Item'}.`);
}

function moduleSurfaceColor(moduleState, item) {
  if (typeof moduleState?.surface?.color === 'string' && moduleState.surface.color) {
    return moduleState.surface.color;
  }
  return itemDefaultColorCss(item ?? moduleState?.itemKey);
}
const PANEL_BACK_COLOR = 0x4b5563;
// Otomatik alınlığın arka yüz paneli yok; içeriden gövde görünür. Gövde açık renk çizilir ki
// alınlık içeriden koyu bir şerit gibi durmasın. Yalnız görünüm: BOM ve arka yüz paneli değişmez.
const FASCIA_BACK_COLOR = 0xe5e7eb;

function opaquePanelBackColor(moduleState) {
  return moduleState?.autoFascia === true ? FASCIA_BACK_COLOR : PANEL_BACK_COLOR;
}

function panelFaceBackingMaterial(isGlass) {
  const glass = Boolean(isGlass);
  return new THREE.MeshStandardMaterial({
    color: glass ? PANEL_GLASS_BACKING_APPEARANCE.color : PANEL_BACK_COLOR,
    roughness: glass ? PANEL_GLASS_BACKING_APPEARANCE.roughness : 0.74,
    metalness: 0,
    transparent: glass,
    opacity: glass ? PANEL_GLASS_BACKING_APPEARANCE.opacity : 1,
    depthWrite: !glass,
  });
}

const METAL_GRID_CELL_M = 0.08;
const METAL_WIRE_M = 0.008;
const METAL_WIRE_DEPTH_M = 0.016;

function removeMetalGrid(mesh) {
  const grid = mesh?.getObjectByName?.('metal-separator-grid');
  if (!grid) return;
  mesh.remove(grid);
  const geometries = new Set();
  const materials = new Set();
  grid.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry);
    if (child.material) materials.add(child.material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}

function paintMetalGrid(mesh, widthM, heightM) {
  removeMetalGrid(mesh);
  const width = Math.max(Number(widthM) || METAL_GRID_CELL_M, METAL_GRID_CELL_M);
  const height = Math.max(Number(heightM) || METAL_GRID_CELL_M, METAL_GRID_CELL_M);
  const cols = Math.max(2, Math.round(width / METAL_GRID_CELL_M));
  const rows = Math.max(2, Math.round(height / METAL_GRID_CELL_M));
  const wire = METAL_WIRE_M;
  const grid = new THREE.Group();
  grid.name = 'metal-separator-grid';
  const material = new THREE.MeshStandardMaterial({
    color: 0x2b323a,
    roughness: 0.45,
    metalness: 0.35,
  });
  const vertical = new THREE.BoxGeometry(wire, height, METAL_WIRE_DEPTH_M);
  for (let column = 0; column <= cols; column += 1) {
    const bar = new THREE.Mesh(vertical, material);
    bar.position.set(-width / 2 + (column * width) / cols, 0, 0);
    bar.castShadow = true;
    bar.raycast = () => {};
    grid.add(bar);
  }
  const horizontal = new THREE.BoxGeometry(width, wire, METAL_WIRE_DEPTH_M);
  for (let row = 0; row <= rows; row += 1) {
    const bar = new THREE.Mesh(horizontal, material);
    bar.position.set(0, -height / 2 + (row * height) / rows, 0.002);
    bar.castShadow = true;
    bar.raycast = () => {};
    grid.add(bar);
  }
  mesh.add(grid);
  const face = mesh.material;
  if (face) {
    face.map = null;
    face.alphaTest = 0;
    face.transparent = true;
    face.opacity = 0;
    face.depthWrite = false;
    face.needsUpdate = true;
  }
}

function panelFaceSurfaceMaterial(surfaceState) {
  const glass = Boolean(surfaceState?.isGlass);
  const metal = Boolean(surfaceState?.isMetalSeparator) && !glass;
  const material = new THREE.MeshStandardMaterial({
    color: surfaceState?.imageAssetId
      ? 0xffffff
      : (glass ? GLASS_APPEARANCE.color : surfaceState?.color),
    roughness: metal ? 0.55 : (glass ? GLASS_APPEARANCE.roughness : 0.72),
    metalness: metal ? 0.42 : 0,
    transparent: glass,
    opacity: glass ? GLASS_APPEARANCE.opacity : 1,
    depthWrite: !glass,
    side: THREE.DoubleSide,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  if (metal) {
    material.color.set(0xffffff);
    material.roughness = 0.42;
    material.metalness = 0.2;
  }
  return material;
}
const PANEL_VERTICAL_CLEARANCE_M = 0;
// Panel yüzü duvar/profil ön yüzünün 15 mm önünde durur; duvara asılan TV, raf ve strafor bu yüze oturur.
const PANEL_FACE_OFFSET_M = 0.015;
const MESH_FABRIC_OPACITY = 0.48;
const FLOOR_COLOR = 0xe9edf1;
const OUTER_FLOOR_COLOR = 0xd2d8df;
const GRID_COLOR = 0x7f8994;
// Ana ışığın stand merkezine göre konumu: tepeden, hafif öne (+Z) ve sağa eğik.
const KEY_LIGHT_OFFSET = Object.freeze({ x: 1.2, y: 12, z: 3 });
// Gölge kamerasının stand kenarından taşma payı (çevre şeridi + uzun gölgeler).
const KEY_LIGHT_SHADOW_MARGIN_M = 2;
// Render Al'da standın tepesindeki sahne spotu: zemine stand merkezli ışık havuzu düşürür,
// havuz kenarı stand köşelerinin biraz dışında yumuşakça kararır. Gölge atmaz (gölge ana ışıkta).
const STAND_TOP_SPOT = Object.freeze({
  heightM: 9,
  intensityCd: 400,
  poolMarginM: 2,
  penumbra: 0.75,
  decay: 2,
});
// Perspektif kameranın yakın kesme mesafesi bakılan noktaya uzaklığın bu oranıdır (sınırlar
// arasında). Sabit 0.05 m'de derinlik hassasiyeti ~50 m'de 3 mm'ye düşer; panel yüzü ile gövde
// arasındaki 3 mm boşluk uzaktan titrer (z-fighting). Uzaklaşınca near büyür, yakında 0.05 kalır.
const PERSPECTIVE_NEAR = Object.freeze({ ratio: 0.01, minM: 0.05, maxM: 1 });
// Sahne ışığında ortam ışığı (hemisphere) ters çevrilir: gök rengi (zemine düşer) koyu, yer rengi
// (yere bakan yüzlere düşer) açık. Dikey yüzler ikisinin ortalamasını alır; alınlık gibi dışa bakan
// yüzler aydınlık kalır, zemin ve hol karanlıktır. Ek ışık yoktur (her ışık her pikselde maliyettir;
// yavaş cihazda dokunma gecikir). Renkler doğrusal (linear) çarpandır.
const STAGE_HEMISPHERE = Object.freeze({ sky: 0.23, ground: 1, intensity: 5.3 });
// Render Al'da ana ışık gölge için yanar ve bu orana kısılır; editör sahne ışığında ana ışık kapalıdır
// (tepeden ışığı spot verir, ışık sayısı sahne ışığı kapalı editörle aynı kalır).
const RENDER_KEY_LIGHT_DIM = 0.45;
// Ölçü katmanı renkleri: taban alanı turuncu kesikli, kenar uzaklığı mavi.
const MEASURE_FOOTPRINT_COLOR = 0xf97316;
const MEASURE_DISTANCE_COLOR = 0x2563eb;
// Bu mesafenin altındaki (kenara yaslanmış) uzaklık çizilmez.
const MEASURE_MIN_DISTANCE_M = 0.005;
// Stand zemini ızgarası (1 m kalın / 50 cm ince); yalnız taşırken görünür, boşta hiç yok.
const STAND_GRID_COLOR = 0xb4bcc6;
const STAND_GRID_FINE_STEP_M = 0.5;
const STAND_GRID_FINE_PER_BOLD = 2;
const STAND_GRID_OPACITY = Object.freeze({ bold: 0.8, fine: 0.45 });
const STAND_BORDER_COLOR = 0x6f7a87;
const ACTIVE_WALL_GUIDE_COLOR = 0xf97316;
const ACTIVE_WALL_GUIDE_THICKNESS_M = 0.045;
const ACTIVE_WALL_GUIDE_HEIGHT_M = 0.018;
// Aktif stand zemini fuar salonu zemininden 5 cm yukarıda duran platformdur.
const ACTIVE_PLATFORM_HEIGHT_M = 0.05;
function listFloorTypeKeys() {
  return listFloorItems().map((item) => item.itemKey);
}
const FLOOR_TOP_EPSILON_M = 0.006;
const SELECTION_COLOR = 0x2563eb;
// Küme seçimi (Shift+tık toplu seçim, grup üyeleri): Kyrox bakırı (kyrox-brand --kyrox-copper #C47A3A).
// Tek öğe ve panel seçimi mavi kalır.
const GROUP_SELECTION_COLOR = 0xc47a3a;
const PLACEMENT_VALID_COLOR = 0x16a34a;
const PLACEMENT_INVALID_COLOR = 0xdc2626;
const DRAG_THRESHOLD_PX = 5;
const DEFAULT_VIEW_MIN_DISTANCE = 9;
const DEFAULT_VIEW_DISTANCE_FACTOR = 1.32;
const HOME_DIRECTION = new THREE.Vector3(1, 0.72, 1).normalize();
const STAGE_HOME_DIRECTION = new THREE.Vector3(1, 1.05, 1).normalize();

const EAMES_CHAIR_TARGET_HEIGHT_M = 0.82;
const gltfSceneCache = new Map();

function notifyGltfLoadFailure(url, error) {
  console.warn('GLB modeli yüklenemedi:', url, error);
  const el = getFairStandHostDocument()?.querySelector('#stage-result') ?? null;
  if (!el) return;
  el.textContent = '3D model yüklenemedi. Modül yerinde kalır; görünür geometri eksik olabilir.';
  el.classList.add('error');
}

function loadGltfScene(url) {
  const cached = gltfSceneCache.get(url);
  if (cached) return cached;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const promise = Promise.resolve(MeshoptDecoder.ready)
    .then(() => loader.loadAsync(url))
    .then((gltf) => {
      requestEditorRender();
      return gltf.scene;
    }).catch((error) => {
      gltfSceneCache.delete(url);
      notifyGltfLoadFailure(url, error);
      throw error;
    });
  gltfSceneCache.set(url, promise);
  return promise;
}

function loadItemModel(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (!item?.modelFile) {
    throw new TypeError(`Missing canonical model asset for ${item?.itemKey ?? 'unknown'}.`);
  }
  return trackSceneModel(loadGltfScene(import.meta.env.BASE_URL + 'models/' + item.modelFile));
}

// Proje açılışı 3D modelleri sahne kurulmadan önce, proje verisi gelir gelmez başlatır:
// görseller inerken modeller de iner ve ayrıştırılır. Aynı adres önbelleği (gltfSceneCache)
// sahne kurulumunda tekrar kullanılır; model iki kez inmez. Dönen değer başlatılan dosya sayısıdır.
export function prefetchModuleModels(modules) {
  const files = new Set();
  for (const moduleState of modules ?? []) {
    const modelFile = moduleState?.modelFile
      || (moduleState?.itemKey ? getItem(moduleState.itemKey)?.modelFile : null);
    if (modelFile) files.add(modelFile);
  }
  for (const modelFile of files) {
    // Hata loadGltfScene içinde bildirilir ve önbellekten düşer; sahne kurulumu yeniden dener.
    loadItemModel({ modelFile }).catch(() => {});
  }
  return files.size;
}

function createTvScreenTexture(itemOrKey) {
  const item = typeof itemOrKey === 'string' ? getItem(itemOrKey) : itemOrKey;
  if (!item?.defaultScreenFile) {
    throw new TypeError(`Missing canonical default screen asset for ${item?.itemKey ?? 'unknown'}.`);
  }
  const texture = new THREE.TextureLoader().load(
    import.meta.env.BASE_URL + item.defaultScreenFile,
    () => requestEditorRender(),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function isFloorFixtureType(type) {
  return isFreePlacementModule(type);
}

function isTopFixtureType(type) {
  return isTopPlacementModule(type);
}

function withItemZ(moduleState, placement, overlayZCm = null) {
  const next = applyItemPlacementZCm(moduleState, placement, { overlayZCm });
  if (!next || overlayZCm != null) return next;
  // Yerden taban Z: tepe stand tavanını geçemez (tül kalınlığı depthCm, kutu/wall-short heightCm).
  if (moduleState?.type === 'tulle-fabric') {
    return { ...next, zCm: clampFloorRelativeBottomZCm(next.zCm, Number(moduleState.depthCm) || 0) };
  }
  if (moduleState?.type === 'box-block' || isWallShortFamilyDescriptor(moduleState)) {
    return { ...next, zCm: clampFloorRelativeBottomZCm(next.zCm, Number(moduleState.heightCm) || 0) };
  }
  // Üst montaj (projektör): taban 0…tavan; gövde yüksekliği max’ı düşürmez.
  if (isTopFixtureType(moduleState?.type) || isTopPlacementModule(moduleState)) {
    return { ...next, zCm: clampMountBottomZCm(next.zCm) };
  }
  return next;
}

let deleteShortcutLatched = false;

function snapCollisionExemption(magneticSnap) {
  if (!magneticSnap?.targetModuleId || !magneticSnap.snapKind) return {};
  return {
    snapTargetModuleId: magneticSnap.targetModuleId,
    snapKind: magneticSnap.snapKind,
  };
}

// Projektör ve raf altı spot ışıkları yalnız Render Al'da yanar. Editör kamerası bu katmanı
// görmez (three.js ışığı kamera katmanında değilse hesaba katmaz): çok sayıda gerçek ışık her
// pikselde hesaplanıp açılışı ve döndürmeyi ağırlaştırıyor, eklenince bütün malzemeleri yeniden
// derletiyordu. Lens ve LED şerit gibi parlayan parçalar editörde görünür kalır.
const RENDER_ONLY_LIGHT_LAYER = 1;
// Stand tepe spotu kendi katmanındadır: Render Al'da ve editördeki Sahne Işığı önizlemesinde
// yanar. Projektör ve raf altı ışıkları bu katmana girmez, editörde kapalı kalır.
const STAGE_LIGHT_LAYER = 2;

export function createStandScene(
  container,
  onSurfaceSelected,
  getAssetUrl = () => null,
  onModuleContextMenu = () => {},
  onFloorSelected = () => {},
  onSelectionAnchor = () => {},
) {
  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  const sceneAbort = new AbortController();
  const { signal } = sceneAbort;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x5f6265);
  scene.fog = new THREE.Fog(0x5f6265, 55, 90);

  // Atmosfer derinliğini düzenlenebilir standın dışında tut. Sis mesafeleri yalnız
  // sahne boyutu değişince güncellenir; kare başına CPU veya ek çizim maliyeti yok.
  function updateStageFog(widthM, depthM) {
    const diagonalM = Math.hypot(Number(widthM) || 0, Number(depthM) || 0);
    const near = Math.max(55, diagonalM * 1.25 + 18);
    const far = Math.max(90, near + Math.max(35, diagonalM * 0.8));
    scene.fog.near = near;
    scene.fog.far = far;
  }

  const perspectiveCamera = new THREE.PerspectiveCamera(42, 1, 0.05, 2000);
  perspectiveCamera.position.set(4.8, 3.4, 6.2);
  const orthographicCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 2000);
  orthographicCamera.position.copy(perspectiveCamera.position);
  let camera = perspectiveCamera;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
  const editorPixelRatio = coarsePointer
    ? Math.min(window.devicePixelRatio, 1)
    : Math.min(window.devicePixelRatio, 1.5);
  renderer.setPixelRatio(editorPixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  // Editörde ışık gölgesi kapalı: her kare gölge haritası için ikinci kez çizilmez (döndürme
  // takılmaz) ve gölgenin karanlıkta bıraktığı köşeler aydınlık kalır. Render Al (captureCurrentViewPng)
  // çizerken gölgeyi açar; müşteriye giden görsel gölgeli ve derinlikli olur.
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 1.15;
  controls.target.set(0, 1.65, 0);
  controls.minDistance = 2;
  controls.maxDistance = 1000;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = null;

  // OrbitControls ends on pointerup/pointercancel, but does not handle blur or
  // a mouse move after a release that happened outside the browser window.
  const orbitPointers = new Map();
  const orbitDocument = renderer.domElement.ownerDocument;
  const orbitWindow = orbitDocument.defaultView;
  function stopOrbitInertia() {
    const object = controls.object;
    const position = object.position.clone();
    const target = controls.target.clone();
    const zoom = object.zoom;
    const damping = controls.enableDamping;
    try {
      // A non-damped update consumes the queued orbit/pan delta. Restore the
      // current view before the renderer can draw that consumed movement.
      controls.enableDamping = false;
      controls.update();
      object.position.copy(position);
      controls.target.copy(target);
      if (object.zoom !== zoom) {
        object.zoom = zoom;
        object.updateProjectionMatrix();
      }
      controls.update();
    } finally {
      controls.enableDamping = damping;
    }
  }
  function cancelOrbitPointer(pointerId) {
    if (!orbitPointers.has(pointerId)) return;
    const pointerType = orbitPointers.get(pointerId);
    orbitPointers.delete(pointerId);
    // Use the controls' normal cancellation path, without cancelling object
    // placement/floor drawing listeners on the host window.
    renderer.domElement.dispatchEvent(new orbitWindow.PointerEvent('pointercancel', {
      pointerId, pointerType, bubbles: false,
    }));
  }
  function cancelOrbitPointers() {
    for (const pointerId of [...orbitPointers.keys()]) cancelOrbitPointer(pointerId);
    // Blur can also happen after a normal release, while damping is settling.
    stopOrbitInertia();
  }
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (controls.enabled) orbitPointers.set(event.pointerId, event.pointerType);
  }, { signal });
  orbitDocument.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      cancelOrbitPointer(event.pointerId);
    }
  }, { capture: true, signal });
  orbitDocument.addEventListener('pointerup', (event) => {
    orbitPointers.delete(event.pointerId);
  }, { capture: true, signal });
  renderer.domElement.addEventListener('pointercancel', (event) => {
    orbitPointers.delete(event.pointerId);
  }, { signal });
  renderer.domElement.addEventListener('lostpointercapture', (event) => {
    cancelOrbitPointer(event.pointerId);
  }, { signal });
  orbitWindow.addEventListener('mouseup', () => {
    for (const [pointerId, pointerType] of orbitPointers) {
      if (pointerType === 'mouse') cancelOrbitPointer(pointerId);
    }
  }, { capture: true, signal });
  orbitWindow.addEventListener('blur', cancelOrbitPointers, { signal });
  orbitDocument.addEventListener('visibilitychange', () => {
    if (orbitDocument.hidden) cancelOrbitPointers();
  }, { signal });
  signal.addEventListener('abort', cancelOrbitPointers, { once: true });

  function getViewCubeFit(direction = HOME_DIRECTION) {
    if (!stageLayout) return null;

    const widthM = stageLayout.widthM + SCENE_SURROUND_M * 2;
    const depthM = stageLayout.depthM + SCENE_SURROUND_M * 2;
    const heightM = Math.max(STAND_DIMENSIONS.height + ACTIVE_PLATFORM_HEIGHT_M, 1);
    const target = new THREE.Vector3(
      stageLayout.widthM / 2,
      heightM * 0.48,
      stageLayout.depthM / 2,
    );

    // ViewCube presets should frame the complete stand without shrinking it into the
    // middle of the viewport. Project the stage box onto the requested camera axes and
    // target roughly 82% viewport occupancy, leaving a small, consistent safe margin.
    const occupancy = 0.82;
    const half = new THREE.Vector3(widthM / 2, heightM / 2, depthM / 2);
    const viewDirection = direction.clone();
    if (viewDirection.lengthSq() === 0) viewDirection.copy(HOME_DIRECTION);
    viewDirection.normalize();

    const referenceUp = Math.abs(viewDirection.y) > 0.98
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
    const right = referenceUp.clone().cross(viewDirection).normalize();
    const screenUp = viewDirection.clone().cross(right).normalize();

    const projectedHalfWidth = Math.abs(right.x) * half.x
      + Math.abs(right.y) * half.y
      + Math.abs(right.z) * half.z;
    const projectedHalfHeight = Math.abs(screenUp.x) * half.x
      + Math.abs(screenUp.y) * half.y
      + Math.abs(screenUp.z) * half.z;
    const depthHalf = Math.abs(viewDirection.x) * half.x
      + Math.abs(viewDirection.y) * half.y
      + Math.abs(viewDirection.z) * half.z;

    const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
    const verticalFov = THREE.MathUtils.degToRad(perspectiveCamera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const perspectiveFit = Math.max(
      projectedHalfHeight / Math.tan(verticalFov / 2),
      projectedHalfWidth / Math.tan(horizontalFov / 2),
    ) / occupancy;
    // Do not add the full projected scene depth to the fit distance. That conservative
    // term made isometric/home presets pull far away even though the stand already fit.
    // A small depth allowance keeps near corners safe while letting the stand actually
    // occupy the intended ~82% of the viewport.
    const depthAllowance = depthHalf * 0.16;
    const distance = THREE.MathUtils.clamp(
      perspectiveFit + depthAllowance,
      controls.minDistance,
      controls.maxDistance,
    );

    const verticalSpan = Math.max(
      projectedHalfHeight * 2,
      (projectedHalfWidth * 2) / Math.max(aspect, 0.1),
    ) / occupancy;

    return { target, distance, verticalSpan };
  }

  const viewCube = createViewCube(
    container,
    camera,
    controls,
    getViewCubeFit,
    () => resolveHomeViewDirection(stageLayout?.standType),
    requestEditorRender,
  );

  let cameraMode = 'perspective';
  const projectionControl = document.createElement('div');
  projectionControl.className = 'projection-control';
  projectionControl.setAttribute('aria-label', 'Kamera projeksiyonu');
  projectionControl.style.cssText = [
    'position:absolute',
    'right:18px',
    'bottom:18px',
    'z-index:35',
    'display:flex',
    'gap:4px',
    'padding:4px',
    'border:1px solid rgba(148,163,184,.55)',
    'border-radius:9px',
    'background:rgba(255,255,255,.9)',
    'box-shadow:0 5px 16px rgba(15,23,42,.12)',
    'backdrop-filter:blur(5px)',
  ].join(';');

  const projectionButtons = new Map();
  [['perspective', 'Persp'], ['orthographic', 'Ortho']].forEach(([mode, label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.title = mode === 'perspective' ? 'Perspektif görünüş' : 'Ortografik görünüş';
    button.style.cssText = [
      'height:28px',
      'padding:0 9px',
      'border:0',
      'border-radius:6px',
      'font:700 11px/1 system-ui,sans-serif',
      'cursor:pointer',
      'transition:background .15s,color .15s',
    ].join(';');
    projectionControl.appendChild(button);
    projectionButtons.set(mode, button);
  });
  container.appendChild(projectionControl);

  function styleProjectionButtons() {
    projectionButtons.forEach((button, mode) => {
      const active = mode === cameraMode;
      button.style.background = active ? '#2563eb' : 'transparent';
      button.style.color = active ? '#ffffff' : '#475569';
    });
  }

  function setOrthographicSpan(verticalSpan, aspect) {
    const safeSpan = Math.max(0.25, Number(verticalSpan) || 10);
    const safeAspect = Math.max(0.1, Number(aspect) || 1);
    orthographicCamera.top = safeSpan / 2;
    orthographicCamera.bottom = -safeSpan / 2;
    orthographicCamera.right = (safeSpan * safeAspect) / 2;
    orthographicCamera.left = -(safeSpan * safeAspect) / 2;
    orthographicCamera.updateProjectionMatrix();
  }

  // Ortho kamerada derinlik doğrusaldır, near ayarı gerekmez.
  function syncPerspectiveNear() {
    if (camera !== perspectiveCamera) return;
    const distanceM = perspectiveCamera.position.distanceTo(controls.target);
    const nearM = THREE.MathUtils.clamp(distanceM * PERSPECTIVE_NEAR.ratio, PERSPECTIVE_NEAR.minM, PERSPECTIVE_NEAR.maxM);
    if (Math.abs(nearM - perspectiveCamera.near) < 0.0001) return;
    perspectiveCamera.near = nearM;
    perspectiveCamera.updateProjectionMatrix();
  }

  function updateCameraProjection(width, height) {
    const aspect = Math.max(1, width) / Math.max(1, height);
    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();
    if (cameraMode === 'orthographic') {
      const span = Math.max(0.25, (orthographicCamera.top - orthographicCamera.bottom));
      setOrthographicSpan(span, aspect);
    }
  }

  function setCameraMode(nextMode) {
    const resolved = nextMode === 'orthographic' ? 'orthographic' : 'perspective';
    if (resolved === cameraMode) return cameraMode;

    const source = camera;
    const target = resolved === 'orthographic' ? orthographicCamera : perspectiveCamera;
    const targetPoint = controls.target.clone();
    const direction = source.position.clone().sub(targetPoint);
    if (direction.lengthSq() === 0) direction.copy(HOME_DIRECTION);
    direction.normalize();

    if (resolved === 'orthographic') {
      const distance = source.position.distanceTo(targetPoint);
      const verticalSpan = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov) / 2);
      const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      orthographicCamera.zoom = 1;
      setOrthographicSpan(verticalSpan, aspect);
      target.position.copy(source.position);
    } else {
      const visibleSpan = (orthographicCamera.top - orthographicCamera.bottom) / Math.max(orthographicCamera.zoom, 0.0001);
      const distance = visibleSpan / (2 * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov) / 2));
      target.position.copy(targetPoint).addScaledVector(direction, distance);
    }

    target.quaternion.copy(source.quaternion);
    target.up.copy(source.up);
    camera = target;
    cameraMode = resolved;
    controls.object = camera;
    controls.update();
    viewCube.setCamera(camera);
    styleProjectionButtons();
    return cameraMode;
  }

  projectionButtons.get('perspective').addEventListener('click', () => setCameraMode('perspective'), { signal });
  projectionButtons.get('orthographic').addEventListener('click', () => setCameraMode('orthographic'), { signal });
  styleProjectionButtons();

  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x7f8790, 2.1);
  scene.add(hemisphereLight);

  // Ana ışık fuar holündeki gibi tepeden gelir (bkz. aimKeyLightAtStand); hafif öne eğik
  // olduğu için panel yüzleri de aydınlanır, gölge öğenin altına kısa düşer.
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(KEY_LIGHT_OFFSET.x, KEY_LIGHT_OFFSET.y, KEY_LIGHT_OFFSET.z);
  keyLight.castShadow = true;
  // 2K editör için yeterli; yönsel gölge haritası bellek/dolgu maliyeti
  // önceki 4K tahsisinin dörtte birine iner.
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight, keyLight.target);

  // Render Al'da ve Sahne Işığı önizlemesinde yanar (STAGE_LIGHT_LAYER); kapalıyken editör aydınlık kalır.
  const standTopSpot = new THREE.SpotLight(
    0xfff6e8,
    STAND_TOP_SPOT.intensityCd,
    0,
    Math.PI / 4,
    STAND_TOP_SPOT.penumbra,
    STAND_TOP_SPOT.decay,
  );
  standTopSpot.castShadow = false;
  standTopSpot.layers.set(STAGE_LIGHT_LAYER);
  scene.add(standTopSpot, standTopSpot.target);

  // Sahne ışığı: tepe spotu yanar, ortam ışığı ters çevrilir (STAGE_HEMISPHERE). Editörde ana ışık
  // kapanır; Render Al'da (forRender) gölge için RENDER_KEY_LIGHT_DIM oranında yanar. Kapalıyken
  // editörün kendi ışık değerleri geri gelir. İki kamera da aynı katmanı görür.
  const editorHemisphere = Object.freeze({
    sky: hemisphereLight.color.clone(),
    ground: hemisphereLight.groundColor.clone(),
    intensity: hemisphereLight.intensity,
  });
  const editorKeyIntensity = keyLight.intensity;
  // Varsayılan açık: editör sahne ışığıyla açılır; Sahne Işığı düğmesi oturum boyunca kapatabilir.
  let stageLightPreview = true;
  function applyStageLighting(enabled, { forRender = false } = {}) {
    [perspectiveCamera, orthographicCamera].forEach((viewCamera) => {
      if (enabled) viewCamera.layers.enable(STAGE_LIGHT_LAYER);
      else viewCamera.layers.disable(STAGE_LIGHT_LAYER);
    });
    if (enabled) {
      hemisphereLight.color.setScalar(STAGE_HEMISPHERE.sky);
      hemisphereLight.groundColor.setScalar(STAGE_HEMISPHERE.ground);
      hemisphereLight.intensity = STAGE_HEMISPHERE.intensity;
    } else {
      hemisphereLight.color.copy(editorHemisphere.sky);
      hemisphereLight.groundColor.copy(editorHemisphere.ground);
      hemisphereLight.intensity = editorHemisphere.intensity;
    }
    keyLight.visible = !enabled || forRender;
    keyLight.intensity = editorKeyIntensity * (enabled && forRender ? RENDER_KEY_LIGHT_DIM : 1);
  }
  applyStageLighting(stageLightPreview);

  // Oturumluk editör önizlemesi; projeye kaydedilmez.
  function setStageLightPreview(enabled) {
    stageLightPreview = Boolean(enabled);
    applyStageLighting(stageLightPreview);
    requestEditorRender();
    return stageLightPreview;
  }

  function aimKeyLightAtStand(widthM, depthM) {
    const centerX = widthM / 2;
    const centerZ = depthM / 2;
    // Spot koni yarıçapı zeminde stand köşegeninin yarısı + pay olur; havuz her ölçüde standı kaplar.
    const poolRadiusM = Math.hypot(widthM, depthM) / 2 + STAND_TOP_SPOT.poolMarginM;
    standTopSpot.position.set(centerX, STAND_TOP_SPOT.heightM, centerZ);
    standTopSpot.target.position.set(centerX, 0, centerZ);
    standTopSpot.target.updateMatrixWorld();
    standTopSpot.angle = Math.atan(poolRadiusM / STAND_TOP_SPOT.heightM);
    keyLight.position.set(centerX + KEY_LIGHT_OFFSET.x, KEY_LIGHT_OFFSET.y, centerZ + KEY_LIGHT_OFFSET.z);
    keyLight.target.position.set(centerX, 0, centerZ);
    keyLight.target.updateMatrixWorld();
    // Gölge kamerası bütün standı ve çevresini kapsar.
    const halfSpanM = Math.max(widthM, depthM) / 2 + KEY_LIGHT_SHADOW_MARGIN_M;
    const shadowCamera = keyLight.shadow.camera;
    shadowCamera.left = -halfSpanM;
    shadowCamera.right = halfSpanM;
    shadowCamera.top = halfSpanM;
    shadowCamera.bottom = -halfSpanM;
    shadowCamera.near = 0.5;
    shadowCamera.far = KEY_LIGHT_OFFSET.y * 2;
    shadowCamera.updateProjectionMatrix();
  }


  // Fixed exhibition-hall ground: 4K CC0 Damaged Concrete Floor 02 from Poly Haven.
  // The source is seamless and repeated at a large physical scale so the hall reads as
  // one continuous floor instead of one stretched image or visible square tiles.
  // It is intentionally not user-configurable; the stand platform remains independent.
  const exhibitionHall = new THREE.Group();
  exhibitionHall.name = 'exhibition-hall-environment';

  const hallFloorTexture = new THREE.TextureLoader().load(
    import.meta.env.BASE_URL + 'textures/exhibition-floor-optimized.jpg',
    () => requestEditorRender(),
  );
  hallFloorTexture.colorSpace = THREE.SRGBColorSpace;
  hallFloorTexture.wrapS = THREE.RepeatWrapping;
  hallFloorTexture.wrapT = THREE.RepeatWrapping;
  hallFloorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const hallFloorMaterial = new THREE.MeshStandardMaterial({
    color: 0xa9abad,
    map: hallFloorTexture,
    roughness: 0.96,
    metalness: 0,
  });

  function rebuildExhibitionHall(standWidthM, standDepthM) {
    while (exhibitionHall.children.length) {
      const child = exhibitionHall.children.pop();
      child.geometry?.dispose?.();
    }

    // Keep the physical floor well beyond the fog end distance so its rectangular edge
    // never becomes visible while orbiting or zooming around the stand.
    const hallSizeM = Math.max(standWidthM, standDepthM, 20) + 180;
    // One texture repeat represents roughly an 8 m square of real floor.
    // Large repeats prevent the checkerboard look while preserving detail near the stand.
    const textureRepeat = Math.max(1, hallSizeM / 8);
    hallFloorTexture.repeat.set(textureRepeat, textureRepeat);
    hallFloorTexture.offset.set(0.173, 0.287);
    hallFloorTexture.needsUpdate = true;

    const hallFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(hallSizeM, hallSizeM),
      hallFloorMaterial,
    );
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.y = -0.014;
    hallFloor.receiveShadow = true;
    exhibitionHall.add(hallFloor);
  }

  scene.add(exhibitionHall);

  const outerFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: OUTER_FLOOR_COLOR, roughness: 0.94 }),
  );
  outerFloor.rotation.x = -Math.PI / 2;
  outerFloor.receiveShadow = true;
  outerFloor.visible = false;
  scene.add(outerFloor);

  const activeFloor = new THREE.Mesh(
    new THREE.BoxGeometry(1, ACTIVE_PLATFORM_HEIGHT_M, 1),
    new THREE.MeshStandardMaterial({ color: FLOOR_COLOR, roughness: 0.92 }),
  );
  activeFloor.receiveShadow = true;
  activeFloor.castShadow = true;
  activeFloor.visible = false;
  scene.add(activeFloor);

  // Lightweight procedural carpet texture: neutral fibers multiplied by the chosen
  // carpet color, plus a subtle bump map so grazing light reads as real textile.
  // Generated in-browser to avoid another heavy image asset or network request.
  function createCarpetTexturePair() {
    const size = 256;
    const colorCanvas = document.createElement('canvas');
    const bumpCanvas = document.createElement('canvas');
    colorCanvas.width = colorCanvas.height = size;
    bumpCanvas.width = bumpCanvas.height = size;

    const colorCtx = colorCanvas.getContext('2d');
    const bumpCtx = bumpCanvas.getContext('2d');
    const colorImage = colorCtx.createImageData(size, size);
    const bumpImage = bumpCtx.createImageData(size, size);

    // Deterministic pseudo-random field keeps the texture stable across rebuilds.
    let seed = 0x5f3759df;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0xffffffff;
    };

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4;
        const fine = (random() - 0.5) * 34;
        const fiber = Math.sin((x * 0.72) + (y * 0.18)) * 5;
        const value = Math.max(72, Math.min(184, 128 + fine + fiber));
        const bump = Math.max(88, Math.min(168, 128 + fine * 0.9 + fiber * 1.5));

        colorImage.data[i] = value;
        colorImage.data[i + 1] = value;
        colorImage.data[i + 2] = value;
        colorImage.data[i + 3] = 255;
        bumpImage.data[i] = bump;
        bumpImage.data[i + 1] = bump;
        bumpImage.data[i + 2] = bump;
        bumpImage.data[i + 3] = 255;
      }
    }

    colorCtx.putImageData(colorImage, 0, 0);
    bumpCtx.putImageData(bumpImage, 0, 0);

    const colorMap = new THREE.CanvasTexture(colorCanvas);
    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    [colorMap, bumpMap].forEach((texture) => {
      texture.wrapS = THREE.MirroredRepeatWrapping;
      texture.wrapT = THREE.MirroredRepeatWrapping;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;
    });
    colorMap.colorSpace = THREE.SRGBColorSpace;
    return { colorMap, bumpMap };
  }

  const carpetTextures = createCarpetTexturePair();

  let grid = null;
  let standFloorGrid = null;
  let standOutline = null;
  let activeWallGuides = [];
  let floorPattern = null;
  let stageLayout = null;
  let currentFloorType = getFloorItem('karolaj').itemKey;
  const floorColors = Object.fromEntries(
    listFloorItems()
      .filter((item) => item.paintable)
      .map((item) => [item.itemKey, item.defaultColor]),
  );
  let floorSelected = false;
  let floorAreaSelected = false;
  let floorAreaDrawArmed = false;
  // Tablet çoklu seçim modu: 'module' açıkken modüle dokunmak Shift + tık gibi toplu seçime
  // ekler/çıkarır; 'panel' tek seferlik parmak taramasıdır (Ctrl + tık dikdörtgeni gibi).
  let multiSelectMode = false;
  let onMultiSelectModeEnd = null;
  let panelSweep = null;
  let floorDrawSession = null;
  let floorAreaMesh = null;
  let floorAreaPattern = null;
  let floorAreaTextures = null;
  let floorAreaPreview = null;
  let currentFloorArea = null;
  let onFloorAreaDrawn = () => {};

  function disposeGroundObject(object) {
    if (!object) return;
    scene.remove(object);
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material?.dispose?.());
  }

  function disposeGroundGuides() {
    disposeGroundObject(grid);
    disposeStandFloorGrid();
    disposeGroundObject(standOutline);
    disposeGroundObject(floorPattern);
    activeWallGuides.forEach(disposeGroundObject);
    grid = null;
    standOutline = null;
    floorPattern = null;
    activeWallGuides = [];
  }

  function collectSurfaceCuts(lengthM, stepM) {
    const cuts = [0];
    for (let value = stepM; value < lengthM; value += stepM) cuts.push(value);
    cuts.push(lengthM);
    return [...new Set(cuts.map((value) => Number(value.toFixed(6))))];
  }

  function matchesConcreteParquetVisual(item) {
    const concrete = getFloorItem('parke-beton');
    return isParquetFloorItem(item)
      && Number(item.dimensions?.widthCm) === Number(concrete.dimensions.widthCm)
      && Number(item.dimensions?.depthCm) === Number(concrete.dimensions.depthCm);
  }

  function createFloorPattern(widthM, depthM, floorType, topY = ACTIVE_PLATFORM_HEIGHT_M + FLOOR_TOP_EPSILON_M) {
    const positions = [];
    const floorItem = getFloorItem(floorType);

    if (isGridTileFloorItem(floorItem)) {
      const stepM = Number(floorItem.dimensions.widthCm) / 100;
      collectSurfaceCuts(widthM, stepM).forEach((x) => {
        positions.push(x, topY, 0, x, topY, depthM);
      });
      collectSurfaceCuts(depthM, stepM).forEach((z) => {
        positions.push(0, topY, z, widthM, topY, z);
      });
    } else if (isParquetFloorItem(floorItem)) {
      const parquet = floorItem;
      const plankDepthM = Number(parquet.dimensions.depthCm) / 100;
      const plankLengthM = Number(parquet.dimensions.widthCm) / 100;
      collectSurfaceCuts(depthM, plankDepthM).forEach((z) => {
        positions.push(0, topY, z, widthM, topY, z);
      });
      let row = 0;
      for (let z = 0; z < depthM - 0.000001; z += plankDepthM, row += 1) {
        const rowEnd = Math.min(depthM, z + plankDepthM);
        const offset = (row % 3) * (plankLengthM / 3);
        for (let x = -offset; x < widthM; x += plankLengthM) {
          const seamX = x + plankLengthM;
          if (seamX <= 0.000001 || seamX >= widthM - 0.000001) continue;
          positions.push(seamX, topY, z, seamX, topY, rowEnd);
        }
      }
    }

    if (!positions.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const isConcreteParquetPattern = matchesConcreteParquetVisual(floorItem);
    const isParquetPattern = isParquetFloorItem(floorItem);
    const material = new THREE.LineBasicMaterial({
      // Beton parke derzleri sahne ışığından bağımsız, daha koyu ve net kalsın.
      color: isConcreteParquetPattern
        ? 0x3f3d39
        : (isParquetPattern ? 0x746f68 : 0x9aa0a6),
      transparent: true,
      opacity: isConcreteParquetPattern
        ? 0.62
        : (isParquetPattern ? 0.34 : 0.68),
      toneMapped: !isConcreteParquetPattern,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 8;
    return lines;
  }

  function configureFloorMaterial(material, floorItem, widthM, depthM, colorValue, texturePair, { repeat = false } = {}) {
    if (isCarpetFloorItem(floorItem)) {
      material.color.set(colorValue);
      material.roughness = 1;
      material.metalness = 0;
      material.emissive.set('#000000');
      material.emissiveIntensity = 0;
      material.map = texturePair.colorMap;
      material.bumpMap = texturePair.bumpMap;
      material.bumpScale = 0.018;
      if (repeat) {
        // Restore the earlier compact carpet-tile scale the editor used before the RIP pass.
        const repeatX = Math.max(2, widthM / 0.7);
        const repeatY = Math.max(2, depthM / 0.7);
        texturePair.colorMap.repeat.set(repeatX, repeatY);
        texturePair.bumpMap.repeat.set(repeatX, repeatY);
      }
    } else if (isParquetFloorItem(floorItem)) {
      material.map = null;
      material.bumpMap = null;
      material.bumpScale = 0;
      material.color.set(floorItem.defaultColor);
      material.roughness = matchesConcreteParquetVisual(floorItem) ? 0.98 : 0.78;
      material.metalness = 0;
      // Beton parke, güçlü sahne ışığında rengini yıkamadan daha mat ve dengeli kalsın.
      material.emissive.set(matchesConcreteParquetVisual(floorItem) ? floorItem.defaultColor : '#000000');
      material.emissiveIntensity = matchesConcreteParquetVisual(floorItem) ? 0.06 : 0;
    } else {
      material.color.set(colorValue);
      material.roughness = 0.92;
      material.metalness = 0;
      material.emissive.set('#000000');
      material.emissiveIntensity = 0;
      material.map = null;
      material.bumpMap = null;
      material.bumpScale = 0;
    }
    material.needsUpdate = true;
  }

  function cloneCarpetTexturePair() {
    const colorMap = carpetTextures.colorMap.clone();
    const bumpMap = carpetTextures.bumpMap.clone();
    colorMap.wrapS = THREE.MirroredRepeatWrapping;
    colorMap.wrapT = THREE.MirroredRepeatWrapping;
    bumpMap.wrapS = THREE.MirroredRepeatWrapping;
    bumpMap.wrapT = THREE.MirroredRepeatWrapping;
    colorMap.colorSpace = THREE.SRGBColorSpace;
    return { colorMap, bumpMap };
  }

  function disposeFloorAreaTextures() {
    floorAreaTextures?.colorMap?.dispose?.();
    floorAreaTextures?.bumpMap?.dispose?.();
    floorAreaTextures = null;
  }

  function clearFloorAreaPreview() {
    disposeGroundObject(floorAreaPreview);
    floorAreaPreview = null;
  }

  function clearFloorAreaVisual() {
    disposeGroundObject(floorAreaMesh);
    disposeGroundObject(floorAreaPattern);
    disposeFloorAreaTextures();
    floorAreaMesh = null;
    floorAreaPattern = null;
    floorAreaSelected = false;
  }

  function floorAreaColorValue(floorItem, area) {
    if (isParquetFloorItem(floorItem)) return floorItem.defaultColor;
    if (area?.color) return area.color;
    return floorItem.defaultColor;
  }

  function rebuildFloorAreaVisual() {
    requestEditorRender();
    const keepSelected = floorAreaSelected;
    clearFloorAreaVisual();
    if (!currentFloorArea || !stageLayout) return;
    const floorItem = getFloorItem(currentFloorArea.itemKey);
    if (!floorItem) return;
    const widthM = currentFloorArea.widthCm / 100;
    const depthM = currentFloorArea.depthCm / 100;
    const heightM = 0.002;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(widthM, heightM, depthM),
      new THREE.MeshStandardMaterial({ roughness: 0.92 }),
    );
    const patternY = ACTIVE_PLATFORM_HEIGHT_M + FLOOR_TOP_EPSILON_M;
    mesh.position.set(
      currentFloorArea.xCm / 100 + widthM / 2,
      patternY + 0.001 + heightM / 2,
      currentFloorArea.yCm / 100 + depthM / 2,
    );
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.userData.kind = 'floor-area';
    const texturePair = isCarpetFloorItem(floorItem) ? cloneCarpetTexturePair() : null;
    floorAreaTextures = texturePair;
    configureFloorMaterial(
      mesh.material,
      floorItem,
      widthM,
      depthM,
      floorAreaColorValue(floorItem, currentFloorArea),
      texturePair,
      { repeat: true },
    );
    scene.add(mesh);
    floorAreaMesh = mesh;
    const pattern = createFloorPattern(
      widthM,
      depthM,
      floorItem.itemKey,
      patternY + 0.001 + heightM + 0.002,
    );
    if (pattern) {
      pattern.position.set(currentFloorArea.xCm / 100, 0, currentFloorArea.yCm / 100);
      scene.add(pattern);
      floorAreaPattern = pattern;
    }
    if (keepSelected && floorAreaMesh) {
      floorAreaSelected = true;
      setFloorAreaHighlight(true);
    }
  }

  function updateFloorAreaPreview(area) {
    clearFloorAreaPreview();
    if (!area) return;
    const widthM = area.widthCm / 100;
    const depthM = area.depthCm / 100;
    const preview = new THREE.Mesh(
      new THREE.BoxGeometry(widthM, 0.004, depthM),
      new THREE.MeshBasicMaterial({
        color: SELECTION_COLOR,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    preview.position.set(
      area.xCm / 100 + widthM / 2,
      ACTIVE_PLATFORM_HEIGHT_M + 0.012,
      area.yCm / 100 + depthM / 2,
    );
    preview.raycast = () => {};
    scene.add(preview);
    floorAreaPreview = preview;
  }

  function setFloorType(floorType = getFloorItem('karolaj').itemKey) {
    requestEditorRender();
    const resolved = listFloorTypeKeys().includes(floorType) ? floorType : getFloorItem('karolaj').itemKey;
    currentFloorType = resolved;
    const floorItem = getFloorItem(resolved);
    const colorValue = isCarpetFloorItem(floorItem) ? floorColors.hali : floorColors.karolaj;
    configureFloorMaterial(
      activeFloor.material,
      floorItem,
      stageLayout?.widthM ?? 1,
      stageLayout?.depthM ?? 1,
      colorValue,
      carpetTextures,
      { repeat: Boolean(stageLayout) },
    );

    disposeGroundObject(floorPattern);
    floorPattern = null;
    if (stageLayout) {
      floorPattern = createFloorPattern(stageLayout.widthM, stageLayout.depthM, resolved);
      if (floorPattern) scene.add(floorPattern);
    }
    if (stageLayout) stageLayout.floorType = resolved;
    return resolved;
  }

  function setFloorColor(color) {
    requestEditorRender();
    if (!getFloorItem(currentFloorType)?.paintable) return null;
    const normalized = String(color ?? '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return floorColors[currentFloorType];
    const resolved = normalized.toLowerCase();
    floorColors[currentFloorType] = resolved;
    if (stageLayout) stageLayout.floorColor = resolved;
    activeFloor.material.color.set(resolved);
    activeFloor.material.needsUpdate = true;
    return resolved;
  }

  function collectGridValues(lengthM) {
    const values = [-SCENE_SURROUND_M, 0, lengthM, lengthM + SCENE_SURROUND_M];
    for (let value = 1; value < lengthM; value += 1) values.push(value);
    return [...new Set(values.map((value) => Number(value.toFixed(6))))]
      .sort((a, b) => a - b);
  }

  function createRectangularGrid(widthM, depthM) {
    const leftX = -SCENE_SURROUND_M;
    const rightX = widthM + SCENE_SURROUND_M;
    const backZ = -SCENE_SURROUND_M;
    const frontZ = depthM + SCENE_SURROUND_M;
    const positions = [];
    const boldOffsetM = 0.006;

    const pushVertical = (x) => {
      [-boldOffsetM, 0, boldOffsetM].forEach((offset) => {
        positions.push(x + offset, 0.006, backZ, x + offset, 0.006, frontZ);
      });
    };
    const pushHorizontal = (z) => {
      [-boldOffsetM, 0, boldOffsetM].forEach((offset) => {
        positions.push(leftX, 0.006, z + offset, rightX, 0.006, z + offset);
      });
    };

    collectGridValues(widthM).forEach(pushVertical);
    collectGridValues(depthM).forEach(pushHorizontal);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        color: GRID_COLOR,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    lines.renderOrder = 7;
    return lines;
  }

  function createStandOutline(widthM, depthM) {
    const positions = [
      0, ACTIVE_PLATFORM_HEIGHT_M + 0.008, 0, widthM, ACTIVE_PLATFORM_HEIGHT_M + 0.008, 0,
      widthM, ACTIVE_PLATFORM_HEIGHT_M + 0.008, 0, widthM, ACTIVE_PLATFORM_HEIGHT_M + 0.008, depthM,
      widthM, ACTIVE_PLATFORM_HEIGHT_M + 0.008, depthM, 0, ACTIVE_PLATFORM_HEIGHT_M + 0.008, depthM,
      0, ACTIVE_PLATFORM_HEIGHT_M + 0.008, depthM, 0, ACTIVE_PLATFORM_HEIGHT_M + 0.008, 0,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color: STAND_BORDER_COLOR }),
    );
  }

  // Stand zemini ızgarası: 1 m'de kalın, 50 cm'de ince çizgi, yalnız stand alanında. Yalnız
  // görüntüdür; öğe kendi taşıma adımıyla (10 cm) oturur. Yalnız yerleştirme önizlemesi
  // (katalog, kopya, taşıma) görünürken çizilir; bırakınca kaybolur.
  function createStandFloorGrid(widthM, depthM) {
    const y = ACTIVE_PLATFORM_HEIGHT_M + 0.014;
    const boldOffsetM = 0.006;
    const bold = [];
    const fine = [];
    const collect = (lengthM, push) => {
      const steps = Math.ceil(lengthM / STAND_GRID_FINE_STEP_M - 1e-6);
      for (let index = 1; index < steps; index += 1) {
        push(index * STAND_GRID_FINE_STEP_M, index % STAND_GRID_FINE_PER_BOLD === 0);
      }
    };
    collect(widthM, (x, isBold) => {
      if (!isBold) fine.push(x, y, 0, x, y, depthM);
      else [-boldOffsetM, 0, boldOffsetM].forEach((offset) => bold.push(x + offset, y, 0, x + offset, y, depthM));
    });
    collect(depthM, (z, isBold) => {
      if (!isBold) fine.push(0, y, z, widthM, y, z);
      else [-boldOffsetM, 0, boldOffsetM].forEach((offset) => bold.push(0, y, z + offset, widthM, y, z + offset));
    });
    const group = new THREE.Group();
    group.name = 'stand-floor-grid';
    [['bold', bold], ['fine', fine]].forEach(([weight, positions]) => {
      if (!positions.length) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
        color: STAND_GRID_COLOR,
        transparent: true,
        opacity: STAND_GRID_OPACITY[weight],
        depthWrite: false,
        toneMapped: false,
      }));
      lines.userData.gridWeight = weight;
      lines.renderOrder = 8;
      // Seçim/yerleştirme ışını ızgaraya takılmaz.
      lines.raycast = () => {};
      group.add(lines);
    });
    group.visible = false;
    return group;
  }

  function setStandFloorGridActive(active) {
    if (!standFloorGrid || standFloorGrid.visible === active) return;
    standFloorGrid.visible = active;
    requestEditorRender();
  }

  function disposeStandFloorGrid() {
    if (!standFloorGrid) return;
    scene.remove(standFloorGrid);
    standFloorGrid.children.forEach((lines) => {
      lines.geometry?.dispose?.();
      lines.material?.dispose?.();
    });
    standFloorGrid = null;
  }

  // Ölçü katmanı (yalnız görüntü, Render Al'a girmez):
  // - tek öğe seçiliyken taban alanı kesikli dikdörtgen + genişlik/derinlik/yükseklik etiketi;
  // - yerleştirme önizlemesi görünürken öğeden stand kenarlarına uzaklık çizgisi + metre etiketi.
  const measureGroup = new THREE.Group();
  measureGroup.name = 'measure-overlay';
  scene.add(measureGroup);
  let measureLabels = [];
  let measureSignature = '';

  function clearMeasureOverlay() {
    measureGroup.children.slice().forEach((child) => {
      measureGroup.remove(child);
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    });
    measureLabels.forEach(({ element }) => element.remove());
    measureLabels = [];
  }

  function addMeasureLine(points, color, dashed = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.04, depthTest: false, transparent: true })
      : new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
    const line = new THREE.Line(geometry, material);
    if (dashed) line.computeLineDistances();
    line.renderOrder = 30;
    line.raycast = () => {};
    measureGroup.add(line);
  }

  function addMeasureLabel(text, worldPoint, kind) {
    const element = document.createElement('div');
    element.className = `scene-measure-label is-${kind}`;
    element.dataset.measureKind = kind;
    element.textContent = text;
    element.style.cssText = [
      'position:fixed', 'z-index:30', 'pointer-events:none', 'transform:translate(-50%,-50%)',
      'padding:2px 6px', 'border-radius:4px', 'font:600 11px/1.3 system-ui,sans-serif', 'color:#fff',
      'white-space:nowrap', 'box-shadow:0 1px 3px rgba(15,23,42,.25)',
      `background:${kind === 'size' ? 'rgba(30,41,59,.88)' : 'rgba(37,99,235,.92)'}`,
    ].join(';');
    document.body.appendChild(element);
    measureLabels.push({ element, world: worldPoint.clone() });
  }

  function positionMeasureLabels() {
    if (!measureLabels.length) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const projected = new THREE.Vector3();
    measureLabels.forEach(({ element, world }) => {
      projected.copy(world).project(camera);
      const visible = projected.z > -1 && projected.z < 1 && rect.width > 0;
      element.style.display = visible ? '' : 'none';
      if (!visible) return;
      element.style.left = `${rect.left + ((projected.x + 1) / 2) * rect.width}px`;
      element.style.top = `${rect.top + ((1 - projected.y) / 2) * rect.height}px`;
    });
  }

  function formatMeasureCm(meters) {
    return `${Math.round(meters * 100)} cm`;
  }

  function formatMeasureM(meters) {
    return `${meters.toFixed(2)} m`;
  }

  // Etiketlerdeki ölçü öğenin sahne ölçüsüdür (state widthCm/depthCm/heightCm =
  // resolveSceneDimensions); kutu yalnız konum içindir. 90/270° dönüşte en ve derinlik eksen değiştirir.
  function sceneSizeCm(moduleState, box) {
    const widthCm = Number(moduleState?.widthCm);
    const depthCm = Number(moduleState?.depthCm);
    const heightCm = Number(moduleState?.heightCm);
    const vertical = isVerticalModuleRotation(moduleState?.placement?.rotationZDeg ?? 0);
    const fallback = (meters) => Math.round(meters * 100);
    const alongX = vertical ? depthCm : widthCm;
    const alongZ = vertical ? widthCm : depthCm;
    return {
      xCm: alongX > 0 ? alongX : fallback(box.max.x - box.min.x),
      zCm: alongZ > 0 ? alongZ : fallback(box.max.z - box.min.z),
      yCm: heightCm > 0 ? heightCm : fallback(box.max.y - box.min.y),
    };
  }

  function formatSceneCm(valueCm) {
    return `${Math.round(Number(valueCm) * 10) / 10} cm`.replace('.', ',');
  }

  function measureFootprint(box, moduleState) {
    const y = ACTIVE_PLATFORM_HEIGHT_M + 0.02;
    const { min, max } = box;
    const size = sceneSizeCm(moduleState, box);
    const corners = [
      new THREE.Vector3(min.x, y, min.z), new THREE.Vector3(max.x, y, min.z),
      new THREE.Vector3(max.x, y, max.z), new THREE.Vector3(min.x, y, max.z),
    ];
    addMeasureLine([...corners, corners[0]], MEASURE_FOOTPRINT_COLOR, true);
    addMeasureLabel(formatSceneCm(size.xCm), new THREE.Vector3((min.x + max.x) / 2, y, max.z + 0.12), 'size');
    addMeasureLabel(formatSceneCm(size.zCm), new THREE.Vector3(max.x + 0.16, y, (min.z + max.z) / 2), 'size');
    addMeasureLabel(formatSceneCm(size.yCm), new THREE.Vector3((min.x + max.x) / 2, max.y + 0.08, (min.z + max.z) / 2), 'size');
  }

  // Dikey hareket eden öğe (DB vertical_move): altından zemine, üstünden duvar tepesine.
  function measureFloorCeiling(box) {
    const floorY = ACTIVE_PLATFORM_HEIGHT_M;
    const ceilingY = floorY + getActiveWallLineHeightCm() / 100;
    const x = box.max.x + 0.06;
    const z = box.max.z;
    [
      [new THREE.Vector3(x, box.min.y, z), new THREE.Vector3(x, floorY, z)],
      [new THREE.Vector3(x, box.max.y, z), new THREE.Vector3(x, ceilingY, z)],
    ].forEach(([from, to]) => {
      const distanceM = Math.abs(from.y - to.y);
      if (distanceM < MEASURE_MIN_DISTANCE_M) return;
      addMeasureLine([from, to], MEASURE_DISTANCE_COLOR);
      addMeasureLabel(formatMeasureM(distanceM), from.clone().lerp(to, 0.5), 'height');
    });
  }

  function measureStandDistances(box) {
    if (!stageLayout) return;
    const y = ACTIVE_PLATFORM_HEIGHT_M + 0.02;
    const centerX = (box.min.x + box.max.x) / 2;
    const centerZ = (box.min.z + box.max.z) / 2;
    const spans = [
      [new THREE.Vector3(box.min.x, y, centerZ), new THREE.Vector3(0, y, centerZ)],
      [new THREE.Vector3(box.max.x, y, centerZ), new THREE.Vector3(stageLayout.widthM, y, centerZ)],
      [new THREE.Vector3(centerX, y, box.min.z), new THREE.Vector3(centerX, y, 0)],
      [new THREE.Vector3(centerX, y, box.max.z), new THREE.Vector3(centerX, y, stageLayout.depthM)],
    ];
    spans.forEach(([from, to]) => {
      const distanceM = from.distanceTo(to);
      if (distanceM < MEASURE_MIN_DISTANCE_M) return;
      addMeasureLine([from, to], MEASURE_DISTANCE_COLOR);
      addMeasureLabel(formatMeasureM(distanceM), from.clone().lerp(to, 0.5), 'distance');
    });
  }

  // Öğenin kayıtlı ölçü kutusu (seçim çerçevesinden, payı düşülmüş). Çizimin dış kutusu
  // kullanılmaz: panel yüzü gövdenin 1,5 cm önünde durur ve ölçüyü büyütür.
  function measureModuleBox(moduleGroup) {
    const frame = moduleGroup ? ensureModuleSelectionFrame(moduleGroup) : null;
    if (!frame) return null;
    // Üst grubun matrisi de güncellenir: ok tuşuyla taşıma çizimden önce okunur.
    frame.updateWorldMatrix(true, true);
    return new THREE.Box3().setFromObject(frame).expandByScalar(-(frame.userData.paddingM ?? 0) / 2);
  }

  function syncMeasureOverlay() {
    const ghostVisible = Boolean(placementGhost?.root?.visible);
    let box = null;
    let mode = '';
    let moduleState = null;
    if (ghostVisible && stageLayout) {
      placementGhost.root.updateMatrixWorld(true);
      box = measureModuleBox(placementGhost.root) ?? new THREE.Box3().setFromObject(placementGhost.root);
      mode = 'distance';
      moduleState = placementGhost.moduleState ?? null;
    } else if (!multiSelectedModuleIds.size && selectedModuleId) {
      const moduleGroup = findModuleGroupById(selectedModuleId);
      box = moduleGroup?.visible ? measureModuleBox(moduleGroup) : null;
      if (box) mode = 'footprint';
      moduleState = moduleGroup?.userData?.moduleState ?? null;
    }
    const vertical = Boolean(box && moduleState && itemMovesVertically(moduleState));
    const signature = box && !box.isEmpty()
      ? `${mode}|${vertical}|${getActiveWallLineHeightCm()}|${[box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map((value) => value.toFixed(3)).join(',')}|${moduleState?.widthCm}|${moduleState?.depthCm}|${moduleState?.heightCm}`
      : '';
    if (signature !== measureSignature) {
      measureSignature = signature;
      clearMeasureOverlay();
      if (signature && mode === 'footprint') measureFootprint(box, moduleState);
      if (signature && mode === 'distance') measureStandDistances(box);
      if (signature && vertical) measureFloorCeiling(box);
    }
    positionMeasureLabels();
  }

  function createActiveWallGuides(standType, widthM, depthM) {
    const wallIds = getAllowedWallIds(standType).filter(
      (wallId) => wallId === 'back' || wallId === 'left' || wallId === 'right',
    );

    return wallIds.map((wallId) => {
      const alongX = wallId === 'back';
      const lengthM = alongX ? widthM : depthM;
      const guide = new THREE.Mesh(
        new THREE.BoxGeometry(
          alongX ? lengthM : ACTIVE_WALL_GUIDE_THICKNESS_M,
          ACTIVE_WALL_GUIDE_HEIGHT_M,
          alongX ? ACTIVE_WALL_GUIDE_THICKNESS_M : lengthM,
        ),
        new THREE.MeshBasicMaterial({
          color: ACTIVE_WALL_GUIDE_COLOR,
          depthWrite: false,
          toneMapped: false,
        }),
      );

      if (wallId === 'back') {
        guide.position.set(widthM / 2, ACTIVE_PLATFORM_HEIGHT_M + 0.02, 0);
      } else if (wallId === 'left') {
        guide.position.set(0, ACTIVE_PLATFORM_HEIGHT_M + 0.02, depthM / 2);
      } else {
        guide.position.set(widthM, ACTIVE_PLATFORM_HEIGHT_M + 0.02, depthM / 2);
      }

      guide.renderOrder = 20;
      return guide;
    });
  }

  function createStage({ widthCm, depthCm, standType = null, resetView = true } = {}) {
    requestEditorRender();
    const widthM = Number(widthCm) / 100;
    const depthM = Number(depthCm) / 100;
    if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) {
      return { ok: false, message: 'Geçerli bir X ve Y ölçüsü gerekli.' };
    }

    updateStageFog(widthM, depthM);
    aimKeyLightAtStand(widthM, depthM);

    disposeWall();
    disposeGroundGuides();
    clearFloorAreaVisual();
    clearFloorAreaPreview();
    currentFloorArea = null;
    floorDrawSession = null;
    clearPlacementDrag();

    const sceneWidthM = widthM + SCENE_SURROUND_M * 2;
    const sceneDepthM = depthM + SCENE_SURROUND_M * 2;
    const centerX = widthM / 2;
    const centerZ = depthM / 2;

    // Rebuild the venue around the current stand so large layouts keep realistic clearance.
    rebuildExhibitionHall(widthM, depthM);
    exhibitionHall.position.set(centerX, 0, centerZ);

    outerFloor.scale.set(sceneWidthM, sceneDepthM, 1);
    outerFloor.position.set(centerX, 0, centerZ);
    outerFloor.visible = false;

    activeFloor.scale.set(widthM, 1, depthM);
    activeFloor.position.set(centerX, ACTIVE_PLATFORM_HEIGHT_M / 2, centerZ);
    activeFloor.visible = true;

    grid = createRectangularGrid(widthM, depthM);
    standFloorGrid = createStandFloorGrid(widthM, depthM);
    standOutline = createStandOutline(widthM, depthM);
    activeWallGuides = createActiveWallGuides(standType, widthM, depthM);
    scene.add(grid, standFloorGrid, standOutline, ...activeWallGuides);

    stageLayout = {
      standType,
      widthM,
      depthM,
      widthCm: Math.round(widthM * 100),
      depthCm: Math.round(depthM * 100),
      sceneWidthM,
      sceneDepthM,
      surroundM: SCENE_SURROUND_M,
      platformHeightM: ACTIVE_PLATFORM_HEIGHT_M,
      floorType: currentFloorType,
      floorColor: floorColors[currentFloorType] ?? null,
    };

    setFloorType(currentFloorType);
    if (resetView) resetStageView();
    return { ok: true, ...stageLayout };
  }

  const wallRoot = new THREE.Group();
  // Duvarlar ve tüm stand modülleri platformun üst kotundan başlar.
  wallRoot.position.set(0, ACTIVE_PLATFORM_HEIGHT_M, 0);
  scene.add(wallRoot);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // Shared loader for normal editable surface images. TV uses its own Blob/object-URL path.
  // Sayılır: proje açılış ölçümü bütün yüzey görselleri gelince "sahne tamamen hazır" der.
  const textureLoader = trackSceneTextureLoader(new THREE.TextureLoader());
  
  let surfaceMeshes = [];
  let fabricOverlayMeshes = [];
  const selectedSurfaces = new Set();
  let selectionAnchorSurfaceId = null;
  let selectedModuleId = null;
  // Shift+tık toplu seçimi (kalıcı değil): toplu kilitleme gibi çok öğeli işlemler içindir.
  const multiSelectedModuleIds = new Set();
  let placementGhost = null;
  let dragSession = null;
  let keyboardRotationCursor = null;
  let dragBadge = null;
  let placementFeedback = null;
  let placementFeedbackTimer = null;
  // Structural wall rebuilds (insert/delete/reorder) reuse the already uploaded GPU
  // textures. This prevents branded panels from flashing blank while TextureLoader
  // reloads the same assets after every catalog operation. Keys prefer the persistent
  // surface-state object, so inserting a module before another does not depend on index.
  let rebuildTextureTransfer = null;

  function getRebuildTextureKey(mesh) {
    return mesh?.userData?.surfaceId
      ?? mesh?.userData?.persistentSurfaceState?.id
      ?? null;
  }

  function syncRendererCopies(persistent) {
    if (!persistent) return;
    surfaceMeshes.forEach((mesh) => {
      if (mesh?.userData?.persistentSurfaceState !== persistent) return;
      if (!mesh.userData.surfaceState) {
        mesh.userData.surfaceState = cloneSurfaceStateForRenderer(persistent);
        return;
      }
      syncRendererSurfaceState(mesh.userData.surfaceState, persistent);
    });
  }

  function writePersistentSurface(mesh, mutator) {
    const persistent = mesh?.userData?.persistentSurfaceState;
    if (!persistent) {
      if (mesh?.userData?.surfaceState) {
        throw new TypeError('Kalıcı yüzey durumu bağlanmamış.');
      }
      return null;
    }
    mutator(persistent);
    syncRendererCopies(persistent);
    return persistent;
  }

  function retainWallTexturesForRebuild() {
    const retained = new Map();
    surfaceMeshes.forEach((surface) => {
      const texture = surface?.material?.map;
      const key = getRebuildTextureKey(surface);
      if (!texture || !key || texture.userData?.metalSeparator) return;
      retained.set(key, texture);
      // disposeWall() owns the old materials. Detach maps first so disposing the old
      // material does not also destroy a texture that the replacement mesh will reuse.
      surface.material.map = null;
    });
    rebuildTextureTransfer = retained;
  }

  function disposeUnusedRebuildTextures() {
    if (!rebuildTextureTransfer) return;
    rebuildTextureTransfer.forEach((texture) => texture?.dispose?.());
    rebuildTextureTransfer = null;
  }

  function clearPlacementFeedback() {
    if (placementFeedbackTimer) {
      window.clearTimeout(placementFeedbackTimer);
      placementFeedbackTimer = null;
    }
    placementFeedback?.remove?.();
    placementFeedback = null;
  }

  function showPlacementFeedback(message, { clientX = null, clientY = null, durationMs = 1800 } = {}) {
    const text = formatPlacementFeedbackMessage(message);
    if (!text) {
      clearPlacementFeedback();
      return;
    }

    if (placementFeedbackTimer) {
      window.clearTimeout(placementFeedbackTimer);
      placementFeedbackTimer = null;
    }

    if (!placementFeedback) {
      placementFeedback = document.createElement('div');
      placementFeedback.style.cssText = [
        'position:fixed',
        'z-index:10002',
        'max-width:320px',
        'padding:8px 11px',
        'border:1px solid rgba(220,38,38,.35)',
        'border-radius:9px',
        'background:rgba(127,29,29,.94)',
        'box-shadow:0 8px 24px rgba(15,23,42,.2)',
        'color:#fff',
        'font:600 12px/1.35 system-ui,sans-serif',
        'pointer-events:none',
        'user-select:none',
      ].join(';');
      document.body.appendChild(placementFeedback);
    }

    placementFeedback.textContent = text;
    const rect = renderer.domElement.getBoundingClientRect();
    const hasPointer = hasPlacementFeedbackPointer(clientX, clientY);
    const rawX = hasPointer ? Number(clientX) + 18 : rect.left + rect.width / 2;
    const rawY = hasPointer ? Number(clientY) + 18 : rect.top + 72;
    const x = Math.min(window.innerWidth - 20, Math.max(20, rawX));
    const y = Math.min(window.innerHeight - 52, Math.max(12, rawY));
    placementFeedback.style.left = `${x}px`;
    placementFeedback.style.top = `${y}px`;
    placementFeedback.style.transform = hasPointer ? 'none' : 'translateX(-50%)';

    if (durationMs > 0) {
      placementFeedbackTimer = window.setTimeout(() => {
        clearPlacementFeedback();
      }, durationMs);
    }
  }

  function findModuleGroupById(moduleId) {
    if (!moduleId) return null;
    let found = null;
    wallRoot.traverse((object) => {
      if (!found && object.userData?.kind === 'module' && object.userData?.moduleId === moduleId) {
        found = object;
      }
    });
    return found;
  }

  /** Modül grubunun kendi (yerel) koordinatlarında görünen mesh'lerinin kutusu. */
  function computeModuleLocalBounds(moduleGroup) {
    moduleGroup.updateMatrixWorld(true);
    const toLocal = new THREE.Matrix4().copy(moduleGroup.matrixWorld).invert();
    const bounds = new THREE.Box3();
    const meshBounds = new THREE.Box3();
    const meshToLocal = new THREE.Matrix4();
    moduleGroup.traverse((object) => {
      if (!object.isMesh || !object.geometry || object.userData?.isModuleSelectionVisual) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      meshBounds.copy(object.geometry.boundingBox).applyMatrix4(meshToLocal.multiplyMatrices(toLocal, object.matrixWorld));
      bounds.union(meshBounds);
    });
    return bounds.isEmpty() ? null : bounds;
  }

  function ensureModuleSelectionFrame(moduleGroup) {
    if (!moduleGroup) return null;
    if (moduleGroup.userData?.moduleSelectionFrame) return moduleGroup.userData.moduleSelectionFrame;

    const selectionBounds = moduleGroup.userData?.selectionBounds ?? null;
    let widthM = Number(selectionBounds?.widthM ?? (Number(moduleGroup.userData?.widthCm) / 100));
    let depthM = Number(selectionBounds?.depthM ?? (Number(moduleGroup.userData?.depthCm) / 100));
    let heightM = Number(selectionBounds?.heightM ?? (Number(moduleGroup.userData?.heightCm) / 100));
    let centerX = Number(selectionBounds?.centerX);
    let centerY = Number(selectionBounds?.centerY);
    let centerZ = Number(selectionBounds?.centerZ);
    // Ölçüsü kayıtlı olmayan öğelerde (panel, lamba, TV…) çerçeve görünen 3B şeklinden
    // hesaplanır; yoksa Shift+tık toplu seçimde bu öğeler işaretsiz kalıyordu.
    if (!(widthM > 0) || !(depthM > 0) || !(heightM > 0)) {
      const local = computeModuleLocalBounds(moduleGroup);
      if (!local) return null;
      const size = local.getSize(new THREE.Vector3());
      const center = local.getCenter(new THREE.Vector3());
      widthM = Math.max(size.x, 0.01);
      heightM = Math.max(size.y, 0.01);
      depthM = Math.max(size.z, 0.01);
      centerX = center.x;
      centerY = center.y;
      centerZ = center.z;
    }

    const paddingM = 0.02;
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(
        widthM + paddingM,
        heightM + paddingM,
        depthM + paddingM,
      )),
      new THREE.LineBasicMaterial({
        color: SELECTION_COLOR,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        toneMapped: false,
      }),
    );
    frame.position.set(
      Number.isFinite(centerX) ? centerX : 0,
      Number.isFinite(centerY) ? centerY : heightM / 2,
      Number.isFinite(centerZ) ? centerZ : 0,
    );
    frame.renderOrder = 1000;
    frame.visible = false;
    frame.userData.paddingM = paddingM;
    // Seçim görselleri yalnızca göstergedir; asla tıklama hedefi olmamalı.
    frame.raycast = () => {};
    frame.userData.isModuleSelectionVisual = true;
    moduleGroup.add(frame);
    moduleGroup.userData.moduleSelectionFrame = frame;
    return frame;
  }

  function setModuleSelectionVisual(moduleId, selected, color = SELECTION_COLOR) {
    const moduleGroup = findModuleGroupById(moduleId);
    if (!moduleGroup) return;
    const frame = selected
      ? ensureModuleSelectionFrame(moduleGroup)
      : moduleGroup.userData?.moduleSelectionFrame;
    if (!frame) return;
    if (selected) frame.material?.color?.setHex(color);
    frame.visible = Boolean(selected);
    // Shift+tık yalnız bunu günceller; render istenmezse çerçeve bir sonraki
    // kamera/tık çizimine kadar görünmez kalıyordu.
    requestEditorRender();
  }

  function setSelectionVisual(mesh, selected) {
    requestEditorRender();
    if (!mesh) return;
    const frame = mesh.userData.selectionFrame;
    if (frame) frame.visible = selected;
    if (!frame && mesh.userData?.selectionMode === 'module') {
      setModuleSelectionVisual(mesh.userData?.moduleId, selected);
    }
    if (mesh.material?.emissive) {
      mesh.material.emissive.setHex(selected ? SELECTION_COLOR : 0x000000);
      mesh.material.emissiveIntensity = selected ? 0.08 : 0;
    }
  }

  // Gruptaki bir öğe seçiliyken grubun diğer üyelerinde modül çerçevesi görünür.
  let groupHighlightIds = new Set();

  function refreshGroupHighlight() {
    const next = new Set();
    if (!multiSelectedModuleIds.size) {
      const selectedState = getSingleSelectedModuleGroup()?.userData?.moduleState;
      const groupId = getModuleGroupId(selectedState);
      if (groupId) {
        getGroupMembers(getRenderedModuleStates(), groupId).forEach((member) => {
          if (member.id !== selectedState.id) next.add(member.id);
        });
      }
    }
    groupHighlightIds.forEach((moduleId) => {
      if (!next.has(moduleId) && !multiSelectedModuleIds.has(moduleId) && moduleId !== selectedModuleId) {
        setModuleSelectionVisual(moduleId, false);
      }
    });
    next.forEach((moduleId) => setModuleSelectionVisual(moduleId, true, GROUP_SELECTION_COLOR));
    groupHighlightIds = next;
  }

  function notifySelection() {
    refreshGroupHighlight();
    onSurfaceSelected?.([...selectedSurfaces], getSelectedModuleIds());
  }

  /** Panelden: verilen öğeleri seçer (bir tane ise tek seçim, fazlası toplu seçim). */
  function selectModulesById(moduleIds = []) {
    const ids = moduleIds.filter((moduleId) => findModuleGroupById(moduleId));
    if (ids.length <= 1) {
      if (ids.length) selectModuleOnly(ids[0]);
      else clearSelection();
      return ids.length;
    }
    clearSelection({ notify: false });
    ids.forEach((moduleId) => multiSelectedModuleIds.add(moduleId));
    multiSelectedModuleIds.forEach((moduleId) => setModuleSelectionVisual(moduleId, true, GROUP_SELECTION_COLOR));
    notifySelection();
    return ids.length;
  }

  function setFloorAreaHighlight(selected) {
    if (!floorAreaMesh || !currentFloorArea) return;
    const floorItem = getFloorItem(currentFloorArea.itemKey);
    if (!floorItem) return;
    if (!selected) {
      configureFloorMaterial(
        floorAreaMesh.material,
        floorItem,
        currentFloorArea.widthCm / 100,
        currentFloorArea.depthCm / 100,
        floorAreaColorValue(floorItem, currentFloorArea),
        floorAreaTextures,
        { repeat: true },
      );
      return;
    }
    floorAreaMesh.material.emissive.setHex(SELECTION_COLOR);
    floorAreaMesh.material.emissiveIntensity = 0.12;
    floorAreaMesh.material.needsUpdate = true;
  }

  function notifyFloorSelection() {
    onFloorSelected?.({
      selected: floorSelected,
      target: 'base',
      floorType: currentFloorType,
      paintable: Boolean(getFloorItem(currentFloorType)?.paintable),
      color: floorColors[currentFloorType] ?? null,
    });
  }

  function notifyFloorAreaSelection() {
    const floorItem = getFloorItem(currentFloorArea?.itemKey);
    onFloorSelected?.({
      selected: floorAreaSelected,
      target: 'area',
      floorType: currentFloorArea?.itemKey ?? null,
      paintable: Boolean(floorItem?.paintable),
      color: currentFloorArea?.color ?? floorItem?.defaultColor ?? null,
    });
  }

  function clearMultiModuleSelection() {
    multiSelectedModuleIds.forEach((moduleId) => setModuleSelectionVisual(moduleId, false));
    multiSelectedModuleIds.clear();
  }

  // Shift+tık: modülü toplu seçime ekler ya da çıkarır. Mevcut tek seçim varsa
  // ilk Shift+tıkta toplu seçime taşınır; böylece tık + Shift+tık iki öğe seçer.
  function toggleMultiModuleSelection(moduleId) {
    if (!moduleId) return;
    const singleModuleId = getSingleSelectedModuleGroup()?.userData?.moduleState?.id ?? null;
    if (!multiSelectedModuleIds.size && singleModuleId && singleModuleId !== moduleId) {
      multiSelectedModuleIds.add(singleModuleId);
    }
    selectedSurfaces.forEach((mesh) => setSelectionVisual(mesh, false));
    selectedSurfaces.clear();
    selectionAnchorSurfaceId = null;
    floorSelected = false;
    floorAreaSelected = false;
    setFloorAreaHighlight(false);
    if (multiSelectedModuleIds.has(moduleId)) {
      multiSelectedModuleIds.delete(moduleId);
      setModuleSelectionVisual(moduleId, false);
    } else {
      multiSelectedModuleIds.add(moduleId);
    }
    multiSelectedModuleIds.forEach((id) => setModuleSelectionVisual(id, true, GROUP_SELECTION_COLOR));
    selectedModuleId = multiSelectedModuleIds.size === 1 ? [...multiSelectedModuleIds][0] : null;
    notifySelection();
  }

  /** Seçili modül kimlikleri: toplu seçim varsa onlar, yoksa tek seçim. */
  function getSelectedModuleIds() {
    if (multiSelectedModuleIds.size) return [...multiSelectedModuleIds];
    const single = getSingleSelectedModuleGroup()?.userData?.moduleState?.id ?? null;
    return single ? [single] : [];
  }

  function clearSelection({ notify = true, keepAnchor = false } = {}) {
    clearMultiModuleSelection();
    setModuleSelectionVisual(selectedModuleId, false);
    selectedSurfaces.forEach((mesh) => setSelectionVisual(mesh, false));
    selectedSurfaces.clear();
    selectedModuleId = null;
    floorSelected = false;
    floorAreaSelected = false;
    setFloorAreaHighlight(false);
    if (!keepAnchor) selectionAnchorSurfaceId = null;
    if (notify) notifySelection();
  }

  function selectOnly(mesh) {
    clearSelection({ notify: false });
    if (mesh) {
      selectedSurfaces.add(mesh);
      selectedModuleId = mesh.userData.moduleId ?? null;
      selectionAnchorSurfaceId = mesh.userData.surfaceId ?? null;
      setSelectionVisual(mesh, true);
    }
    notifySelection();
  }

  function selectModuleOnly(moduleId) {
    clearMultiModuleSelection();
    setModuleSelectionVisual(selectedModuleId, false);
    selectedSurfaces.forEach((mesh) => setSelectionVisual(mesh, false));
    selectedSurfaces.clear();
    selectionAnchorSurfaceId = null;
    floorSelected = false;
    floorAreaSelected = false;
    setFloorAreaHighlight(false);
    selectedModuleId = moduleId ?? null;
    setModuleSelectionVisual(selectedModuleId, true);
    notifySelection();
  }

  function toggleCounterSurface(mesh) {
    if (!mesh || mesh.userData?.moduleType !== 'counter') return false;

    const moduleId = mesh.userData.moduleId ?? null;
    const hasForeignSelection = [...selectedSurfaces].some(
      (surface) => surface.userData?.moduleType !== 'counter'
        || surface.userData?.moduleId !== moduleId,
    );

    if (hasForeignSelection) clearSelection({ notify: false });

    if (selectedSurfaces.has(mesh)) {
      selectedSurfaces.delete(mesh);
      setSelectionVisual(mesh, false);
    } else {
      selectedSurfaces.add(mesh);
      setSelectionVisual(mesh, true);
    }

    floorSelected = false;
    selectedModuleId = selectedSurfaces.size ? moduleId : null;
    selectionAnchorSurfaceId = [...selectedSurfaces][0]?.userData.surfaceId ?? null;
    notifySelection();
    return true;
  }

  function getSurfaceSelectionPlaneMeta(surface) {
    if (!surface || surface.userData?.selectionMode !== 'panel') return null;
    const moduleGroup = findModuleGroup(surface);
    const moduleState = moduleGroup?.userData?.moduleState;
    const placement = moduleState?.placement ?? moduleGroup?.userData?.placement;
    const wallId = placement?.wallId ?? null;
    const moduleId = surface.userData.moduleId ?? moduleState?.id ?? null;

    if (['back', 'left', 'right'].includes(wallId)) {
      const pathCm = wallId === 'back'
        ? Number(placement.xCm)
        : Number(placement.yCm);
      const crossCm = wallId === 'back'
        ? Number(placement.yCm)
        : Number(placement.xCm);
      const axis = wallId === 'back' ? 'x' : 'y';
      const widthCm = Number(moduleState?.widthCm ?? surface.userData.widthCm);
      if (![pathCm, crossCm, widthCm].every(Number.isFinite) || widthCm <= 0) return null;
      return {
        wallId,
        planeKey: `wall:${wallId}${surface.userData.panelSide === 'back' ? ':back' : ''}`,
        pathCm,
        axis,
        crossCm,
        startCm: pathCm,
        endCm: pathCm + widthCm,
        moduleId,
      };
    }

    // Ön/serbest sıradaki modüller placement.wallId === 'free' olur. Aynı
    // fiziksel doğrultu ve aynı çapraz koordinattaki modülleri tek seçim
    // düzlemi say; başka bir serbest sıraya Ctrl seçiminin taşmasını engelle.
    if (wallId !== 'free') return null;
    const xCm = Number(placement.xCm);
    const yCm = Number(placement.yCm);
    if (!Number.isFinite(xCm) || !Number.isFinite(yCm)) return null;

    const rotationZDeg = normalizeModuleRotationZDeg(placement.rotationZDeg);
    const vertical = isVerticalModuleRotation(rotationZDeg);
    const pathCm = vertical ? yCm : xCm;
    const crossCm = vertical ? xCm : yCm;
    const axis = vertical ? 'y' : 'x';
    const widthCm = Number(moduleState?.widthCm ?? surface.userData.widthCm);
    if (!Number.isFinite(widthCm) || widthCm <= 0) return null;
    const quantizedCrossCm = Math.round(crossCm * 10) / 10;

    return {
      wallId,
      planeKey: `free:${axis}:${quantizedCrossCm}${surface.userData.panelSide === 'back' ? ':back' : ''}`,
      pathCm,
      axis,
      crossCm,
      startCm: pathCm,
      endCm: pathCm + widthCm,
      moduleId,
    };
  }

  function selectRectangleTo(mesh) {
    if (!mesh) return;

    const anchorMesh = surfaceMeshes.find(
      (surface) => surface.userData.surfaceId === selectionAnchorSurfaceId,
    ) ?? [...selectedSurfaces][0] ?? mesh;
    // Ön ve arka yüz panelleri ayrı seçim düzlemidir; aralık yalnız çapanın yüzünde kurulur.
    const anchorSide = anchorMesh.userData.panelSide ?? 'front';
    const isAnchorSidePanel = (surface) => surface.userData.selectionMode === 'panel'
      && (surface.userData.panelSide ?? 'front') === anchorSide;

    if (!selectionAnchorSurfaceId) {
      selectionAnchorSurfaceId = anchorMesh.userData.surfaceId ?? null;
    }

    const anchorModuleId = anchorMesh.userData.moduleId ?? null;
    const targetModuleId = mesh.userData.moduleId ?? null;

    // Aynı modül içindeki gerçek panel aralığı duvar placement hesabına bağlı değildir.
    // Kapının üst 3 paneli (strip 4-6), raf modülü ve diğer panel taşıyan modüller
    // kendi içlerinde doğrudan dikey Ctrl/Cmd aralık seçimine izin verir.
    if (anchorModuleId && anchorModuleId === targetModuleId) {
      const modulePanels = surfaceMeshes
        .filter((surface) => (
          isAnchorSidePanel(surface)
          && surface.userData.moduleId === anchorModuleId
          && Number.isInteger(Number(surface.userData.stripIndex))
        ))
        .map((surface) => ({
          mesh: surface,
          moduleIndex: 0,
          stripIndex: Number(surface.userData.stripIndex),
        }));
      const sameModuleResult = createPanelRangeSelection(
        modulePanels,
        { moduleIndex: 0, stripIndex: Number(anchorMesh.userData.stripIndex) },
        { moduleIndex: 0, stripIndex: Number(mesh.userData.stripIndex) },
      );
      if (!sameModuleResult.ok) return;

      clearSelection({ notify: false, keepAnchor: true });
      sameModuleResult.entries.forEach((entry) => {
        selectedSurfaces.add(entry.mesh);
        setSelectionVisual(entry.mesh, true);
      });
      selectedModuleId = anchorModuleId;
      notifySelection();
      return;
    }

    const anchorMeta = getSurfaceSelectionPlaneMeta(anchorMesh);
    const targetMeta = getSurfaceSelectionPlaneMeta(mesh);
    if (!anchorMeta || !targetMeta) return;

    // Aynı fiziksel düzlemde bugünkü plane-aware seçim korunur. İki uç farklı
    // stand duvarlarındaysa eski duvar-zinciri dikdörtgen seçimini kullan: örneğin
    // sol üst + arka duvarda üstten ikinci panel, aradaki 2 x N panel bloğunu seçer.
    // Serbest ön sıralar bu fallback'e girmez; yalnızca gerçek stand duvarları girer.
    if (anchorMeta.planeKey !== targetMeta.planeKey) {
      if (anchorMeta.wallId === 'free' || targetMeta.wallId === 'free') {
        const freeModuleMeta = [...new Map(
          surfaceMeshes
            .filter((surface) => isAnchorSidePanel(surface))
            .map((surface) => getSurfaceSelectionPlaneMeta(surface))
            .filter((meta) => meta?.moduleId && (meta.axis === 'x' || meta.axis === 'y'))
            .map((meta) => [meta.moduleId, meta]),
        ).values()];
        const freePath = createConnectedPanelModulePath(
          freeModuleMeta,
          anchorMeta.moduleId,
          targetMeta.moduleId,
        );
        if (!freePath.ok) return;

        const columnByModuleId = new Map(
          freePath.moduleIds.map((moduleId, index) => [moduleId, index]),
        );
        const freePathSet = new Set(freePath.moduleIds);
        const freePathPanels = surfaceMeshes
          .filter((surface) => (
            isAnchorSidePanel(surface)
            && freePathSet.has(surface.userData.moduleId)
          ))
          .map((surface) => ({
            mesh: surface,
            moduleIndex: columnByModuleId.get(surface.userData.moduleId),
            stripIndex: Number(surface.userData.stripIndex),
          }));
        const freeCornerResult = createPanelRangeSelection(
          freePathPanels,
          {
            moduleIndex: columnByModuleId.get(anchorMeta.moduleId),
            stripIndex: Number(anchorMesh.userData.stripIndex),
          },
          {
            moduleIndex: columnByModuleId.get(targetMeta.moduleId),
            stripIndex: Number(mesh.userData.stripIndex),
          },
        );
        if (!freeCornerResult.ok) return;

        clearSelection({ notify: false, keepAnchor: true });
        freeCornerResult.entries.forEach((entry) => {
          selectedSurfaces.add(entry.mesh);
          setSelectionVisual(entry.mesh, true);
        });
        const selectedModuleIds = new Set(
          freeCornerResult.entries.map((entry) => entry.mesh.userData?.moduleId).filter(Boolean),
        );
        selectedModuleId = selectedModuleIds.size === 1 ? [...selectedModuleIds][0] : null;
        notifySelection();
        return;
      }

      const wallIds = ['back', 'left', 'right'];
      if (!wallIds.includes(anchorMeta.wallId) || !wallIds.includes(targetMeta.wallId)) return;

      const wallPanels = surfaceMeshes
        .filter((surface) => isAnchorSidePanel(surface))
        .map((surface) => ({ surface, meta: getSurfaceSelectionPlaneMeta(surface) }))
        .filter((entry) => wallIds.includes(entry.meta?.wallId))
        .map(({ surface }) => ({
          mesh: surface,
          moduleIndex: Number(surface.userData.moduleIndex),
          stripIndex: Number(surface.userData.stripIndex),
        }));

      const crossWallResult = createPanelRangeSelection(
        wallPanels,
        {
          moduleIndex: Number(anchorMesh.userData.moduleIndex),
          stripIndex: Number(anchorMesh.userData.stripIndex),
        },
        {
          moduleIndex: Number(mesh.userData.moduleIndex),
          stripIndex: Number(mesh.userData.stripIndex),
        },
      );
      if (!crossWallResult.ok) return;

      clearSelection({ notify: false, keepAnchor: true });
      crossWallResult.entries.forEach((entry) => {
        selectedSurfaces.add(entry.mesh);
        setSelectionVisual(entry.mesh, true);
      });
      const selectedModuleIds = new Set(
        crossWallResult.entries.map((entry) => entry.mesh.userData?.moduleId).filter(Boolean),
      );
      selectedModuleId = selectedModuleIds.size === 1 ? [...selectedModuleIds][0] : null;
      notifySelection();
      return;
    }

    const planePanels = surfaceMeshes
      .filter((surface) => isAnchorSidePanel(surface))
      .map((surface) => ({ surface, meta: getSurfaceSelectionPlaneMeta(surface) }))
      .filter((entry) => entry.meta?.planeKey === anchorMeta.planeKey);

    const orderedModules = [...new Map(
      planePanels
        .filter((entry) => entry.meta.moduleId)
        .map((entry) => [entry.meta.moduleId, entry.meta]),
    ).values()].sort((a, b) => (a.pathCm - b.pathCm));
    const columnByModuleId = new Map(
      orderedModules.map((entry, index) => [entry.moduleId, index]),
    );
    const anchorColumn = columnByModuleId.get(anchorMeta.moduleId);
    const targetColumn = columnByModuleId.get(targetMeta.moduleId);
    if (!Number.isInteger(anchorColumn) || !Number.isInteger(targetColumn)) return;

    const result = createPanelRangeSelection(
      planePanels.map(({ surface, meta }) => ({
        mesh: surface,
        moduleIndex: columnByModuleId.get(meta.moduleId),
        stripIndex: surface.userData.stripIndex,
      })),
      { moduleIndex: anchorColumn, stripIndex: anchorMesh.userData.stripIndex },
      { moduleIndex: targetColumn, stripIndex: mesh.userData.stripIndex },
    );

    if (!result.ok) return;

    clearSelection({ notify: false, keepAnchor: true });
    result.entries.forEach((entry) => {
      selectedSurfaces.add(entry.mesh);
      setSelectionVisual(entry.mesh, true);
    });
    const selectedModuleIds = new Set(
      result.entries.map((entry) => entry.mesh.userData?.moduleId).filter(Boolean),
    );
    selectedModuleId = selectedModuleIds.size === 1 ? [...selectedModuleIds][0] : null;
    notifySelection();
  }

  function disposeObject(object) {
    object.traverse((child) => {
      if (!child.isMesh && !child.isLineSegments) return;
      if (child.userData?.retainRendererAsset) return;
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        material?.map?.dispose?.();
        material?.dispose?.();
      });
    });
  }

  // Tek modül ekleme: sahnenin geri kalanı (diğer modüller, görseller, logolar, kumaşlar)
  // olduğu gibi kalır; yalnız yeni modül yaratılıp yerleştirilir. Eskiden her bırakmada bütün
  // sahne silinip baştan kuruluyordu (bütün görseller yeniden yüklenir, ekran kartı kilitlenir).
  // Yeni modül zaten yerleşik (placement) olmalı; olmazsa false döner ve çağıran tam kurulum yapar.
  // Tek modülün sahne nesnesini yaratıp yerleştirir. Başarısızsa null (çağıran tam kurulum yapar).
  function addModuleGroup(moduleState, moduleIndex) {
    if (!moduleState?.placement || !Number.isInteger(moduleIndex) || moduleIndex < 0) return null;
    let module = null;
    try {
      module = createRenderableModule(moduleState, moduleIndex, (surface) => applyStoredImage(surface));
    } catch (error) {
      console.warn('Modül eklenemedi; tam kurulum yapılacak:', moduleState?.type, moduleState?.itemKey, error);
      return null;
    }
    if (!module?.group) return null;
    const widthCm = Number(moduleState.widthCm);
    module.group.userData.moduleState = moduleState;
    module.group.userData.moduleIndex = moduleIndex;
    module.group.userData.placement = { ...moduleState.placement };
    applyPlacementToGroup(module.group, moduleState.placement, widthCm);
    wallRoot.add(module.group);
    surfaceMeshes.push(...module.surfaces);
    return module.group;
  }

  function groupHasFabric(group) {
    let found = false;
    group.traverse((object) => {
      if (object.userData?.surfaceState?.fabricGroupId) found = true;
    });
    return found;
  }

  function reindexModuleGroups(modules) {
    wallRoot.children.forEach((child) => {
      const moduleIndex = modules.indexOf(child.userData?.moduleState);
      if (moduleIndex < 0) return;
      child.traverse((object) => {
        if (object.userData && Object.hasOwn(object.userData, 'moduleIndex')) object.userData.moduleIndex = moduleIndex;
      });
    });
  }

  function appendModule(moduleState, moduleIndex) {
    clearPlacementDrag();
    if (!addModuleGroup(moduleState, moduleIndex)) return false;
    notifySelection();
    requestEditorRender();
    return true;
  }

  // Sahneyi verilen modül listesine eşitler (geri al / ileri al, grup işlemleri, araya ekleme).
  // Listede aynı nesneyle duran modülün sahne nesnesine dokunulmaz (görsel, logo, kumaş yeniden
  // yüklenmez); yalnız yeri değiştiyse taşınır. Listeden çıkan kaldırılır; yeni nesneyle gelen
  // veya rebuiltIds içindeki (yerinde içeriği değişmiş) modül yeniden yaratılır. Kumaş kaplaması
  // olan bir modül değiştiyse kaplamalar yeniden kurulur. Yerleşimi olmayan modül varsa false
  // döner; çağıran tam kurulum yapar.
  function syncModules(modules, { rebuiltIds = null } = {}) {
    if (!Array.isArray(modules) || modules.some((moduleState) => !moduleState?.placement)) return false;
    clearPlacementDrag();
    const wanted = new Set(modules);
    const present = new Set();
    let fabricTouched = false;
    [...wallRoot.children].forEach((group) => {
      const state = group.userData?.moduleState;
      if (state && wanted.has(state) && !rebuiltIds?.has(state.id)) {
        present.add(state);
        if (JSON.stringify(group.userData.placement ?? null) !== JSON.stringify(state.placement)) {
          group.userData.placement = { ...state.placement };
          applyPlacementToGroup(group, state.placement, Number(state.widthCm));
          if (groupHasFabric(group)) fabricTouched = true;
        }
        return;
      }
      if (groupHasFabric(group)) fabricTouched = true;
      wallRoot.remove(group);
      deferredWallDisposal.push(group);
    });
    const inScene = new Set();
    wallRoot.children.forEach((group) => group.traverse((object) => inScene.add(object)));
    surfaceMeshes = surfaceMeshes.filter((surface) => inScene.has(surface));
    for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
      const moduleState = modules[moduleIndex];
      if (present.has(moduleState)) continue;
      const group = addModuleGroup(moduleState, moduleIndex);
      if (!group) return false;
      if (groupHasFabric(group)) fabricTouched = true;
    }
    reindexModuleGroups(modules);
    if (fabricTouched) rebuildFabricOverlays();
    notifySelection();
    requestEditorRender();
    return true;
  }

  // Tek modül silme: yalnız o modülün nesneleri kaldırılır; sonraki modüllerin sıra numarası
  // (userData.moduleIndex) güncel diziye göre yenilenir. Kumaş kaplamalı modül (kaplama birden
  // fazla modüle yayılabilir) veya bulunamayan modül için false döner; çağıran tam kurulum yapar.
  function removeModule(moduleId, modules) {
    const group = wallRoot.children.find((child) => child.userData?.moduleState?.id === moduleId);
    if (!group || !Array.isArray(modules)) return false;
    let hasFabric = false;
    group.traverse((object) => {
      if (object.userData?.surfaceState?.fabricGroupId) hasFabric = true;
    });
    if (hasFabric) return false;
    clearPlacementDrag();
    clearSelection({ notify: false });
    wallRoot.remove(group);
    const removedSurfaces = new Set();
    group.traverse((object) => removedSurfaces.add(object));
    surfaceMeshes = surfaceMeshes.filter((surface) => !removedSurfaces.has(surface));
    deferredWallDisposal.push(group);
    reindexModuleGroups(modules);
    notifySelection();
    requestEditorRender();
    return true;
  }

  // Eski sahne nesneleri yeni sahnenin ilk karesi çizildikten sonra dispose edilir. three.js
  // kullanıcısı kalmayan gölgelendirici programını siler; eskiden malzemeler yeniden kurulumdan
  // önce dispose edildiği için her modül ekle/sil/taşı işleminde bütün programlar baştan
  // derleniyordu (ilk kare 1,3–4,9 sn, +27 program). Yeni malzemeler aynı programları devralır.
  let deferredWallDisposal = [];

  function flushDeferredWallDisposal() {
    if (!deferredWallDisposal.length) return;
    const pending = deferredWallDisposal;
    deferredWallDisposal = [];
    pending.forEach(disposeObject);
  }

  function disposeWall({ notify = true, keepAnchor = false } = {}) {
    clearSelection({ notify: false, keepAnchor });
    surfaceMeshes = [];
    while (wallRoot.children.length) {
      const child = wallRoot.children.pop();
      deferredWallDisposal.push(child);
    }
    requestEditorRender();
    if (notify) notifySelection();
  }

  function clearWall({ resetView = true } = {}) {
    requestEditorRender();
    clearPlacementDrag();
    disposeWall();
    if (resetView) {
      if (stageLayout) resetStageView();
      else resetDefaultView(0);
    }
  }

  function applyPlacementToGroup(group, placement, widthCm) {
    if (!group || !placement) return;
    const widthM = Number(widthCm) / 100;
    const xM = Number(placement.xCm) / 100;
    const logicalYM = Number(placement.yCm) / 100;
    const logicalZM = Number(placement.zCm ?? 0) / 100;
    const worldYM = logicalZM;
    const rotationZDeg = normalizeModuleRotationZDeg(placement.rotationZDeg);
    const vertical = isVerticalModuleRotation(rotationZDeg);

    // Logical Z etrafındaki plan dönüşü Three.js world-Y yaw olarak uygulanır.
    // 0=ön, 90=sağ, 180=arka, 270=sol. Ön yüz artık wallId hilesiyle değil
    // doğrudan rotationZDeg state'iyle belirlenir.
    group.rotation.set(0, THREE.MathUtils.degToRad(rotationZDeg), 0);

    if (vertical) {
      group.position.set(xM, worldYM, logicalYM + widthM / 2);
    } else {
      group.position.set(xM + widthM / 2, worldYM, logicalYM);
    }
    requestEditorRender();
  }

  function createBaseWallModule(moduleState, moduleIndex, applyStoredImage) {
    const wallState = { ...moduleState, type: 'flat-panel' };
    const baseState = {
      ...moduleState,
      id: `${moduleState.id}-base-layer`,
      type: 'base',
      depthCm: 50,
      heightCm: 50,
    };

    const wall = createFlatPanelModule(wallState, moduleIndex, applyStoredImage);
    const base = createBaseModule(baseState, moduleIndex, applyStoredImage);
    const group = new THREE.Group();
    group.userData.kind = 'module';
    group.userData.moduleId = moduleState.id;
    group.userData.moduleType = 'base-wall';
    group.userData.moduleIndex = moduleIndex;

    while (wall.group.children.length) group.add(wall.group.children[0]);
    // Panel Bazalı'da duvar paneli baza derinliğinin ortasında değil arka kenarında kalır.
    // Duvar düzlemi z=0; 50 cm baza gövdesi standın içine doğru z=0..0.50 uzanır.
    while (base.group.children.length) {
      const child = base.group.children[0];
      child.position.z += 0.25;
      group.add(child);
    }

    const surfaces = [...wall.surfaces, ...base.surfaces];
    surfaces.forEach((surface) => {
      surface.userData.moduleId = moduleState.id;
      surface.userData.moduleType = 'base-wall';
      surface.userData.moduleIndex = moduleIndex;
    });
    return { group, surfaces };
  }

  function createRenderableModule(moduleState, moduleIndex, onSurfaceReady = null) {
    const catalogItem = moduleState?.itemKey ? getItem(moduleState.itemKey) : null;
    if (itemHasAssemblyLayout(catalogItem)) {
      return createItemAssemblyModule(moduleState, moduleIndex, catalogItem);
    }
    if (moduleState.type === 'separator') {
      return createSeparatorModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'base-wall') {
      return createBaseWallModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'base') {
      return createBaseModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'counter') {
      return createCounterModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'sofa-set-classic') {
      return createBeigeSofaSetModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'sofa-single-classic') {
      return createSofaSingleClassicModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'sofa-double-classic') {
      return createSofaDoubleClassicModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'coffee-table-classic') {
      return createCoffeeTableClassicModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'table-chair-set-eames') {
      return createEamesTableChairSetModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'chair') {
      return createEamesChairModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'table-glass') {
      return createGlassTableModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'bar-stool') {
      return createBarStoolModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'mini-fridge') {
      return createMiniFridgeModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'kettle') {
      return createKettleModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'coat-rack') {
      return createCoatRackModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'floor-showcase') {
      return createFloorShowcaseModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'brochure-stand') {
      return createBrochureStandModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'upright') {
      return createUprightModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'profile') {
      return createProfileModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'indoor-plant-1' || moduleState.type === 'plastic-trash-bin') {
      return createIndoorPlantModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'box-block') {
      return createBoxBlockModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'tulle-fabric') {
      return createTulleFabricModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'illuminated-foam') {
      return createIlluminatedFoamModule(moduleState, moduleIndex, getAssetUrl(moduleState.imageAssetId));
    }
    if (moduleState.type === 'tv') {
      return createTvModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'led-floodlight') {
      return createLedFloodlightModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'shelf') {
      return createShelfModule(moduleState, moduleIndex);
    }
    if (moduleState.type === 'door') {
      return createDoorModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'showcase-2' || moduleState.type === 'showcase-3') {
      return createShowcaseModule(moduleState, moduleIndex, onSurfaceReady);
    }
    if (moduleState.type === 'flat-panel') {
      return createFlatPanelModule(moduleState, moduleIndex, onSurfaceReady);
    }
    return null;
  }

  function buildWall(modules, { resetView = true } = {}) {
    const selectedSurfaceIds = new Set(
      [...selectedSurfaces].map((mesh) => mesh.userData.surfaceId).filter(Boolean),
    );
    const previousAnchorSurfaceId = selectionAnchorSurfaceId;

    clearPlacementDrag();
    retainWallTexturesForRebuild();
    disposeWall({ notify: false, keepAnchor: true });

    const totalWidth = modules.reduce((sum, module) => sum + module.widthCm / 100, 0);
    let cursorX = 0;
    let hasMultiEdgePlacement = false;

    modules.forEach((moduleState, moduleIndex) => {
      let module = null;
      try {
        module = createRenderableModule(
          moduleState,
          moduleIndex,
          (surface) => applyStoredImage(surface),
        );
      } catch (error) {
        console.warn(
          'Modül render atlandı:',
          moduleState?.type,
          moduleState?.itemKey,
          moduleState?.id,
          error,
        );
        return;
      }
      if (!module) {
        console.warn('Desteklenmeyen modül tipi atlandı:', moduleState.type, moduleState.id);
        return;
      }

      const widthCm = Number(moduleState.widthCm);
      let placement = moduleState.placement;
      if (!placement) {
        placement = createModulePlacement({
          xCm: Math.round(cursorX * 100),
          yCm: 0,
          rotationZDeg: 0,
          wallId: 'back',
          itemKey: moduleState.itemKey,
        });
        moduleState.placement = placement;
      }

      if (placement.wallId === 'back' && !isVerticalModuleRotation(placement.rotationZDeg)) {
        cursorX = Math.max(cursorX, (Number(placement.xCm) + widthCm) / 100);
      } else {
        hasMultiEdgePlacement = true;
      }

      module.group.userData.moduleState = moduleState;
      module.group.userData.moduleIndex = moduleIndex;
      module.group.userData.placement = { ...placement };
      applyPlacementToGroup(module.group, placement, widthCm);
      wallRoot.add(module.group);
      
      surfaceMeshes.push(...module.surfaces);
    });

    surfaceMeshes.forEach((surface) => {
      if (selectedSurfaceIds.has(surface.userData.surfaceId)) {
        selectedSurfaces.add(surface);
        setSelectionVisual(surface, true);
      }
    });

    rebuildFabricOverlays();

    selectionAnchorSurfaceId = surfaceMeshes.some(
      (surface) => surface.userData.surfaceId === previousAnchorSurfaceId,
    )
      ? previousAnchorSurfaceId
      : ([...selectedSurfaces][0]?.userData.surfaceId ?? null);

    if (resetView) {
      if (hasMultiEdgePlacement && stageLayout) resetStageView();
      else resetDefaultView(totalWidth);
    }
    // Any retained texture left here belonged to a deleted surface/module. Reused
    // textures are removed from the transfer map by applyStoredImage().
    disposeUnusedRebuildTextures();
    notifySelection();
    requestEditorRender();
    return { totalWidth, surfaceCount: surfaceMeshes.length };
  }

  function resetStageView() {
    if (!stageLayout) return;
    const target = new THREE.Vector3(
      stageLayout.widthM / 2,
      0.12,
      stageLayout.depthM / 2,
    );
    const span = Math.hypot(stageLayout.sceneWidthM, stageLayout.sceneDepthM);
    const distance = Math.max(7, span * 0.92);

    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(STAGE_HOME_DIRECTION, distance);
    if (camera.isOrthographicCamera) {
      camera.zoom = 1;
      const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      const span = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov) / 2);
      setOrthographicSpan(span, aspect);
    }
    camera.lookAt(target);
    controls.update();
  }

  function resetDefaultView(totalWidthM = 0) {
    const centerX = totalWidthM / 2;
    const target = new THREE.Vector3(
      centerX,
      STAND_DIMENSIONS.height * 0.47,
      0,
    );
    const distance = Math.max(
      DEFAULT_VIEW_MIN_DISTANCE,
      totalWidthM * DEFAULT_VIEW_DISTANCE_FACTOR,
    );

    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(HOME_DIRECTION, distance);
    if (camera.isOrthographicCamera) {
      camera.zoom = 1;
      const aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      const span = 2 * distance * Math.tan(THREE.MathUtils.degToRad(perspectiveCamera.fov) / 2);
      setOrthographicSpan(span, aspect);
    }
    camera.lookAt(target);
    controls.update();
  }

  function setPointerFromClient(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findModuleGroup(object) {
    let current = object;
    while (current && current !== wallRoot) {
      if (current.userData?.kind === 'module') return current;
      current = current.parent;
    }
    return null;
  }

  function nearestBoxFaceHit(hits) {
    if (!hits?.length) return null;
    const closest = hits[0];
    const faceHit = hits.find((entry) => (
      entry.object?.userData?.faceSlot
      && entry.distance <= closest.distance + 0.03
    ));
    return faceHit ?? closest;
  }

  function pickModuleAt(clientX, clientY) {
    // Idle frames are throttled, so a module can sit with a stale world matrix
    // until the next render. Raycast uses that matrix and would miss the mesh.
    wallRoot.updateMatrixWorld(true);
    setPointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(wallRoot.children, true);
    const moduleHits = hits.filter((hit) => findModuleGroup(hit.object));
    if (!moduleHits.length) return null;
    const chosen = nearestBoxFaceHit(moduleHits);
    return { moduleGroup: findModuleGroup(chosen.object), hit: chosen };
  }

  function getGroundPoint(clientX, clientY) {
    if (!activeFloor.visible) return null;
    setPointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(activeFloor, false)[0];
    if (!hit) return null;
    return {
      xCm: hit.point.x * 100,
      yCm: hit.point.z * 100,
    };
  }

  function getDragPlanePoint(clientX, clientY, worldY) {
    if (!Number.isFinite(Number(worldY))) return null;
    setPointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -Number(worldY));
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;
    return {
      xCm: point.x * 100,
      yCm: point.z * 100,
    };
  }

  function getTopFixtureDragPoint(clientX, clientY, preferredWallId = 'back', zCm = 0) {
    if (!stageLayout) return null;
    setPointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);

    const planeYm = Number(zCm) / 100;
    // Projektörü item defaultZCm kotunda gezdir. Profile snap adım 5.
    const topPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -planeYm,
    );
    const topPoint = new THREE.Vector3();
    const topHit = raycaster.ray.intersectPlane(topPlane, topPoint);
    if (topHit) {
      const xCm = topPoint.x * 100;
      const yCm = topPoint.z * 100;
      const widthCm = Number(stageLayout.widthCm);
      const depthCm = Number(stageLayout.depthCm);
      const outerMarginCm = 60;

      if (
        xCm >= -outerMarginCm && xCm <= widthCm + outerMarginCm
        && yCm >= -outerMarginCm && yCm <= depthCm + outerMarginCm
      ) {
        const allowedWalls = getAllowedWallIds(stageLayout.standType)
          .filter((wallId) => wallId !== 'free');
        const wallDistances = [];
        if (allowedWalls.includes('back')) wallDistances.push({ wallId: 'back', distanceCm: Math.abs(yCm) });
        if (allowedWalls.includes('left')) wallDistances.push({ wallId: 'left', distanceCm: Math.abs(xCm) });
        if (allowedWalls.includes('right')) wallDistances.push({ wallId: 'right', distanceCm: Math.abs(widthCm - xCm) });

        wallDistances.sort((a, b) => {
          const distanceDelta = a.distanceCm - b.distanceCm;
          if (Math.abs(distanceDelta) > 0.001) return distanceDelta;
          if (a.wallId === preferredWallId) return -1;
          if (b.wallId === preferredWallId) return 1;
          return 0;
        });

        const nearestWall = wallDistances[0];
        const wallSnapDistanceCm = 30;
        const preferredWall = wallDistances.find((entry) => entry.wallId === preferredWallId);
        const snapWall = preferredWall && preferredWall.distanceCm <= wallSnapDistanceCm
          ? preferredWall
          : nearestWall;
        if (snapWall && snapWall.distanceCm <= wallSnapDistanceCm) {
          return { wallId: snapWall.wallId, xCm, yCm, mode: 'wall' };
        }

        return { wallId: 'free', xCm, yCm, mode: 'free' };
      }
    }

    // Çok yatık kamera açılarında üst düzlem kesişmezse mevcut duvar düzlemi hesabını fallback olarak kullan.
    const allowedWalls = getAllowedWallIds(stageLayout.standType)
      .filter((wallId) => wallId !== 'free');
    const wallOrder = [preferredWallId, ...allowedWalls.filter((wallId) => wallId !== preferredWallId)];
    const candidates = [];
    const epsilonCm = 4;

    wallOrder.forEach((wallId, order) => {
      let plane;
      if (wallId === 'left') {
        plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
      } else if (wallId === 'right') {
        plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -Number(stageLayout.widthM));
      } else if (wallId === 'back') {
        plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      } else {
        return;
      }

      const point = new THREE.Vector3();
      const hit = raycaster.ray.intersectPlane(plane, point);
      if (!hit) return;
      const xCm = point.x * 100;
      const yCm = point.z * 100;
      const inBounds = wallId === 'back'
        ? xCm >= -epsilonCm && xCm <= Number(stageLayout.widthCm) + epsilonCm
        : yCm >= -epsilonCm && yCm <= Number(stageLayout.depthCm) + epsilonCm;
      if (!inBounds) return;
      candidates.push({ wallId, xCm, yCm, distance: raycaster.ray.origin.distanceTo(point), order, mode: 'wall' });
    });

    if (!candidates.length) return null;
    candidates.sort((a, b) => (a.distance - b.distance) || (a.order - b.order));
    return candidates[0];
  }

  function pickModuleContext(event) {
    const picked = pickModuleAt(event.clientX, event.clientY);
    if (!picked) return null;

    const { moduleGroup, hit } = picked;
    const surface = hit.object.userData?.kind === 'surface' ? hit.object : null;
    return buildModuleContext(moduleGroup, surface, event.clientX, event.clientY);
  }

  // Seçili modülün menü bağlamı (araç çubuğu ⋯, dokunmatik): seçili yüzey o modüldeyse onu kullanır.
  function getSelectionContext({ clientX = 0, clientY = 0 } = {}) {
    let moduleGroup = getSingleSelectedModuleGroup()
      ?? (multiSelectedModuleIds.size ? findModuleGroupById([...multiSelectedModuleIds][0]) : null);
    // Modüller arası panel seçimi: bağlam çapa panelinin modülüdür (sağ tıkla aynı panel işlemleri).
    let anchorSurface = null;
    if (!moduleGroup && selectedSurfaces.size) {
      anchorSurface = [...selectedSurfaces].find((mesh) => mesh.userData?.surfaceId === selectionAnchorSurfaceId)
        ?? [...selectedSurfaces][0];
      moduleGroup = findModuleGroupById(anchorSurface.userData?.moduleId);
    }
    if (!moduleGroup) return null;
    const moduleId = moduleGroup.userData?.moduleState?.id ?? moduleGroup.userData?.moduleId;
    const surface = anchorSurface ?? [...selectedSurfaces].find((mesh) => mesh.userData?.moduleId === moduleId) ?? null;
    return buildModuleContext(moduleGroup, surface, clientX, clientY);
  }

  function buildModuleContext(moduleGroup, surface, clientX, clientY) {
    const supportsGlass = surface?.userData.acceptsGlass === true;
    const supportsLightbox = surface?.userData.acceptsLightbox === true;
    const supportsMesh = surface?.userData.acceptsMesh === true;
    const supportsFabric = supportsLightbox || supportsMesh;
    const moduleState = moduleGroup.userData.moduleState ?? {};
    return {
      moduleIndex: moduleGroup.userData.moduleIndex,
      // Shift+tık moduleState.id ile seçer; sağ tık aynı kimliği kullanmalı.
      moduleId: moduleState.id ?? moduleGroup.userData.moduleId,
      itemKey: moduleState.itemKey ?? null,
      type: moduleState.type ?? moduleGroup.userData.type,
      widthCm: moduleState.widthCm ?? moduleGroup.userData.widthCm,
      depthCm: moduleState.depthCm ?? moduleGroup.userData.depthCm,
      shape: moduleState.shape ?? null,
      placement: moduleGroup.userData.moduleState?.placement
        ? { ...moduleGroup.userData.moduleState.placement }
        : null,
      surfaceId: surface?.userData.surfaceId ?? null,
      stripIndex: surface?.userData.stripIndex ?? null,
      stripNumber: surface?.userData.stripNumber ?? null,
      supportsGlass,
      isGlass: supportsGlass ? Boolean(surface.userData.surfaceState?.isGlass) : false,
      supportsMetalSeparator: supportsGlass,
      isMetalSeparator: supportsGlass
        ? Boolean(surface.userData.surfaceState?.isMetalSeparator)
        : false,
      supportsFabric,
      supportsLightbox,
      supportsMesh,
      isFabric: supportsFabric ? Boolean(surface.userData.surfaceState?.fabricGroupId) : false,
      fabricType: supportsFabric && surface.userData.surfaceState?.fabricGroupId
        ? (surface.userData.surfaceState?.fabricType === 'mesh' ? 'mesh' : 'lightbox')
        : null,
      isLightboxFabric: supportsLightbox
        ? Boolean(surface.userData.surfaceState?.fabricGroupId && surface.userData.surfaceState?.fabricType !== 'mesh')
        : false,
      isMeshFabric: supportsMesh
        ? Boolean(surface.userData.surfaceState?.fabricGroupId && surface.userData.surfaceState?.fabricType === 'mesh')
        : false,
      fabricLightingOn: supportsLightbox
        ? Boolean(surface.userData.surfaceState?.fabricLightingOn && surface.userData.surfaceState?.fabricType !== 'mesh')
        : false,
      hasImage: Boolean(
        surface && (
          (
            surface.userData.acceptsImage !== false
            && surface.userData.surfaceState?.imageAssetId
            && !surface.userData.surfaceState?.fabricGroupId
          ) || (
            surface.userData.surfaceState?.fabricGroupId
            && surface.userData.surfaceState?.fabricImageAssetId
          )
        ),
      ),
      clientX,
      clientY,
    };
  }

  function syncPlacementGhostDom() {
    setStandFloorGridActive(Boolean(placementGhost?.root?.visible));
    const canvas = renderer.domElement;
    if (!canvas?.dataset) return;
    if (!placementGhost?.root?.visible) {
      canvas.dataset.placementGhost = 'hidden';
      return;
    }
    canvas.dataset.placementGhost = placementGhost.colorHex === PLACEMENT_VALID_COLOR
      ? 'valid'
      : 'invalid';
  }

  function disposePlacementGhost() {
    if (!placementGhost) return;
    placementGhost.root.visible = false;
    syncPlacementGhostDom();
  }

  function destroyPlacementGhost() {
    if (!placementGhost) return;
    scene.remove(placementGhost.root);
    placementGhost.material?.dispose?.();
    placementGhost = null;
    syncPlacementGhostDom();
  }

  function getPlacementGhostDimensions(moduleOrWidthCm) {
    if (typeof moduleOrWidthCm === 'object' && moduleOrWidthCm) {
      const box = requireModuleSceneBoxCm(moduleOrWidthCm, ['widthCm', 'depthCm', 'heightCm']);
      return {
        widthCm: box.widthCm,
        depthM: Math.max(box.depthCm / 100, 0.02),
        heightM: Math.max(box.heightCm / 100, 0.02),
      };
    }
    // Sayısal genişlik yolu: item yok; yalnız stand duvar zarfı (tavan + derinlik).
    return {
      widthCm: Number(moduleOrWidthCm),
      depthM: Math.max(STAND_DIMENSIONS.depth, 0.08),
      heightM: STAND_DIMENSIONS.height,
    };
  }

  function getPlacementGhostKey(moduleOrWidthCm, dimensions) {
    if (!moduleOrWidthCm || typeof moduleOrWidthCm !== 'object') {
      return ['generic', dimensions.widthCm, dimensions.depthM, dimensions.heightM].join(':');
    }
    const occupancy = resolveModuleStripOccupancy(moduleOrWidthCm);
    return [
      moduleOrWidthCm.itemKey ?? '',
      moduleOrWidthCm.type ?? 'generic',
      dimensions.widthCm,
      dimensions.depthM,
      dimensions.heightM,
      moduleOrWidthCm.shape ?? '',
      occupancy?.align ?? '',
      occupancy?.stripCount ?? '',
      Array.isArray(moduleOrWidthCm.strips) ? moduleOrWidthCm.strips.length : '',
    ].join(':');
  }

  function createSilhouetteGhostMaterial(opacity) {
    return new THREE.MeshBasicMaterial({
      color: PLACEMENT_VALID_COLOR,
      transparent: true,
      opacity: Number(opacity) || 0.38,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
  }

  function preparePlacementGhostTree(object, ghostMaterial) {
    if (!object) return;

    if (!object.userData?.placementGhostAddWrapped) {
      const originalAdd = object.add.bind(object);
      object.add = (...children) => {
        children.forEach((child) => preparePlacementGhostTree(child, ghostMaterial));
        return originalAdd(...children);
      };
      object.userData = {
        ...object.userData,
        placementGhostAddWrapped: true,
      };
    }

    object.raycast = () => {};

    if (
      object.isLight
      || object.isLine
      || object.isLineSegments
      || object.isPoints
      || object.isSprite
      || object.userData?.isModuleSelectionVisual
    ) {
      object.visible = false;
    } else if (object.isMesh) {
      const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const isInvisiblePickingProxy = sourceMaterials.some((material) => (
        material?.colorWrite === false
        || (material?.transparent === true && Number(material?.opacity) === 0)
      ));

      if (isInvisiblePickingProxy) {
        object.visible = false;
        object.userData = {
          ...object.userData,
          placementGhostHiddenProxy: true,
        };
      } else {
        object.material = ghostMaterial;
        object.castShadow = false;
        object.receiveShadow = false;
        object.renderOrder = 10000;
      }
    }

    object.children.forEach((child) => preparePlacementGhostTree(child, ghostMaterial));
  }

  function createFallbackPlacementGhost(dimensions, key, opacity) {
    const root = new THREE.Group();
    const material = createSilhouetteGhostMaterial(opacity);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        Math.max(dimensions.widthCm / 100, 0.02),
        dimensions.heightM,
        dimensions.depthM,
      ),
      material,
    );
    mesh.position.y = dimensions.heightM / 2;
    mesh.renderOrder = 10000;
    mesh.raycast = () => {};
    root.add(mesh);
    root.visible = false;
    scene.add(root);
    return {
      root,
      material,
      key,
      widthCm: dimensions.widthCm,
      colorHex: PLACEMENT_VALID_COLOR,
      isFallback: true,
    };
  }

  function createPlacementGhost(moduleOrWidthCm, dimensions, key, ghostBehavior) {
    if (!moduleOrWidthCm || typeof moduleOrWidthCm !== 'object') {
      return createFallbackPlacementGhost(dimensions, key, ghostBehavior.opacity);
    }

    const built = createRenderableModule(moduleOrWidthCm, -1, null);
    if (!built?.group) {
      console.warn('Silüet ghost için modül renderer bulunamadı; kutu fallback kullanılıyor:', moduleOrWidthCm.type);
      return createFallbackPlacementGhost(dimensions, key, ghostBehavior.opacity);
    }

    const root = built.group;
    root.position.set(0, 0, 0);
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.visible = false;

    const material = createSilhouetteGhostMaterial(ghostBehavior.opacity);
    preparePlacementGhostTree(root, material);
    scene.add(root);

    return {
      root,
      material,
      key,
      widthCm: dimensions.widthCm,
      colorHex: PLACEMENT_VALID_COLOR,
      isFallback: false,
    };
  }

  function ensurePlacementGhost(moduleOrWidthCm) {
    const ghostBehavior = getModuleGhostBehavior(moduleOrWidthCm);
    const dimensions = getPlacementGhostDimensions(moduleOrWidthCm);
    const key = getPlacementGhostKey(moduleOrWidthCm, dimensions);
    if (placementGhost?.key === key) return placementGhost;

    destroyPlacementGhost();
    placementGhost = createPlacementGhost(moduleOrWidthCm, dimensions, key, ghostBehavior);
    placementGhost.moduleState = moduleOrWidthCm && typeof moduleOrWidthCm === 'object' ? moduleOrWidthCm : null;
    return placementGhost;
  }

  function showPlacementGhost(moduleOrWidthCm, placement, valid) {
    requestEditorRender();
    const ghost = ensurePlacementGhost(moduleOrWidthCm);
    const colorHex = valid ? PLACEMENT_VALID_COLOR : PLACEMENT_INVALID_COLOR;
    ghost.colorHex = colorHex;
    ghost.material?.color?.setHex(colorHex);
    if (moduleOrWidthCm && typeof moduleOrWidthCm === 'object') {
      ghost.root.userData.type = moduleOrWidthCm.type ?? ghost.root.userData.type;
    }
    applyPlacementToGroup(ghost.root, placement, ghost.widthCm);
    ghost.root.visible = true;
    syncPlacementGhostDom();
  }

  function disposeDragBadge() {
    dragBadge?.remove?.();
    dragBadge = null;
  }

  function updateDragBadge(moduleState, clientX, clientY) {
    if (!dragBadge) {
      dragBadge = document.createElement('div');
      dragBadge.style.cssText = [
        'position:fixed',
        'z-index:10000',
        'display:flex',
        'align-items:center',
        'gap:8px',
        'padding:7px 9px',
        'border:1px solid #d9dee5',
        'border-radius:9px',
        'background:rgba(255,255,255,.94)',
        'box-shadow:0 8px 24px rgba(15,23,42,.16)',
        'color:#364152',
        'font:600 11px/1.2 system-ui,sans-serif',
        'pointer-events:none',
        'user-select:none',
      ].join(';');

      const previewSlot = document.createElement('div');
      previewSlot.dataset.role = 'preview-slot';
      previewSlot.style.cssText = 'width:66px;height:58px;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 66px';
      const label = document.createElement('span');
      label.dataset.role = 'label';
      dragBadge.append(previewSlot, label);
      document.body.appendChild(dragBadge);
    }

    const catalogItem = getModuleCatalogItem(moduleState) ?? moduleState;
    // Katalogda görünmeyen item'lar (ör. Işıklı Strafor) için etiket item adından gelir.
    const labelText = getModuleCatalogItem(moduleState)
      ? getModuleCatalogLabel(moduleState)
      : (getItem(moduleState?.itemKey)?.name ?? getModuleCatalogLabel(moduleState));
    const previewSlot = dragBadge.querySelector('[data-role="preview-slot"]');
    const label = dragBadge.querySelector('[data-role="label"]');
    if (label) label.textContent = labelText;

    if (previewSlot) {
      const signature = `${moduleState?.itemKey ?? ''}|${labelText}|${moduleState?.type ?? ''}|${moduleState?.widthCm ?? ''}`;
      if (previewSlot.dataset.signature !== signature) {
        previewSlot.dataset.signature = signature;
        previewSlot.innerHTML = '';
        const preview = createModuleCatalogPreview(catalogItem);
        preview.style.width = '66px';
        preview.style.height = '58px';
        preview.style.flex = '0 0 66px';
        preview.style.background = 'transparent';
        preview.style.borderRadius = '0';
        previewSlot.appendChild(preview);
      }
    }

    dragBadge.style.left = `${clientX + 18}px`;
    dragBadge.style.top = `${clientY + 18}px`;
  }

  function clearPlacementDrag() {
    if (dragSession?.moduleGroup) dragSession.moduleGroup.visible = true;
    dragSession = null;
    controls.enabled = true;
    disposePlacementGhost();
    disposeDragBadge();
    clearPlacementFeedback();
  }

  function getRenderedModuleStates() {
    return wallRoot.children
      .map((group) => group.userData?.moduleState)
      .filter(Boolean);
  }

  function snapTopFixturePlacement(basePlacement, ground, widthCm, moduleState) {
    const rawZCm = Number.isFinite(Number(basePlacement?.zCm))
      ? Number(basePlacement.zCm)
      : resolveItemDefaultZCm(moduleState);
    const placement = {
      ...basePlacement,
      zCm: clampMountBottomZCm(rawZCm),
    };
    if (!stageLayout || !ground) return placement;

    const stepCm = 20;
    const width = Math.max(0, Number(widthCm) || 0);
    const snap20 = (value) => Math.round(Number(value) / stepCm) * stepCm;

    if (placement.wallId === 'back') {
      placement.xCm = Math.min(
        Math.max(0, Number(stageLayout.widthCm) - width),
        Math.max(0, snap20(ground.xCm)),
      );
      placement.yCm = 0;
    } else if (placement.wallId === 'left') {
      placement.xCm = 0;
      placement.yCm = Math.min(
        Math.max(0, Number(stageLayout.depthCm) - width),
        Math.max(0, snap20(ground.yCm)),
      );
    } else     if (placement.wallId === 'right') {
      placement.xCm = Number(stageLayout.widthCm);
      placement.yCm = Math.min(
        Math.max(0, Number(stageLayout.depthCm) - width),
        Math.max(0, snap20(ground.yCm)),
      );
    }

    const anchored = snapPlacementToItemAnchor(moduleState, placement, getRenderedModuleStates());
    if (anchored) {
      return {
        ...anchored,
        zCm: clampMountBottomZCm(
          Number.isFinite(Number(anchored.zCm)) ? Number(anchored.zCm) : rawZCm,
        ),
      };
    }
    placement.zCm = clampMountBottomZCm(rawZCm);
    return placement;
  }

  function inferWallIdForRotation(placement, rotationZDeg) {
    if (!stageLayout || !placement) return 'free';
    const allowedWalls = getAllowedWallIds(stageLayout.standType);
    const vertical = isVerticalModuleRotation(rotationZDeg);
    const xCm = Number(placement.xCm);
    const yCm = Number(placement.yCm);
    const epsilonCm = 0.001;

    if (!vertical && Math.abs(yCm) <= epsilonCm && allowedWalls.includes('back')) {
      return 'back';
    }
    if (vertical && Math.abs(xCm) <= epsilonCm && allowedWalls.includes('left')) {
      return 'left';
    }
    if (
      vertical
      && Math.abs(xCm - Number(stageLayout.widthCm)) <= epsilonCm
      && allowedWalls.includes('right')
    ) {
      return 'right';
    }
    return 'free';
  }

  function getSingleSelectedModuleGroup() {
    let moduleId = selectedModuleId;
    if (!moduleId) {
      const moduleIds = new Set(
        [...selectedSurfaces].map((surface) => surface.userData?.moduleId).filter(Boolean),
      );
      if (moduleIds.size !== 1) return null;
      [moduleId] = moduleIds;
    }
    return wallRoot.children.find((group) => (
      group.userData?.moduleState?.id === moduleId || group.userData?.moduleId === moduleId
    )) ?? null;
  }

  function getKeyboardRotationPlacementSignature(placement) {
    if (!placement) return '';
    return [
      Number(placement.xCm),
      Number(placement.yCm),
      Number(placement.zCm ?? 0),
      normalizeModuleRotationZDeg(placement.rotationZDeg),
      placement.wallId ?? 'free',
    ].join('|');
  }

  function getKeyboardRotationCursor(moduleState) {
    const committedPlacementSignature = getKeyboardRotationPlacementSignature(moduleState?.placement);
    if (
      !keyboardRotationCursor
      || keyboardRotationCursor.moduleId !== moduleState?.id
      || keyboardRotationCursor.committedPlacementSignature !== committedPlacementSignature
    ) {
      keyboardRotationCursor = {
        moduleId: moduleState?.id ?? null,
        rotationZDeg: normalizeModuleRotationZDeg(moduleState?.placement?.rotationZDeg),
        committedPlacementSignature,
      };
    }
    return keyboardRotationCursor;
  }

  function rotateSelectedModule(deltaDeg) {
    if (!stageLayout || dragSession?.dragging) return { handled: false, ok: false };
    const moduleGroup = getSingleSelectedModuleGroup();
    const moduleState = moduleGroup?.userData?.moduleState;
    if (!moduleGroup || !moduleState?.placement) return { handled: false, ok: false };

    if (isModuleLocked(moduleState)) {
      showPlacementFeedback(MODULE_LOCKED_MESSAGE, { durationMs: 1800 });
      return { handled: true, ok: false, message: MODULE_LOCKED_MESSAGE };
    }

    // Gruptaki öğede Shift+R bütün grubu grup merkezi etrafında 45° döndürür.
    if (getModuleGroupId(moduleState)) {
      const groupDeltaDeg = Number(deltaDeg) < 0 ? -GROUP_ROTATE_STEP_DEG : GROUP_ROTATE_STEP_DEG;
      const plan = planRenderedGroupRotate(getModuleGroupId(moduleState), groupDeltaDeg);
      if (!plan.ok) {
        showPlacementFeedback(plan.message, { durationMs: 1800 });
        return { handled: true, ok: false, message: plan.message };
      }
      clearPlacementFeedback();
      commitGroupPlacements(plan.placements);
      return { handled: true, ok: true };
    }

    if (getFabricMoveLock(moduleState.id)) {
      const message = 'Bu modül tek parça Lightbox/Mesh kaplamasına bağlı. Döndürmek için önce kaplamayı kaldır.';
      showPlacementFeedback(message, { durationMs: 1800 });
      return { handled: true, ok: false, message };
    }

    const effectiveDeltaDeg = resolveModuleRotationDeltaDeg(moduleState, deltaDeg);
    const rotationCursor = getKeyboardRotationCursor(moduleState);
    rotationCursor.rotationZDeg = rotateModuleRotationZDeg(
      rotationCursor.rotationZDeg,
      effectiveDeltaDeg,
    );
    const currentRotationZDeg = normalizeModuleRotationZDeg(moduleState.placement.rotationZDeg);
    const targetRotationZDeg = rotationCursor.rotationZDeg;
    const rotationDeltaFromCommittedDeg = effectiveDeltaDeg < 0
      ? -((currentRotationZDeg - targetRotationZDeg + 360) % 360)
      : ((targetRotationZDeg - currentRotationZDeg + 360) % 360);
    const nextPlacement = rotateModulePlacementAroundCenter(
      moduleState.placement,
      moduleState.widthCm,
      rotationDeltaFromCommittedDeg,
      moduleState.depthCm,
    );
    if (!nextPlacement) return { handled: false, ok: false };
    nextPlacement.wallId = isFloorFixtureType(moduleState.type)
      ? 'free'
      : inferWallIdForRotation(
          nextPlacement,
          nextPlacement.rotationZDeg,
        );

    const validation = validatePlacementAgainstModules({
      placement: nextPlacement,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      moduleId: moduleState.id,
      moduleType: moduleState.type,
      itemKey: moduleState.itemKey,
      heightCm: moduleState.heightCm,
      shape: moduleState.shape,
      modules: getRenderedModuleStates(),
      standType: stageLayout.standType,
      standXCm: stageLayout.widthCm,
      standYCm: stageLayout.depthCm,
    });
    if (!validation.ok) {
      const message = validation.message ?? 'Modül bu yönde döndürülemez.';
      showPlacementGhost(moduleState, nextPlacement, false);
      showPlacementFeedback(message, { durationMs: 1800 });
      window.setTimeout(() => {
        if (!dragSession?.dragging) disposePlacementGhost();
      }, 850);
      return { handled: true, ok: false, message };
    }

    clearPlacementFeedback();
    disposePlacementGhost();
    moduleState.placement = { ...nextPlacement };
    moduleGroup.userData.placement = { ...nextPlacement };
    applyPlacementToGroup(moduleGroup, nextPlacement, moduleState.widthCm);
    rotationCursor.rotationZDeg = normalizeModuleRotationZDeg(nextPlacement.rotationZDeg);
    rotationCursor.committedPlacementSignature = getKeyboardRotationPlacementSignature(nextPlacement);
    return { handled: true, ok: true };
  }

  function getFreeTvPlacement(clientX, clientY, moduleState, preferredRotationZDeg = 0) {
    if (!stageLayout || !moduleState) return { placement: null, message: null };
    const ground = getGroundPoint(clientX, clientY);
    if (!ground) return { placement: null, message: null };
    const snapped = snapPlacementToStand({
      standType: stageLayout.standType,
      moduleType: moduleState.type,
      shape: moduleState.shape,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      forceFree: true,
      pointerXCm: ground.xCm,
      pointerYCm: ground.yCm,
      standXCm: stageLayout.widthCm,
      standYCm: stageLayout.depthCm,
      preferredRotationZDeg,
      rotationLocked: true,
    });
    if (!snapped.ok || !snapped.placement) return { placement: null, message: snapped.message ?? null };
    return {
      placement: withItemZ(moduleState, {
        ...snapped.placement,
        wallId: 'free',
      }),
      message: null,
    };
  }

  function getWallOverlayDragPoint(clientX, clientY, preferredWallId = null, moduleState = null) {
    if (!stageLayout) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const overlayRaycaster = new THREE.Raycaster();
    overlayRaycaster.setFromCamera(ndc, camera);

    const pointed = pickModuleAt(clientX, clientY);
    const pointedModuleState = pointed?.moduleGroup?.userData?.moduleState;
    if (
      pointedModuleState?.placement?.wallId === 'free'
      && supportsWallOverlayMount(pointedModuleState)
      && pointed?.hit?.point
    ) {
      const supportRotationZDeg = normalizeModuleRotationZDeg(pointedModuleState.placement.rotationZDeg);
      const supportFront = new THREE.Vector3(0, 0, 1)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(supportRotationZDeg));
      const cameraSide = overlayRaycaster.ray.origin.clone().sub(pointed.hit.point).dot(supportFront);
      const rotationZDeg = normalizeModuleRotationZDeg(
        supportRotationZDeg + (cameraSide < 0 ? 180 : 0),
      );
      const hit = pointed.hit.point;
      const heightCm = Math.max(1, Number(moduleState?.heightCm));
      const defaultCenterM = WALL_OVERLAY_DEFAULT_CENTER_CM / 100;
      const absoluteHeightCm = (hit.y - ACTIVE_PLATFORM_HEIGHT_M) * 100;
      const rawOffsetCm = (hit.y - ACTIVE_PLATFORM_HEIGHT_M - defaultCenterM) * 100;
      const zCm = clampWallOverlayZCm(rawOffsetCm, heightCm);

      const supportVertical = isVerticalModuleRotation(supportRotationZDeg);
      // Use the picked surface only for the along-panel coordinate and height.
      // Along the panel thickness axis, keep the overlay on the support module's
      // center line. createTvModule already offsets the 5 cm TV body to the wall face;
      // feeding the visible face coordinate here would apply that offset twice and
      // leave a visible gap between a free panel and the TV.
      const supportCenterXCm = Number(pointedModuleState.placement.xCm || 0);
      const supportCenterYCm = Number(pointedModuleState.placement.yCm || 0);

      return {
        wallId: 'free',
        pointerXCm: supportVertical ? supportCenterXCm : hit.x * 100,
        pointerYCm: supportVertical ? hit.z * 100 : supportCenterYCm,
        rotationZDeg,
        zCm,
        absoluteHeightCm,
        freePanelSupport: true,
        supportModuleId: pointedModuleState.id,
      };
    }

    const allowedWalls = getAllowedWallIds(stageLayout.standType)
      .filter((wallId) => wallId === 'back' || wallId === 'left' || wallId === 'right');
    const targetWallId = allowedWalls.includes(preferredWallId) ? preferredWallId : null;
    const candidateWalls = allowedWalls;
    const intersections = [];

    candidateWalls.forEach((wallId) => {
      let plane;
      if (wallId === 'back') {
        plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      } else if (wallId === 'left') {
        plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
      } else {
        plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -stageLayout.widthM);
      }

      const hit = new THREE.Vector3();
      if (!overlayRaycaster.ray.intersectPlane(plane, hit)) return;
      const relativeY = hit.y - ACTIVE_PLATFORM_HEIGHT_M;
      if (relativeY < 0 || relativeY > STAND_DIMENSIONS.height) return;
      if (wallId === 'back' && (hit.x < 0 || hit.x > stageLayout.widthM)) return;
      if ((wallId === 'left' || wallId === 'right') && (hit.z < 0 || hit.z > stageLayout.depthM)) return;

      intersections.push({ wallId, hit, distance: hit.distanceTo(overlayRaycaster.ray.origin) });
    });

    if (!intersections.length) return null;
    intersections.sort((a, b) => a.distance - b.distance);
    const preferredIntersection = targetWallId
      ? intersections.find((entry) => entry.wallId === targetWallId)
      : null;
    const { wallId, hit } = preferredIntersection ?? intersections[0];
    const rotationZDeg = wallId === 'left' ? 90 : (wallId === 'right' ? 270 : 0);
    const pointerXCm = wallId === 'right' ? stageLayout.widthCm : Math.max(0, hit.x * 100);
    const pointerYCm = wallId === 'back' ? 0 : Math.max(0, hit.z * 100);

    const heightCm = Math.max(1, Number(moduleState?.heightCm));
    const defaultCenterM = WALL_OVERLAY_DEFAULT_CENTER_CM / 100;
    const absoluteHeightCm = (hit.y - ACTIVE_PLATFORM_HEIGHT_M) * 100;
    const rawOffsetCm = (hit.y - ACTIVE_PLATFORM_HEIGHT_M - defaultCenterM) * 100;
    const zCm = clampWallOverlayZCm(rawOffsetCm, heightCm);

    return { wallId, pointerXCm, pointerYCm, rotationZDeg, zCm, absoluteHeightCm };
  }

  function previewPanelSeamOverlayDrag(moduleState, clientX, clientY, preferredWallId = null) {
    const wallPoint = getWallOverlayDragPoint(clientX, clientY, preferredWallId, moduleState);
    if (!wallPoint) {
      disposePlacementGhost();
      const message = 'Rafı duvar veya panel üzerine bırak.';
      showPlacementFeedback(message, { clientX, clientY });
      return { ok: false, message };
    }

    const snapped = snapPanelSeamOverlayPlacement({
      moduleState,
      wallPoint,
      modules: getRenderedModuleStates(),
    });
    showPlacementGhost(snapped.resolvedModuleState ?? moduleState, snapped.placement, snapped.ok);
    if (snapped.ok) clearPlacementFeedback();
    else {
      showPlacementFeedback(snapped.message ?? 'Rafı iki panel arasındaki birleşime bırak.', {
        clientX,
        clientY,
      });
    }

    return {
      ok: snapped.ok,
      resolvedModuleState: snapped.resolvedModuleState,
      placement: { ...snapped.placement },
      message: snapped.message ?? null,
      plan: {
        ok: snapped.ok,
        message: snapped.message ?? null,
        movingPlacement: { ...snapped.placement },
        placements: snapped.ok
          ? new Map([[moduleState.id, { ...snapped.placement }]])
          : new Map(),
      },
      snap: { mode: 'wall-overlay', wallId: wallPoint.wallId, requires: 'shelf-rail' },
    };
  }

  function previewCatalogModuleDrag(
    moduleState,
    clientX,
    clientY,
    preferredRotationZDeg = 0,
    rotationLocked = false,
  ) {
    if (isWallOverlayModule(moduleState.type)) {
      if (usesPanelSeamOverlaySnap(moduleState)) {
        const pointedModule = pickModuleAt(clientX, clientY)?.moduleGroup?.userData?.moduleState;
        const preferredWallId = ['back', 'left', 'right'].includes(pointedModule?.placement?.wallId)
          ? pointedModule.placement.wallId
          : null;
        return previewPanelSeamOverlayDrag(moduleState, clientX, clientY, preferredWallId);
      }
      const pointedModule = pickModuleAt(clientX, clientY)?.moduleGroup?.userData?.moduleState;
      const pointedOnWall = ['back', 'left', 'right'].includes(pointedModule?.placement?.wallId);
      if (!pointedOnWall) {
        const free = getFreeTvPlacement(clientX, clientY, moduleState, preferredRotationZDeg);
        const placement = free.placement;
        if (!placement) {
          disposePlacementGhost();
          const message = free.message ?? formatWallOverlayFeedback('drop-on-stand', getItem(moduleState.itemKey));
          showPlacementFeedback(message, { clientX, clientY });
          return { ok: false, message };
        }
        const plan = {
          ok: true,
          message: null,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        };
        showPlacementGhost(moduleState, placement, true);
        clearPlacementFeedback();
        return {
          ok: true,
          placement: { ...placement },
          message: null,
          plan,
          snap: { mode: 'free' },
        };
      }
      const wallPoint = getWallOverlayDragPoint(clientX, clientY, pointedModule.placement.wallId, moduleState);
      if (!wallPoint) {
        disposePlacementGhost();
        const message = formatWallOverlayFeedback('surface-failed', getItem(moduleState.itemKey));
        showPlacementFeedback(message, { clientX, clientY });
        return { ok: false, message };
      }
      const snapped = snapPlacementToStand({
        standType: stageLayout.standType,
        moduleType: moduleState.type,
        shape: moduleState.shape,
        widthCm: moduleState.widthCm,
        depthCm: moduleState.depthCm,
        forceFree: wallPoint.freePanelSupport === true,
        pointerXCm: wallPoint.pointerXCm,
        pointerYCm: wallPoint.pointerYCm,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
        preferredRotationZDeg: wallPoint.rotationZDeg,
        rotationLocked: true,
      });
      if (!snapped.ok || !snapped.placement) {
        disposePlacementGhost();
        const message = snapped.message ?? formatWallOverlayFeedback('wall-place-failed', getItem(moduleState.itemKey));
        showPlacementFeedback(message, { clientX, clientY });
        return { ok: false, message };
      }
      const placement = withItemZ(moduleState, { ...snapped.placement }, wallPoint.zCm);
      const plan = {
        ok: true,
        message: null,
        movingPlacement: { ...placement },
        placements: new Map([[moduleState.id, { ...placement }]]),
      };
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return {
        ok: true,
        placement: { ...placement },
        message: null,
        plan,
        snap: { mode: 'wall-overlay', wallId: wallPoint.wallId },
      };
    }
    if (!stageLayout || !moduleState) {
      disposePlacementGhost();
      const message = 'Önce stand alanını oluştur.';
      showPlacementFeedback(message, { clientX, clientY });
      return { ok: false, message };
    }

    const ground = getGroundPoint(clientX, clientY);
    if (!ground) {
      disposePlacementGhost();
      const message = 'Modülü aktif stand alanına bırak.';
      showPlacementFeedback(message, { clientX, clientY });
      return { ok: false, message };
    }

    const snapped = snapPlacementToStand({
      standType: stageLayout.standType,
      moduleType: moduleState.type,
      shape: moduleState.shape,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      forceFree: isFloorFixtureType(moduleState.type),
      pointerXCm: ground.xCm,
      pointerYCm: ground.yCm,
      standXCm: stageLayout.widthCm,
      standYCm: stageLayout.depthCm,
      preferredRotationZDeg,
      rotationLocked,
    });

    if (!snapped.ok || !snapped.placement) {
      disposePlacementGhost();
      const message = snapped.message ?? 'Bu konuma modül yerleştirilemedi.';
      showPlacementFeedback(message, { clientX, clientY });
      return {
        ok: false,
        message,
      };
    }

    if (isWallOverlayModule(moduleState.type)) {
      const placement = withItemZ(moduleState, { ...snapped.placement });
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return {
        ok: true,
        placement,
        message: null,
        plan: {
          ok: true,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        },
        snap: { mode: 'wall-overlay' },
      };
    }

    if (isTopFixtureType(moduleState.type)) {
      const isFreeTopFixture = snapped.placement.wallId === 'free';
      const placement = withItemZ(
        moduleState,
        snapTopFixturePlacement(
        snapped.placement,
        ground,
        moduleState.widthCm,
        moduleState,
        ),
      );
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return {
        ok: true,
        placement: { ...placement },
        message: null,
        plan: {
          ok: true,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        },
        snap: { mode: isFreeTopFixture ? 'top-free' : 'top-wall' },
      };
    }

    const renderedModules = getRenderedModuleStates();
    const magneticSnap = snapPlacementToModules({
      moduleId: moduleState.id,
      moduleType: moduleState.type,
      itemKey: moduleState.itemKey,
      heightCm: moduleState.heightCm,
      shape: moduleState.shape,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      forceFree: isFloorFixtureType(moduleState.type),
      pointerXCm: ground.xCm,
      pointerYCm: ground.yCm,
      rotationZDeg: preferredRotationZDeg,
      modules: renderedModules,
      standType: stageLayout.standType,
      standXCm: stageLayout.widthCm,
      standYCm: stageLayout.depthCm,
    });
    // short-up-joint (dikme): birleşime yakınsa yapışır, değilse sahneye serbest bırakılır.
    const desiredPlacement = withItemZ(moduleState, magneticSnap?.placement ?? snapped.placement);

    let plan;
    if (desiredPlacement.wallId === 'free') {
      const validation = validatePlacementAgainstModules({
        placement: desiredPlacement,
        widthCm: moduleState.widthCm,
        depthCm: moduleState.depthCm,
        moduleId: moduleState.id,
        moduleType: moduleState.type,
        itemKey: moduleState.itemKey,
        heightCm: moduleState.heightCm,
      shape: moduleState.shape,
        modules: renderedModules,
        standType: stageLayout.standType,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
        ...snapCollisionExemption(magneticSnap),
      });
      plan = {
        ok: validation.ok,
        message: validation.message ?? null,
        movingPlacement: { ...desiredPlacement },
        placements: validation.ok
          ? new Map([[moduleState.id, { ...desiredPlacement }]])
          : new Map(),
      };
    } else {
      plan = planContinuousModuleInsert({
        modules: renderedModules,
        insertedModule: moduleState,
        desiredPlacement,
        standType: stageLayout.standType,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
        ...snapCollisionExemption(magneticSnap),
      });
    }
    // Zincire ekleme kilitli bir modülü kaydıracaksa bırakma reddedilir.
    plan = guardPlanAgainstLocks(plan, renderedModules);

    const previewPlacement = plan.ok && plan.movingPlacement
      ? plan.movingPlacement
      : desiredPlacement;
    showPlacementGhost(moduleState, previewPlacement, plan.ok);
    if (plan.ok) clearPlacementFeedback();
    else showPlacementFeedback(plan.message ?? 'Bu konuma modül yerleştirilemez.', { clientX, clientY });
    return {
      ok: plan.ok,
      placement: { ...previewPlacement },
      message: plan.message ?? null,
      plan,
      snap: magneticSnap ? {
        mode: magneticSnap.mode,
        targetModuleId: magneticSnap.targetModuleId,
        snapKind: magneticSnap.snapKind,
      } : null,
    };
  }

  function dropCatalogModuleDrag(
    moduleState,
    clientX,
    clientY,
    preferredRotationZDeg = 0,
    rotationLocked = false,
  ) {
    const result = previewCatalogModuleDrag(
      moduleState,
      clientX,
      clientY,
      preferredRotationZDeg,
      rotationLocked,
    );
    disposePlacementGhost();
    if (result.ok && result.resolvedModuleState) Object.assign(moduleState, result.resolvedModuleState);
    if (result.ok) clearPlacementFeedback();
    else showPlacementFeedback(result.message ?? 'Bu konuma modül yerleştirilemez.', {
      clientX,
      clientY,
      durationMs: 1800,
    });
    return result;
  }

  function clearCatalogModuleDrag() {
    disposePlacementGhost();
    clearPlacementFeedback();
  }

  function updatePlacementDrag(event) {
    if (!dragSession || !stageLayout) return;
    const distance = Math.hypot(
      event.clientX - dragSession.startClientX,
      event.clientY - dragSession.startClientY,
    );
    if (!dragSession.dragging && distance < DRAG_THRESHOLD_PX) return;

    // Kilitli modül sürüklenmez: kamera da dönmez, yalnız uyarı gösterilir.
    // Sürükleme başlamadığı için bırakınca modül normal tıklama gibi seçilir.
    if (dragSession.locked) {
      if (!dragSession.lockedWarned) {
        dragSession.lockedWarned = true;
        showPlacementFeedback(MODULE_LOCKED_MESSAGE, {
          clientX: event.clientX,
          clientY: event.clientY,
          durationMs: 1800,
        });
      }
      return;
    }

    if (dragSession.groupId) {
      updateGroupDrag(event);
      return;
    }

    dragSession.dragging = true;
    dragSession.lastClientX = event.clientX;
    dragSession.lastClientY = event.clientY;
    dragSession.moduleGroup.visible = false;
    updateDragBadge(dragSession.moduleState, event.clientX, event.clientY);

    const moduleState = dragSession.moduleState;

    if (isWallOverlayModule(moduleState.type)) {
      if (usesPanelSeamOverlaySnap(moduleState)) {
        const currentWallId = ['back', 'left', 'right'].includes(dragSession.preview?.placement?.wallId)
          ? dragSession.preview.placement.wallId
          : (['back', 'left', 'right'].includes(moduleState.placement?.wallId) ? moduleState.placement.wallId : null);
        const result = previewPanelSeamOverlayDrag(
          moduleState,
          event.clientX,
          event.clientY,
          currentWallId,
        );
        if (!result.placement) {
          dragSession.preview = null;
          return;
        }
        dragSession.preview = {
          placement: result.placement,
          resolvedModuleState: result.resolvedModuleState,
          valid: result.ok,
          message: result.message ?? null,
          plan: result.plan,
          snap: result.snap,
        };
        return;
      }
      const currentWallId = ['back', 'left', 'right'].includes(dragSession.preview?.placement?.wallId)
        ? dragSession.preview.placement.wallId
        : (['back', 'left', 'right'].includes(moduleState.placement?.wallId) ? moduleState.placement.wallId : null);
      const wallPoint = getWallOverlayDragPoint(
        event.clientX,
        event.clientY,
        currentWallId,
        moduleState,
      );
      if (!wallPoint) {
        const free = getFreeTvPlacement(
          event.clientX,
          event.clientY,
          moduleState,
          dragSession.preferredRotationZDeg,
        );
        const placement = free.placement;
        if (!placement) {
          disposePlacementGhost();
          dragSession.preview = null;
          showPlacementFeedback(free.message ?? formatWallOverlayFeedback('drag-on-stand', getItem(moduleState.itemKey)), {
            clientX: event.clientX,
            clientY: event.clientY,
          });
          return;
        }
        dragSession.preview = {
          placement,
          valid: true,
          message: null,
          plan: {
            ok: true,
            movingPlacement: { ...placement },
            placements: new Map([[moduleState.id, { ...placement }]]),
          },
          snap: { mode: 'free' },
        };
        showPlacementGhost(moduleState, placement, true);
        clearPlacementFeedback();
        return;
      }
      const snapped = snapPlacementToStand({
        standType: stageLayout.standType,
        moduleType: moduleState.type,
        shape: moduleState.shape,
        widthCm: moduleState.widthCm,
        depthCm: moduleState.depthCm,
        forceFree: wallPoint.freePanelSupport === true,
        pointerXCm: wallPoint.pointerXCm,
        pointerYCm: wallPoint.pointerYCm,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
        preferredRotationZDeg: wallPoint.rotationZDeg,
        rotationLocked: true,
      });
      if (!snapped.ok || !snapped.placement) {
        dragSession.preview = null;
        disposePlacementGhost();
        showPlacementFeedback(snapped.message ?? formatWallOverlayFeedback('wall-move-failed', getItem(moduleState.itemKey)), {
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }
      const placement = withItemZ(moduleState, { ...snapped.placement }, wallPoint.zCm);
      dragSession.preview = {
        placement,
        valid: true,
        message: null,
        plan: {
          ok: true,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        },
        snap: { mode: 'wall-overlay', wallId: wallPoint.wallId },
      };
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return;
    }

    if (isTopFixtureType(moduleState.type)) {
      const currentWallId = dragSession.preview?.placement?.wallId
        ?? moduleState.placement?.wallId
        ?? 'back';
      const dragZCm = Number.isFinite(Number(moduleState.placement?.zCm))
        ? Number(moduleState.placement.zCm)
        : resolveItemDefaultZCm(moduleState);
      const wallPoint = getTopFixtureDragPoint(
        event.clientX,
        event.clientY,
        currentWallId,
        clampMountBottomZCm(dragZCm),
      );
      if (!wallPoint) {
        disposePlacementGhost();
        dragSession.preview = null;
        showPlacementFeedback('Projektörü üst profil boyunca sürükle.', {
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }

      const isFreeTopFixture = wallPoint.wallId === 'free';
      const wallRotationZDeg = wallPoint.wallId === 'left'
        ? 90
        : (wallPoint.wallId === 'right' ? 270 : dragSession.preferredRotationZDeg);
      const basePlacement = {
        ...(moduleState.placement ?? {}),
        wallId: wallPoint.wallId,
        rotationZDeg: wallRotationZDeg,
      };

      let placement;
      if (isFreeTopFixture) {
        const stepCm = 20;
        const widthCm = Math.max(0, Number(moduleState.widthCm) || 0);
        const vertical = isVerticalModuleRotation(wallRotationZDeg);
        const snap20 = (value) => Math.round(Number(value) / stepCm) * stepCm;
        const maxX = Math.max(0, Number(stageLayout.widthCm) - (vertical ? 0 : widthCm));
        const maxY = Math.max(0, Number(stageLayout.depthCm) - (vertical ? widthCm : 0));
        const candidate = {
          ...basePlacement,
          xCm: Math.min(maxX, Math.max(0, snap20(wallPoint.xCm))),
          yCm: Math.min(maxY, Math.max(0, snap20(wallPoint.yCm))),
          wallId: 'free',
        };
        placement = withItemZ(
          moduleState,
          snapPlacementToItemAnchor(moduleState, candidate, getRenderedModuleStates())
            ?? { ...candidate, zCm: resolveItemDefaultZCm(moduleState) },
        );
      } else {
        dragSession.preferredRotationZDeg = wallRotationZDeg;
        placement = withItemZ(
          moduleState,
          snapTopFixturePlacement(
          basePlacement,
          wallPoint,
          moduleState.widthCm,
          moduleState,
          ),
        );
      }
      dragSession.preview = {
        placement,
        valid: true,
        message: null,
        plan: {
          ok: true,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        },
        snap: { mode: 'top-wall' },
      };
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return;
    }

    const anchoredPoint = moduleState.placement?.wallId === 'free'
      ? getDragPlanePoint(event.clientX, event.clientY, dragSession.dragPlaneY)
      : null;
    const ground = anchoredPoint
      ? {
          xCm: anchoredPoint.xCm + Number(dragSession.dragAnchorOffsetXCm || 0),
          yCm: anchoredPoint.yCm + Number(dragSession.dragAnchorOffsetYCm || 0),
        }
      : getGroundPoint(event.clientX, event.clientY);
    if (!ground) {
      disposePlacementGhost();
      dragSession.preview = null;
      showPlacementFeedback('Modülü aktif stand alanına bırak.', {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }

    const snapped = snapPlacementToStand({
      standType: stageLayout.standType,
      moduleType: moduleState.type,
      shape: moduleState.shape,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      forceFree: isFloorFixtureType(moduleState.type),
      pointerXCm: ground.xCm,
      pointerYCm: ground.yCm,
      standXCm: stageLayout.widthCm,
      standYCm: stageLayout.depthCm,
      preferredRotationZDeg: dragSession.preferredRotationZDeg,
      rotationLocked: dragSession.rotationLocked,
    });

    if (!snapped.ok || !snapped.placement) {
      dragSession.preview = null;
      disposePlacementGhost();
      showPlacementFeedback(snapped.message ?? 'Bu konuma modül yerleştirilemez.', {
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }

    if (isWallOverlayModule(moduleState.type)) {
      const placement = withItemZ(moduleState, { ...snapped.placement });
      dragSession.preview = {
        placement,
        valid: true,
        message: null,
        plan: {
          ok: true,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        },
        snap: { mode: 'wall-overlay' },
      };
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return;
    }

    if (isTopFixtureType(moduleState.type)) {
      const placement = withItemZ(
        moduleState,
        snapTopFixturePlacement(
        snapped.placement,
        ground,
        moduleState.widthCm,
        moduleState,
        ),
      );
      dragSession.preview = {
        placement,
        valid: true,
        message: null,
        plan: {
          ok: true,
          movingPlacement: { ...placement },
          placements: new Map([[moduleState.id, { ...placement }]]),
        },
        snap: { mode: 'top-wall' },
      };
      showPlacementGhost(moduleState, placement, true);
      clearPlacementFeedback();
      return;
    }

    const renderedModules = getRenderedModuleStates();
    const magneticSnap = snapPlacementToModules({
      moduleId: moduleState.id,
      moduleType: moduleState.type,
      itemKey: moduleState.itemKey,
      heightCm: moduleState.heightCm,
      shape: moduleState.shape,
      widthCm: moduleState.widthCm,
      depthCm: moduleState.depthCm,
      forceFree: isFloorFixtureType(moduleState.type),
      pointerXCm: ground.xCm,
      pointerYCm: ground.yCm,
      rotationZDeg: dragSession.preferredRotationZDeg,
      modules: renderedModules,
      standType: stageLayout.standType,
      standXCm: stageLayout.widthCm,
      standYCm: stageLayout.depthCm,
    });
    const desiredPlacement = withItemZ(moduleState, magneticSnap?.placement ?? snapped.placement);

    let plan;
    if (desiredPlacement.wallId === 'free') {
      const validation = validatePlacementAgainstModules({
        placement: desiredPlacement,
        widthCm: moduleState.widthCm,
        depthCm: moduleState.depthCm,
        moduleId: moduleState.id,
        moduleType: moduleState.type,
        itemKey: moduleState.itemKey,
        heightCm: moduleState.heightCm,
      shape: moduleState.shape,
        modules: renderedModules,
        standType: stageLayout.standType,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
        ...snapCollisionExemption(magneticSnap),
      });
      plan = {
        ok: validation.ok,
        message: validation.message ?? null,
        movingPlacement: { ...desiredPlacement },
        placements: validation.ok
          ? new Map([[moduleState.id, { ...desiredPlacement }]])
          : new Map(),
      };
    } else {
      plan = planContinuousModuleMove({
        modules: renderedModules,
        movingModuleId: moduleState.id,
        desiredPlacement,
        standType: stageLayout.standType,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
        ...snapCollisionExemption(magneticSnap),
      });
    }
    // Taşıma zinciri kaydırıp kilitli bir komşuyu oynatacaksa reddedilir.
    plan = guardPlanAgainstLocks(plan, renderedModules);

    const previewPlacement = plan.ok && plan.movingPlacement
      ? plan.movingPlacement
      : desiredPlacement;
    dragSession.preview = {
      placement: previewPlacement,
      valid: plan.ok,
      message: plan.message ?? null,
      plan,
      snap: magneticSnap ? {
        mode: magneticSnap.mode,
        targetModuleId: magneticSnap.targetModuleId,
        snapKind: magneticSnap.snapKind,
      } : null,
    };
    showPlacementGhost(moduleState, previewPlacement, plan.ok);
    if (plan.ok) clearPlacementFeedback();
    else showPlacementFeedback(plan.message ?? 'Bu konuma modül yerleştirilemez.', {
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function groupStandLimits() {
    if (!stageLayout) return null;
    return { standType: stageLayout.standType, standXCm: stageLayout.widthCm, standYCm: stageLayout.depthCm };
  }

  function snapGroupStepCm(value) {
    return Math.round((Number(value) || 0) / GROUP_MOVE_STEP_CM) * GROUP_MOVE_STEP_CM;
  }

  /** Grup taşıma planı; kendi kilidi olan bir üye varsa grup taşınmaz. */
  function planRenderedGroupTranslate(groupId, dxCm, dyCm) {
    const modules = getRenderedModuleStates();
    const ownLocked = getGroupMembers(modules, groupId).filter((member) => member.locked === true);
    if (ownLocked.length) return { ok: false, message: describeLockedBlock(ownLocked), placements: new Map() };
    return planGroupTranslate(modules, groupId, dxCm, dyCm, groupStandLimits());
  }

  function planRenderedGroupRotate(groupId, deltaDeg) {
    const modules = getRenderedModuleStates();
    const ownLocked = getGroupMembers(modules, groupId).filter((member) => member.locked === true);
    if (ownLocked.length) return { ok: false, message: describeLockedBlock(ownLocked), placements: new Map() };
    return planGroupRotate(modules, groupId, deltaDeg, groupStandLimits());
  }

  function showGroupPlacements(placements) {
    placements.forEach((placement, moduleId) => {
      const moduleGroup = findModuleGroupById(moduleId);
      const moduleState = moduleGroup?.userData?.moduleState;
      if (moduleGroup && moduleState) applyPlacementToGroup(moduleGroup, placement, moduleState.widthCm);
    });
    requestEditorRender();
  }

  function commitGroupPlacements(placements) {
    placements.forEach((placement, moduleId) => {
      const moduleGroup = findModuleGroupById(moduleId);
      const moduleState = moduleGroup?.userData?.moduleState;
      if (!moduleGroup || !moduleState) return;
      moduleState.placement = { ...placement };
      moduleGroup.userData.placement = { ...placement };
      applyPlacementToGroup(moduleGroup, placement, moduleState.widthCm);
    });
    requestEditorRender();
  }

  function restoreGroupPlacements(groupId) {
    getGroupMembers(getRenderedModuleStates(), groupId).forEach((member) => {
      const moduleGroup = findModuleGroupById(member.id);
      if (moduleGroup && member.placement) applyPlacementToGroup(moduleGroup, member.placement, member.widthCm);
    });
    requestEditorRender();
  }

  // Grup sürükleme: üyeler gerçek yerinde canlı kayar; stand dışına çıkan adım
  // uygulanmaz, grup son geçerli konumda kalır ve uyarı gösterilir.
  function updateGroupDrag(event) {
    const session = dragSession;
    session.dragging = true;
    session.lastClientX = event.clientX;
    session.lastClientY = event.clientY;
    const point = getDragPlanePoint(event.clientX, event.clientY, session.dragPlaneY);
    if (!session.groupStartPoint) session.groupStartPoint = point;
    if (!point || !session.groupStartPoint) return;
    const dxCm = snapGroupStepCm(point.xCm - session.groupStartPoint.xCm);
    const dyCm = snapGroupStepCm(point.yCm - session.groupStartPoint.yCm);
    const plan = planRenderedGroupTranslate(session.groupId, dxCm, dyCm);
    if (!plan.ok) {
      if (session.groupFeedback !== plan.message) {
        session.groupFeedback = plan.message;
        showPlacementFeedback(plan.message, { clientX: event.clientX, clientY: event.clientY, durationMs: 1800 });
      }
      return;
    }
    session.groupFeedback = null;
    session.groupPreview = plan;
    clearPlacementFeedback();
    showGroupPlacements(plan.placements);
  }

  function finishGroupDrag(session, event) {
    const wasDragging = session.dragging;
    if (wasDragging && session.groupPreview?.ok) {
      commitGroupPlacements(session.groupPreview.placements);
      clearSelection();
    } else if (wasDragging) {
      restoreGroupPlacements(session.groupId);
    }
    dragSession = null;
    controls.enabled = true;
    disposeDragBadge();
    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    return wasDragging;
  }

  /** Ok tuşu: grubu ekran yönüne en yakın stand ekseninde bir adım kaydırır. */
  function moveGroupByArrow(moduleGroup, moduleState, arrowScreenDirection) {
    const groupId = getModuleGroupId(moduleState);
    const origin = new THREE.Vector3();
    moduleGroup.getWorldPosition(origin);
    const projectedOrigin = origin.clone().project(camera);
    const axes = [
      { dxCm: GROUP_MOVE_STEP_CM, dyCm: 0, world: new THREE.Vector3(0.5, 0, 0) },
      { dxCm: -GROUP_MOVE_STEP_CM, dyCm: 0, world: new THREE.Vector3(-0.5, 0, 0) },
      { dxCm: 0, dyCm: GROUP_MOVE_STEP_CM, world: new THREE.Vector3(0, 0, 0.5) },
      { dxCm: 0, dyCm: -GROUP_MOVE_STEP_CM, world: new THREE.Vector3(0, 0, -0.5) },
    ];
    const best = axes
      .map((axis) => {
        const projected = origin.clone().add(axis.world).project(camera);
        const delta = new THREE.Vector2(projected.x - projectedOrigin.x, projected.y - projectedOrigin.y);
        return { ...axis, score: delta.lengthSq() > 1e-12 ? delta.normalize().dot(arrowScreenDirection) : -Infinity };
      })
      .sort((a, b) => b.score - a.score)[0];
    if (!best || !Number.isFinite(best.score)) return;
    const plan = planRenderedGroupTranslate(groupId, best.dxCm, best.dyCm);
    if (!plan.ok) {
      showPlacementFeedback(plan.message, { durationMs: 1800 });
      return;
    }
    clearPlacementFeedback();
    commitGroupPlacements(plan.placements);
  }

  function finishPlacementDrag(event) {
    if (!dragSession) return false;
    if (dragSession.groupId) return finishGroupDrag(dragSession, event);

    const session = dragSession;
    const wasDragging = session.dragging;
    const preview = session.preview;
    session.moduleGroup.visible = true;

    if (wasDragging && preview?.valid) {
      clearPlacementFeedback();
      const plannedPlacements = preview.plan?.placements instanceof Map
        ? preview.plan.placements
        : new Map([[session.moduleState.id, { ...preview.placement }]]);

      plannedPlacements.forEach((placement, moduleId) => {
        const moduleGroup = wallRoot.children.find((group) => (
          group.userData?.moduleState?.id === moduleId
          || group.userData?.moduleId === moduleId
        ));
        const moduleState = moduleGroup?.userData?.moduleState;
        if (!moduleGroup || !moduleState) return;

        if (moduleId === session.moduleState.id && preview.resolvedModuleState
          && moduleState.itemKey !== preview.resolvedModuleState.itemKey) {
          Object.assign(moduleState, preview.resolvedModuleState);
          const replacement = createShelfModule(moduleState, moduleGroup.userData.moduleIndex);
          surfaceMeshes = surfaceMeshes.filter((surface) => surface.userData?.moduleId !== moduleId);
          disposeObject(moduleGroup);
          moduleGroup.clear();
          moduleGroup.add(...replacement.group.children.slice());
          Object.assign(moduleGroup.userData, replacement.group.userData);
          surfaceMeshes.push(...replacement.surfaces);
        }
        moduleState.placement = { ...placement };
        moduleGroup.userData.placement = { ...placement };
        applyPlacementToGroup(moduleGroup, placement, moduleState.widthCm);
      });
      clearSelection();
    } else if (wasDragging && preview && !preview.valid) {
      showPlacementFeedback(preview.message ?? 'Bu konuma modül yerleştirilemez.', {
        clientX: event.clientX,
        clientY: event.clientY,
        durationMs: 1800,
      });
    }

    dragSession = null;
    controls.enabled = true;
    disposePlacementGhost();
    disposeDragBadge();

    try {
      renderer.domElement.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }

    return wasDragging;
  }

  function normalizeMeshes(meshOrMeshes) {
    if (!meshOrMeshes) return [];
    if (Array.isArray(meshOrMeshes)) return meshOrMeshes;
    if (meshOrMeshes instanceof Set) return [...meshOrMeshes];
    return [meshOrMeshes];
  }

  function applyColor(meshOrMeshes, hexColor) {
    requestEditorRender();
    const meshes = normalizeMeshes(meshOrMeshes);
    const fabricGroupIds = new Set(
      meshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean),
    );
    fabricGroupIds.forEach((groupId) => {
      surfaceMeshes.forEach((surface) => {
        if (surface.userData.surfaceState?.fabricGroupId !== groupId) return;
        writePersistentSurface(surface, (state) => {
          state.fabricColor = hexColor;
          state.fabricImageAssetId = null;
          state.fabricImageFit = 'cover';
          delete state.fabricImageWidthCm;
          delete state.fabricImageHeightCm;
          state.fabricLightingOn = false;
        });
      });
    });

    meshes.filter((mesh) => !mesh.userData.surfaceState?.fabricGroupId).forEach((mesh) => {
      if (!mesh?.material || mesh.userData.acceptsColor === false) return;
      writePersistentSurface(mesh, (surfaceState) => {
        applyColorOverride(surfaceState, hexColor);
      });
      const surfaceState = mesh.userData.surfaceState;

      const colorTargets = mesh.userData.colorTargets?.length
        ? mesh.userData.colorTargets
        : [mesh];

      if (
        mesh.userData.moduleType === 'sofa-set-classic'
        || mesh.userData.moduleType === 'sofa-single-classic'
        || mesh.userData.moduleType === 'sofa-double-classic'
      ) {
        colorTargets.forEach((target) => applyBeigeSofaBodyColor(target, hexColor));
        return;
      }

      colorTargets.forEach((target) => {
        if (!target?.material) return;
        target.material.map?.dispose?.();
        target.material.map = null;
        target.material.color.set(surfaceState?.isGlass ? GLASS_APPEARANCE.color : hexColor);
        target.material.needsUpdate = true;
      });
    });
    if (fabricGroupIds.size) rebuildFabricOverlays();
  }

  function clearFabricOverlays() {
    fabricOverlayMeshes.forEach((overlay) => {
      overlay.parent?.remove(overlay);
      overlay.geometry?.dispose?.();
      if (Array.isArray(overlay.material)) {
        overlay.material.forEach((material) => {
          material?.map?.dispose?.();
          material?.alphaMap?.dispose?.();
          material?.dispose?.();
        });
      } else {
        overlay.material?.map?.dispose?.();
        overlay.material?.alphaMap?.dispose?.();
        overlay.material?.dispose?.();
      }
    });
    fabricOverlayMeshes = [];
  }

  function suspendFabricSurface(surface, fabricType = 'lightbox') {
    if (!surface?.material) return;
    surface.material.map?.dispose?.();
    surface.material.map = null;
    surface.material.colorWrite = false;
    surface.material.depthWrite = false;
    surface.material.needsUpdate = true;
    const backing = surface.userData?.backing;
    // Lightbox arka paneli korur; Mesh deliklerinde gerçek sahnenin görünmesi için backing gizlenir.
    if (backing) backing.visible = fabricType !== 'mesh';
  }

  function restoreFabricSurface(surface) {
    if (!surface?.material) return;
    const state = surface.userData?.surfaceState;
    surface.material.colorWrite = true;
    surface.material.depthWrite = !Boolean(state?.isGlass);
    surface.material.needsUpdate = true;
    const backing = surface.userData?.backing;
    if (backing) backing.visible = true;

    if (state?.imageAssetId) {
      applyStoredImage(surface);
    } else {
      surface.material.color.set(state?.isGlass ? GLASS_APPEARANCE.color : (state?.color ?? '#ffffff'));
      surface.material.needsUpdate = true;
    }
  }


  function clearFabricState(surface, { restore = true } = {}) {
    if (!surface?.userData?.surfaceState) return;
    writePersistentSurface(surface, (state) => {
      clearFabricFields(state);
    });
    if (restore) restoreFabricSurface(surface);
  }

  function normalizeFabricOwnership() {
    const groups = new Map();
    surfaceMeshes.forEach((surface) => {
      const groupId = surface?.userData?.surfaceState?.fabricGroupId;
      if (!groupId) return;
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(surface);
    });

    groups.forEach((surfaces) => {
      const firstState = surfaces[0]?.userData?.surfaceState;
      if (!firstState) return;

      const currentSurfaceIds = surfaces
        .map((surface) => surface.userData?.surfaceId)
        .filter(Boolean);
      const ownerSurfaceIds = Array.isArray(firstState.fabricOwnerSurfaceIds)
        && firstState.fabricOwnerSurfaceIds.length
        ? [...new Set(firstState.fabricOwnerSurfaceIds.filter(Boolean))]
        : [...new Set(currentSurfaceIds)];
      const ownerSurfaceSet = new Set(ownerSurfaceIds);

      // A duplicated module may clone the old fabricGroupId. It must not silently
      // become part of the original physical fabric, so strip only unexpected clones.
      surfaces
        .filter((surface) => !ownerSurfaceSet.has(surface.userData?.surfaceId))
        .forEach((surface) => clearFabricState(surface));

      const ownedSurfaces = surfaces.filter(
        (surface) => ownerSurfaceSet.has(surface.userData?.surfaceId),
      );
      const actualSurfaceSet = new Set(
        ownedSurfaces.map((surface) => surface.userData?.surfaceId).filter(Boolean),
      );

      // If an original owner surface disappeared (module deleted/type changed), the
      // one-piece fabric no longer exists physically. Dissolve it instead of leaving
      // an orphaned or shortened overlay behind.
      if (ownerSurfaceIds.some((surfaceId) => !actualSurfaceSet.has(surfaceId))) {
        ownedSurfaces.forEach((surface) => clearFabricState(surface));
        return;
      }

      const ownerModuleIds = [...new Set(
        ownedSurfaces.map((surface) => surface.userData?.moduleId).filter(Boolean),
      )];
      ownedSurfaces.forEach((surface) => {
        writePersistentSurface(surface, (state) => {
          state.fabricOwnerSurfaceIds = [...ownerSurfaceIds];
          state.fabricOwnerModuleIds = [...ownerModuleIds];
        });
      });
    });
  }

  function getFabricMoveLock(moduleId) {
    if (!moduleId) return null;
    const groupIds = new Set(
      surfaceMeshes
        .filter((surface) => surface.userData?.moduleId === moduleId)
        .map((surface) => surface.userData?.surfaceState?.fabricGroupId)
        .filter(Boolean),
    );

    for (const groupId of groupIds) {
      const moduleIds = new Set(
        surfaceMeshes
          .filter((surface) => surface.userData?.surfaceState?.fabricGroupId === groupId)
          .map((surface) => surface.userData?.moduleId)
          .filter(Boolean),
      );
      if (moduleIds.size > 1) return { groupId, moduleIds: [...moduleIds] };
    }
    return null;
  }
  function createMeshBrandaAlphaMap(widthM, heightM) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;

    // Yaklaşık %31 açık alan: opak baskı yüzeyi korunur, yalnız delikler gerçek cutout olur.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#000000';
    const radius = 10.2;
    [16, 48].forEach((x) => {
      [16, 48].forEach((y) => {
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      });
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    // Yaklaşık %31 açık alan korunur; delikler yaklaşık 1 mm ölçeğine iner. Mipmap ve alpha-to-coverage açılı bakışta moiré/aliasing desenlerini bastırır.
    texture.repeat.set(
      Math.max(1, Number(widthM) * 300),
      Math.max(1, Number(heightM) * 300),
    );
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.generateMipmaps = false;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    return texture;
  }

  function applyFabricOverlayLighting(overlay, fabricState = {}) {
    const material = overlay?.material;
    if (!material) return;

    const fabricType = fabricState.fabricType === 'mesh' ? 'mesh' : 'lightbox';
    // Lightbox ışığı açıldığında daima %100 opak kalır. Mesh ise emissive kullanmaz.
    material.opacity = fabricType === 'mesh' ? MESH_FABRIC_OPACITY : 1;
    material.transparent = fabricType === 'mesh';
    material.depthWrite = fabricType !== 'mesh';
    if (fabricType === 'mesh') {
      material.emissiveMap = null;
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
      material.needsUpdate = true;
      return;
    }

    const lightingOn = Boolean(fabricState.fabricLightingOn);
    if (!lightingOn) {
      material.emissiveMap = null;
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
      material.needsUpdate = true;
      return;
    }

    if (material.map) {
      // Aynı baskı dokusu emissiveMap olarak kullanılır: görsel kendi içinden parlar,
      // fakat sahneye fiziksel ışık saçılmaz.
      material.emissive.set(0xffffff);
      material.emissiveMap = material.map;
      material.emissiveIntensity = 1.08;
    } else {
      material.emissiveMap = null;
      material.emissive.set(fabricState.fabricColor ?? fabricState.color ?? '#ffffff');
      material.emissiveIntensity = 0.82;
    }
    material.needsUpdate = true;
  }

  function loadFabricOverlayImage(overlay, assetId, fit = 'cover', sizeCm = null) {
    const assetUrl = getAssetUrl(assetId);
    if (!overlay?.material || !assetUrl) return;

    textureLoader.load(
      assetUrl,
      (sourceTexture) => {
        requestEditorRender();
        if (fit === 'size') {
          const image = sourceTexture.image;
          const widthCm = Number(sizeCm?.widthCm);
          const heightCm = resolveImageTileHeightCm(
            widthCm,
            sizeCm?.heightCm,
            image?.naturalWidth ?? image?.width,
            image?.naturalHeight ?? image?.height,
          );
          const planeWidth = Number(overlay.geometry?.parameters?.width) || 0;
          const planeHeight = Number(overlay.geometry?.parameters?.height) || 0;
          const tile = computeImageSizeTile(planeWidth * 100, planeHeight * 100, widthCm, heightCm);
          if (!tile) {
            sourceTexture.dispose();
            return;
          }
          sourceTexture.colorSpace = THREE.SRGBColorSpace;
          sourceTexture.wrapS = THREE.RepeatWrapping;
          sourceTexture.wrapT = THREE.RepeatWrapping;
          sourceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          sourceTexture.center.set(0, 0);
          sourceTexture.repeat.set(tile.repeatX, tile.repeatY);
          sourceTexture.offset.set(tile.offsetX, tile.offsetY);
          sourceTexture.rotation = 0;
          sourceTexture.needsUpdate = true;
          overlay.material.map?.dispose?.();
          overlay.material.map = sourceTexture;
          overlay.material.color.set(0xffffff);
          applyFabricOverlayLighting(overlay, overlay.userData.fabricState);
          return;
        }

        const image = sourceTexture.image;
        const imageWidth = Number(image?.naturalWidth || image?.videoWidth || image?.width) || 0;
        const imageHeight = Number(image?.naturalHeight || image?.videoHeight || image?.height) || 0;
        const planeWidth = Number(overlay.geometry?.parameters?.width) || 1;
        const planeHeight = Number(overlay.geometry?.parameters?.height) || 1;
        const targetAspect = Math.max(0.01, planeWidth / Math.max(planeHeight, 0.01));
        const maxCanvasSide = 1536;
        const canvas = document.createElement('canvas');
        if (targetAspect >= 1) {
          canvas.width = maxCanvasSide;
          canvas.height = Math.max(1, Math.round(maxCanvasSide / targetAspect));
        } else {
          canvas.height = maxCanvasSide;
          canvas.width = Math.max(1, Math.round(maxCanvasSide * targetAspect));
        }

        const context = canvas.getContext('2d');
        const layout = computeImageFit(
          imageWidth,
          imageHeight,
          canvas.width,
          canvas.height,
          fit,
        );
        if (!context || !layout) {
          sourceTexture.dispose();
          return;
        }

        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        // Lightbox baskısında emissive parlamanın yaptığı solmayı telafi et; Mesh baskıyı doğal bırak.
        context.filter = overlay.userData.fabricType === 'mesh'
          ? 'none'
          : 'saturate(1.08) contrast(1.06)';
        context.drawImage(
          image,
          layout.drawX,
          layout.drawY,
          layout.drawWidth,
          layout.drawHeight,
        );

        const fabricTexture = new THREE.CanvasTexture(canvas);
        fabricTexture.colorSpace = THREE.SRGBColorSpace;
        fabricTexture.needsUpdate = true;
        overlay.material.map?.dispose?.();
        overlay.material.map = fabricTexture;
        overlay.material.color.set(0xffffff);
        applyFabricOverlayLighting(overlay, overlay.userData.fabricState);
        sourceTexture.dispose();
      },
      undefined,
      () => {},
    );
  }

  function rebuildFabricOverlays() {
    requestEditorRender();
    clearFabricOverlays();
    normalizeFabricOwnership();

    const groups = new Map();
    surfaceMeshes.forEach((surface) => {
      if (surface?.userData?.selectionMode !== 'panel') return;
      const groupId = surface.userData.surfaceState?.fabricGroupId;
      if (!groupId) return;
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(surface);
    });

    if (!groups.size) return;

    groups.forEach((surfaces, groupId) => {
      if (!surfaces.length) return;
      const groupFabricType = surfaces[0]?.userData?.surfaceState?.fabricType === 'mesh'
        ? 'mesh'
        : 'lightbox';
      // Kaplama aktifken alttaki paneller yalnızca seçim proxy'si olarak kalır.
      // Mesh'te backing de gizlenir ki deliklerden gerçek sahne görünsün.
      surfaces.forEach((surface) => suspendFabricSurface(surface, groupFabricType));

      const moduleIds = new Set(
        surfaces.map((surface) => surface.userData?.moduleId).filter(Boolean),
      );
      const [singleModuleId] = moduleIds.size === 1 ? moduleIds : [];
      const singleModuleGroup = singleModuleId
        ? wallRoot.children.find((group) => (
            group.userData?.moduleState?.id === singleModuleId
            || group.userData?.moduleId === singleModuleId
          ))
        : null;
      const overlayParent = singleModuleGroup ?? wallRoot;
      overlayParent.updateWorldMatrix(true, true);
      const inverseOverlayParentQuaternion = overlayParent
        .getWorldQuaternion(new THREE.Quaternion())
        .invert();

      const first = surfaces[0];
      first.updateWorldMatrix(true, false);
      const surfaceQuaternion = first.getWorldQuaternion(new THREE.Quaternion());
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(surfaceQuaternion).normalize();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(surfaceQuaternion).normalize();
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(surfaceQuaternion).normalize();

      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;
      let planeN = 0;
      let validCount = 0;

      surfaces.forEach((surface) => {
        surface.updateWorldMatrix(true, false);
        const center = surface.getWorldPosition(new THREE.Vector3());
        const width = Number(surface.geometry?.parameters?.width) || 0;
        const height = Number(surface.geometry?.parameters?.height) || 0;
        const u = center.dot(right);
        const v = center.dot(up);
        minU = Math.min(minU, u - width / 2);
        maxU = Math.max(maxU, u + width / 2);
        minV = Math.min(minV, v - height / 2);
        maxV = Math.max(maxV, v + height / 2);
        planeN += center.dot(normal);
        validCount += 1;
      });

      if (!validCount || !Number.isFinite(minU) || !Number.isFinite(minV)) return;
      planeN /= validCount;
      const width = maxU - minU;
      const height = maxV - minV;
      if (width <= 0 || height <= 0) return;

      // Kutu blok yüzünde bez yüz düzlemine oturur: alttaki yüz renk/derinlik yazmadığı için
      // titreşmez, kenarda komşu yüzle sıfır açıklıkla kavuşur. Panellerde 6 mm önde kalır.
      const overlayOffsetM = surfaces.every((surface) => surface.userData?.moduleType === 'box-block') ? 0 : 0.006;
      const centerWorld = right.clone().multiplyScalar((minU + maxU) / 2)
        .add(up.clone().multiplyScalar((minV + maxV) / 2))
        .add(normal.clone().multiplyScalar(planeN + overlayOffsetM));

      const fabricState = first.userData.surfaceState ?? {};
      const fabricType = fabricState.fabricType === 'mesh' ? 'mesh' : 'lightbox';
      const fabricImageAssetId = fabricState.fabricImageAssetId ?? null;
      const fabricImageFit = fabricState.fabricImageFit === 'size'
        ? 'size'
        : (fabricState.fabricImageFit === 'contain' ? 'contain' : 'cover');
      const fabricColor = fabricState.fabricColor ?? fabricState.color ?? '#ffffff';
      const baseColor = new THREE.Color(fabricImageAssetId ? '#ffffff' : fabricColor);
      const overlayMaterial = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: fabricType === 'mesh' ? 0.92 : 0.86,
        metalness: 0,
        emissive: 0x000000,
        emissiveIntensity: 0,
        side: fabricType === 'mesh' ? THREE.DoubleSide : THREE.FrontSide,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      });
      if (fabricType === 'mesh') {
        // Mesh Lightbox gibi tek parça kalır; şeffaflık Cam panelin ön yüz kontratını kullanır.
        overlayMaterial.transparent = true;
        overlayMaterial.opacity = MESH_FABRIC_OPACITY;
        overlayMaterial.depthWrite = false;
      }
      const overlay = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        overlayMaterial,
      );
      overlay.position.copy(overlayParent.worldToLocal(centerWorld.clone()));
      overlay.quaternion.copy(inverseOverlayParentQuaternion.clone().multiply(surfaceQuaternion));
      overlay.castShadow = false;
      overlay.receiveShadow = true;
      overlay.renderOrder = 3;
      overlay.userData.kind = 'decoration';
      overlay.userData.role = fabricType === 'mesh' ? 'mesh-branda' : 'lightbox-fabric';
      overlay.userData.fabricType = fabricType;
      overlay.userData.fabricGroupId = groupId;
      overlay.userData.fabricState = fabricState;
      applyFabricOverlayLighting(overlay, fabricState);
      // Bez öndeki tek parça yüzeydir; seçim/raycast alttaki gerçek panellerden devam eder.
      overlay.raycast = () => {};
      overlayParent.add(overlay);
      fabricOverlayMeshes.push(overlay);
      if (fabricImageAssetId) {
        loadFabricOverlayImage(overlay, fabricImageAssetId, fabricImageFit, {
          widthCm: fabricState.fabricImageWidthCm,
          heightCm: fabricState.fabricImageHeightCm,
        });
      }
    });
  }

  function applyFabricMode(meshOrMeshes, enabled) {
    requestEditorRender();
    return applyFabricCoverMode(meshOrMeshes, enabled, 'lightbox');
  }

  function applyMeshMode(meshOrMeshes, enabled) {
    requestEditorRender();
    return applyFabricCoverMode(meshOrMeshes, enabled, 'mesh');
  }

  function applyFabricCoverMode(meshOrMeshes, enabled, fabricType = 'lightbox') {
    const resolvedFabricType = fabricType === 'mesh' ? 'mesh' : 'lightbox';
    const capabilityKey = resolvedFabricType === 'mesh' ? 'acceptsMesh' : 'acceptsLightbox';
    const meshes = normalizeMeshes(meshOrMeshes).filter(
      (mesh) => mesh?.userData?.[capabilityKey] === true && mesh.userData.surfaceState,
    );
    const fabric = Boolean(enabled);

    if (fabric) {
      applyGlassMode(meshes, false);
    }
    const fabricLabel = resolvedFabricType === 'mesh' ? 'Mesh Branda' : 'Lightbox Kumaş';

    if (fabric) {
      if (!meshes.length) {
        return { ok: false, message: `${fabricLabel} için panel seç.` };
      }

      const moduleIndices = meshes.map((mesh) => Number(mesh.userData.moduleIndex));
      const stripIndices = meshes.map((mesh) => Number(mesh.userData.stripIndex));
      const bounds = {
        minModuleIndex: Math.min(...moduleIndices),
        maxModuleIndex: Math.max(...moduleIndices),
        minStripIndex: Math.min(...stripIndices),
        maxStripIndex: Math.max(...stripIndices),
      };
      const rect = createRectSelection(
        meshes.map((mesh) => ({
          mesh,
          moduleIndex: Number(mesh.userData.moduleIndex),
          stripIndex: Number(mesh.userData.stripIndex),
        })),
        { moduleIndex: bounds.minModuleIndex, stripIndex: bounds.minStripIndex },
        { moduleIndex: bounds.maxModuleIndex, stripIndex: bounds.maxStripIndex },
      );
      if (!rect.ok || rect.entries.length !== meshes.length) {
        return { ok: false, message: `${fabricLabel} yalnızca eksiksiz dikdörtgen panel bloğundan oluşturulabilir.` };
      }

      const first = meshes[0];
      first.updateWorldMatrix(true, false);
      const firstQuaternion = first.getWorldQuaternion(new THREE.Quaternion());
      const firstNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(firstQuaternion).normalize();
      const firstPosition = first.getWorldPosition(new THREE.Vector3());
      const firstPlane = firstPosition.dot(firstNormal);
      const samePlane = meshes.every((mesh) => {
        mesh.updateWorldMatrix(true, false);
        const quaternion = mesh.getWorldQuaternion(new THREE.Quaternion());
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize();
        const position = mesh.getWorldPosition(new THREE.Vector3());
        return Math.abs(normal.dot(firstNormal)) > 0.999
          && Math.abs(position.dot(firstNormal) - firstPlane) < 0.03;
      });
      if (!samePlane) {
        return { ok: false, message: `${fabricLabel} yalnızca aynı düzlemdeki panellerden oluşturulabilir.` };
      }

      const replacedGroupIds = new Set(
        meshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean),
      );
      if (replacedGroupIds.size) {
        const replacedSurfaces = [];
        surfaceMeshes.forEach((surface) => {
          if (!replacedGroupIds.has(surface.userData.surfaceState?.fabricGroupId)) return;
          replacedSurfaces.push(surface);
          writePersistentSurface(surface, (state) => {
            clearFabricFields(state);
          });
        });
        replacedSurfaces.forEach(restoreFabricSurface);
      }

      const groupId = `fabric-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
      const initialFabricColor = meshes[0]?.userData.surfaceState?.color ?? '#ffffff';
      const fabricOwnerSurfaceIds = [...new Set(
        meshes.map((mesh) => mesh.userData.surfaceId).filter(Boolean),
      )];
      const fabricOwnerModuleIds = [...new Set(
        meshes.map((mesh) => mesh.userData.moduleId).filter(Boolean),
      )];
      meshes.forEach((mesh) => {
        writePersistentSurface(mesh, (state) => {
          state.fabricGroupId = groupId;
          state.fabricType = resolvedFabricType;
          state.fabricColor = initialFabricColor;
          state.fabricImageAssetId = null;
          state.fabricImageFit = 'cover';
          delete state.fabricImageWidthCm;
          delete state.fabricImageHeightCm;
          state.fabricLightingOn = false;
          state.fabricOwnerSurfaceIds = [...fabricOwnerSurfaceIds];
          state.fabricOwnerModuleIds = [...fabricOwnerModuleIds];
        });
      });
      meshes.forEach((mesh) => suspendFabricSurface(mesh, resolvedFabricType));
      rebuildFabricOverlays();
      return {
        ok: true,
        enabled: true,
        panelCount: meshes.length,
        fabricGroupId: groupId,
        fabricType: resolvedFabricType,
      };
    }

    const groupIds = new Set(
      meshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean),
    );
    if (!groupIds.size) {
      return { ok: false, message: `Seçimde kaldırılacak ${fabricLabel} bulunamadı.` };
    }
    const restoredSurfaces = [];
    surfaceMeshes.forEach((surface) => {
      if (groupIds.has(surface.userData.surfaceState?.fabricGroupId)) {
        restoredSurfaces.push(surface);
        writePersistentSurface(surface, (state) => {
          clearFabricFields(state);
        });
      }
    });
    restoredSurfaces.forEach(restoreFabricSurface);
    rebuildFabricOverlays();
    return { ok: true, enabled: false, panelCount: meshes.length };
  }

  function setFabricLighting(meshOrMeshes, enabled) {
    requestEditorRender();
    const meshes = normalizeMeshes(meshOrMeshes).filter(
      (mesh) => mesh?.userData?.acceptsLightbox === true && mesh.userData.surfaceState?.fabricGroupId,
    );
    const groupIds = new Set(
      meshes.map((mesh) => mesh.userData.surfaceState.fabricGroupId).filter(Boolean),
    );
    if (groupIds.size !== 1) {
      return { ok: false, message: 'Aydınlatma için tek bir lightbox bezi seç.' };
    }

    const [groupId] = groupIds;
    const groupSurfaces = surfaceMeshes.filter(
      (surface) => surface.userData.surfaceState?.fabricGroupId === groupId,
    );
    const fabricType = groupSurfaces[0]?.userData.surfaceState?.fabricType === 'mesh'
      ? 'mesh'
      : 'lightbox';
    if (fabricType !== 'lightbox') {
      return { ok: false, message: 'Mesh Branda aydınlatılamaz; aydınlatma yalnızca Lightbox Kumaşa aittir.' };
    }
    const lightingOn = Boolean(enabled);
    groupSurfaces.forEach((surface) => {
      writePersistentSurface(surface, (state) => {
        state.fabricLightingOn = lightingOn;
      });
    });

    fabricOverlayMeshes
      .filter((overlay) => overlay.userData?.fabricGroupId === groupId)
      .forEach((overlay) => applyFabricOverlayLighting(overlay, groupSurfaces[0]?.userData.surfaceState));

    return { ok: true, enabled: lightingOn, panelCount: groupSurfaces.length, fabricGroupId: groupId };
  }

  function applyGlassMode(meshOrMeshes, isGlass) {
    requestEditorRender();
    const glass = Boolean(isGlass);
    const glassMeshes = normalizeMeshes(meshOrMeshes).filter(
      (mesh) => mesh?.userData?.acceptsGlass === true && mesh.userData.surfaceState,
    );

    if (glass) {
      const conflictingFabricGroupIds = new Set(
        glassMeshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean),
      );
      if (conflictingFabricGroupIds.size) {
        surfaceMeshes.forEach((surface) => {
          if (!conflictingFabricGroupIds.has(surface.userData.surfaceState?.fabricGroupId)) return;
          clearFabricState(surface);
        });
        rebuildFabricOverlays();
      }
    }

    glassMeshes.forEach((mesh) => {
      if (!mesh?.material || mesh.userData.acceptsGlass !== true) return;
      const surfaceState = mesh.userData.surfaceState;
      if (!surfaceState) return;

      writePersistentSurface(mesh, (persistent) => {
        applyGlassOverride(persistent, glass);
      });
      removeMetalGrid(mesh);
      mesh.material.alphaTest = 0;
      if (mesh.userData.backing) mesh.userData.backing.visible = true;
      const hasImage = Boolean(mesh.material.map);
      mesh.material.transparent = glass;
      mesh.material.opacity = glass ? GLASS_APPEARANCE.opacity : 1;
      mesh.material.depthWrite = !glass;
      mesh.material.roughness = glass ? GLASS_APPEARANCE.roughness : 0.72;
      mesh.material.metalness = 0;
      mesh.material.color.set(
        glass
          ? (hasImage ? 0xffffff : GLASS_APPEARANCE.color)
          : (hasImage ? 0xffffff : (surfaceState.color ?? '#ffffff')),
      );
      mesh.material.needsUpdate = true;

      const backing = mesh.userData.backing;
      if (backing?.material) {
        backing.material.transparent = glass;
        backing.material.opacity = glass ? PANEL_GLASS_BACKING_APPEARANCE.opacity : 1;
        backing.material.depthWrite = !glass;
        backing.material.roughness = glass ? PANEL_GLASS_BACKING_APPEARANCE.roughness : 0.74;
        backing.material.color.set(glass ? PANEL_GLASS_BACKING_APPEARANCE.color : (backing.userData.opaqueBackColor ?? PANEL_BACK_COLOR));
        backing.material.needsUpdate = true;
        backing.castShadow = !glass;
      }
    });
  }

  function restorePanelFace(mesh) {
    if (!mesh?.material) return;
    const surfaceState = mesh.userData.surfaceState;
    removeMetalGrid(mesh);
    mesh.material.map = null;
    mesh.material.alphaTest = 0;
    mesh.material.color.set(surfaceState?.color ?? '#ffffff');
    mesh.material.roughness = 0.72;
    mesh.material.metalness = 0;
    mesh.material.transparent = false;
    mesh.material.opacity = 1;
    mesh.material.depthWrite = true;
    mesh.material.needsUpdate = true;
    if (mesh.userData.backing) mesh.userData.backing.visible = true;
    if (surfaceState?.imageAssetId) applyStoredImage(mesh);
  }

  function metalSurfacesInGroups(groupIds) {
    if (!groupIds.size) return [];
    const found = [];
    surfaceMeshes.forEach((surface) => {
      const groupId = surface.userData.surfaceState?.metalSeparatorGroupId;
      if (groupId && groupIds.has(groupId)) found.push(surface);
    });
    return found;
  }

  function applyMetalSeparatorMode(meshOrMeshes, enabled) {
    requestEditorRender();
    const metal = Boolean(enabled);
    const meshes = normalizeMeshes(meshOrMeshes).filter(
      (mesh) => mesh?.userData?.acceptsGlass === true && mesh.userData.surfaceState,
    );
    if (!meshes.length) {
      return { ok: false, message: 'Metal separatör için panel seç.' };
    }

    if (metal) {
      const moduleIndices = meshes.map((mesh) => Number(mesh.userData.moduleIndex));
      const stripIndices = meshes.map((mesh) => Number(mesh.userData.stripIndex));
      const rect = createRectSelection(
        meshes.map((mesh) => ({
          mesh,
          moduleIndex: Number(mesh.userData.moduleIndex),
          stripIndex: Number(mesh.userData.stripIndex),
        })),
        { moduleIndex: Math.min(...moduleIndices), stripIndex: Math.min(...stripIndices) },
        { moduleIndex: Math.max(...moduleIndices), stripIndex: Math.max(...stripIndices) },
      );
      if (!rect.ok || rect.entries.length !== meshes.length) {
        return {
          ok: false,
          message: 'Metal separatör yalnızca eksiksiz dikdörtgen panel bloğundan oluşturulabilir.',
        };
      }

      const replacedIds = new Set(
        meshes.map((mesh) => mesh.userData.surfaceState?.metalSeparatorGroupId).filter(Boolean),
      );
      const selected = new Set(meshes);
      metalSurfacesInGroups(replacedIds).forEach((surface) => {
        if (selected.has(surface)) return;
        writePersistentSurface(surface, (persistent) => {
          applyMetalSeparatorOverride(persistent, false);
        });
        restorePanelFace(surface);
      });

      const groupId = `metal-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
      meshes.forEach((mesh) => {
        if (!mesh?.material) return;
        writePersistentSurface(mesh, (persistent) => {
          applyMetalSeparatorOverride(persistent, true);
          persistent.metalSeparatorGroupId = groupId;
        });
        const widthM = Number(mesh.geometry?.parameters?.width) || 1;
        const heightM = Number(mesh.geometry?.parameters?.height) || 0.5;
        paintMetalGrid(mesh, widthM, heightM);
        if (mesh.userData.backing) mesh.userData.backing.visible = false;
      });
      return { ok: true, enabled: true, panelCount: meshes.length };
    }

    const groupIds = new Set(
      meshes.map((mesh) => mesh.userData.surfaceState?.metalSeparatorGroupId).filter(Boolean),
    );
    const targets = new Set(meshes);
    metalSurfacesInGroups(groupIds).forEach((surface) => targets.add(surface));
    targets.forEach((mesh) => {
      if (!mesh?.material) return;
      writePersistentSurface(mesh, (persistent) => {
        applyMetalSeparatorOverride(persistent, false);
      });
      restorePanelFace(mesh);
    });
    return { ok: true, enabled: false, panelCount: targets.size };
  }

  function configureTexture(texture, surfaceState) {
    const transform = surfaceState?.imageTransform ?? {};
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.center.set(0.5, 0.5);
    texture.offset.set(transform.offsetX ?? 0, transform.offsetY ?? 0);
    texture.repeat.set(transform.repeatX ?? 1, transform.repeatY ?? 1);
    texture.rotation = transform.rotation ?? 0;
    texture.needsUpdate = true;
  }

  // Aynı görsel + oran + sığdırma için sığdırılmış tuval bir kez üretilir ve GPU'ya bir kez
  // yüklenir. Gruplu görselde her panel grubun tamamını taşıyan aynı dokuyu kendi bölgesiyle
  // (offset/repeat) gösterir; eskiden her panel 2048 px'lik ayrı doku yüklüyordu (60 panel =
  // 60 yükleme, açılışta ~0,9 sn'lik kare). Kopyalar aynı Source'u paylaşır.
  const fittedTextureCache = new Map();
  let fittedTextureCacheTimer = null;
  const FITTED_TEXTURE_CACHE_MS = 5000;

  function sharedFittedTexture(assetId, image, targetAspect, fit, configureBase) {
    const key = `${assetId}|${Number(targetAspect).toFixed(4)}|${fit}`;
    let base = fittedTextureCache.get(key);
    if (!base) {
      base = new THREE.CanvasTexture(createFittedCanvas(image, targetAspect, fit));
      configureBase(base);
      fittedTextureCache.set(key, base);
    }
    // Önbellek yalnız açılış/yeniden kurulum dalgası için tutulur; tuvaller bellekte kalmasın.
    clearTimeout(fittedTextureCacheTimer);
    fittedTextureCacheTimer = setTimeout(() => fittedTextureCache.clear(), FITTED_TEXTURE_CACHE_MS);
    // clone() kaynak sürümünü artırır (needsUpdate); artarsa aynı görsel her kopyada yeniden
    // yüklenir. Sürüm geri alınır: kopya yalnız UV dönüşümünü (offset/repeat) kendine tutar.
    const sourceVersion = base.source.version;
    const texture = base.clone();
    texture.source.version = sourceVersion;
    return texture;
  }

  function createFittedCanvas(image, targetAspect, fit = 'contain') {
    const maxSide = 2048;
    let width;
    let height;

    if (targetAspect >= 1) {
      width = maxSide;
      height = Math.max(128, Math.round(maxSide / targetAspect));
    } else {
      height = maxSide;
      width = Math.max(128, Math.round(maxSide * targetAspect));
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const imageWidth = image.naturalWidth ?? image.width;
    const imageHeight = image.naturalHeight ?? image.height;
    const placement = computeImageFit(imageWidth, imageHeight, width, height, fit);
    if (!placement) return canvas;

    context.drawImage(
      image,
      placement.drawX,
      placement.drawY,
      placement.drawWidth,
      placement.drawHeight,
    );

    return canvas;
  }

  function assignTexture(mesh, texture) {
    if (!mesh?.material) {
      texture.dispose();
      return;
    }
    mesh.material.map?.dispose?.();
    mesh.material.map = texture;
    mesh.material.color.set(0xffffff);
    mesh.material.needsUpdate = true;
  }

  function loadSingleImageOnSurface(mesh, assetId) {
    const assetUrl = getAssetUrl(assetId);
    if (!mesh?.material || !assetUrl || mesh.userData.acceptsImage === false) return;

    textureLoader.load(
      assetUrl,
      (sourceTexture) => {
        requestEditorRender();
        const surfaceState = mesh.userData.surfaceState;
        if (surfaceState?.fabricGroupId || surfaceState?.imageAssetId !== assetId) {
          sourceTexture.dispose();
          return;
        }

        const fit = surfaceState.imageTransform?.fit;
        if (fit === 'size') {
          const image = sourceTexture.image;
          const transform = surfaceState.imageTransform;
          const widthCm = Number(transform.widthCm);
          const heightCm = resolveImageTileHeightCm(
            widthCm,
            transform.heightCm,
            image?.naturalWidth ?? image?.width,
            image?.naturalHeight ?? image?.height,
          );
          const groupWidthCm = Number(transform.groupWidthCm);
          const groupHeightCm = Number(transform.groupHeightCm);
          const hasGroup = Number.isFinite(groupWidthCm) && groupWidthCm > 0
            && Number.isFinite(groupHeightCm) && groupHeightCm > 0
            && Number(transform.regionWidth) > 0
            && Number(transform.regionHeight) > 0;
          const areaWidthCm = hasGroup ? groupWidthCm : Number(mesh.geometry?.parameters?.width) * 100;
          const areaHeightCm = hasGroup ? groupHeightCm : Number(mesh.geometry?.parameters?.height) * 100;
          const tile = computeImageSizeTile(areaWidthCm, areaHeightCm, widthCm, heightCm);
          const placement = hasGroup
            ? computeGroupSizeSlice({
              startX: transform.regionStartX,
              startY: transform.regionStartY,
              width: transform.regionWidth,
              height: transform.regionHeight,
            }, tile)
            : tile;
          if (!placement) {
            sourceTexture.dispose();
            return;
          }
          sourceTexture.colorSpace = THREE.SRGBColorSpace;
          sourceTexture.wrapS = THREE.RepeatWrapping;
          sourceTexture.wrapT = THREE.RepeatWrapping;
          sourceTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          sourceTexture.center.set(0, 0);
          sourceTexture.repeat.set(placement.repeatX, placement.repeatY);
          sourceTexture.offset.set(placement.offsetX, placement.offsetY);
          sourceTexture.rotation = 0;
          sourceTexture.needsUpdate = true;
          assignTexture(mesh, sourceTexture);
          return;
        }
        if (fit === 'cover' || fit === 'contain') {
          const targetAspect = mesh.geometry.parameters.width / mesh.geometry.parameters.height;
          const fittedTexture = sharedFittedTexture(assetId, sourceTexture.image, targetAspect, fit, (base) => {
            configureTexture(base, surfaceState);
          });
          sourceTexture.dispose();
          // Yüzeye özel UV dönüşümü (offset/repeat/rotation); yükleme gerektirmez.
          const transform = surfaceState?.imageTransform ?? {};
          fittedTexture.center.set(0.5, 0.5);
          fittedTexture.offset.set(transform.offsetX ?? 0, transform.offsetY ?? 0);
          fittedTexture.repeat.set(transform.repeatX ?? 1, transform.repeatY ?? 1);
          fittedTexture.rotation = transform.rotation ?? 0;
          assignTexture(mesh, fittedTexture);
          return;
        }

        configureTexture(sourceTexture, surfaceState);
        assignTexture(mesh, sourceTexture);
      },
      undefined,
      () => {
        const surfaceState = mesh.userData.surfaceState;
        const stateColor = surfaceState?.isGlass
          ? GLASS_APPEARANCE.color
          : (surfaceState?.color ?? '#ffffff');
        if (mesh.material) mesh.material.color.set(stateColor);
      },
    );
  }

  function loadGroupedImageOnSurface(mesh, assetId, expectedMode) {
    const assetUrl = getAssetUrl(assetId);
    if (!mesh?.material || !assetUrl || mesh.userData.acceptsImage === false) return;

    textureLoader.load(
      assetUrl,
      (sourceTexture) => {
        requestEditorRender();
        const surfaceState = mesh.userData.surfaceState;
        const transform = surfaceState?.imageTransform;
        if (
          surfaceState?.fabricGroupId
          || surfaceState?.imageAssetId !== assetId
          || transform?.mode !== expectedMode
        ) {
          sourceTexture.dispose();
          return;
        }

        const texture = sharedFittedTexture(
          assetId,
          sourceTexture.image,
          transform.groupAspect,
          transform.fit ?? 'contain',
          (base) => {
            base.colorSpace = THREE.SRGBColorSpace;
            base.wrapS = THREE.ClampToEdgeWrapping;
            base.wrapT = THREE.ClampToEdgeWrapping;
            base.anisotropy = renderer.capabilities.getMaxAnisotropy();
          },
        );
        sourceTexture.dispose();

        // Panelin grup içindeki bölgesi; aynı dokuyu paylaşan panellerden yalnız bu farklıdır.
        if (expectedMode === 'rect-group') {
          texture.offset.set(transform.regionStartX, transform.regionStartY);
          texture.repeat.set(transform.regionWidth, transform.regionHeight);
        } else {
          texture.offset.set(transform.regionStart, 0);
          texture.repeat.set(transform.regionWidth, 1);
        }

        assignTexture(mesh, texture);
      },
      undefined,
      () => {
        const surfaceState = mesh.userData.surfaceState;
        const stateColor = surfaceState?.isGlass
          ? GLASS_APPEARANCE.color
          : (surfaceState?.color ?? '#ffffff');
        if (mesh.material) mesh.material.color.set(stateColor);
      },
    );
  }

  function loadImageOnSurface(mesh, assetId) {
    if (mesh.userData.acceptsImage === false) return;
    const mode = mesh.userData.surfaceState?.imageTransform?.mode;
    if (mode === 'rect-group') {
      loadGroupedImageOnSurface(mesh, assetId, 'rect-group');
      return;
    }
    if (mode === 'horizontal-group') {
      loadGroupedImageOnSurface(mesh, assetId, 'horizontal-group');
      return;
    }
    loadSingleImageOnSurface(mesh, assetId);
  }

  function applyStoredImage(mesh) {
    if (mesh.userData.acceptsImage === false) return;
    // Bez aktifken eski panel görsel state'i korunur ama texture tekrar GPU'ya yüklenmez.
    if (mesh.userData.surfaceState?.fabricGroupId) return;

    const transferKey = getRebuildTextureKey(mesh);
    const retainedTexture = transferKey ? rebuildTextureTransfer?.get(transferKey) : null;
    if (retainedTexture && mesh.material) {
      mesh.material.map = retainedTexture;
      mesh.material.color.set(0xffffff);
      mesh.material.needsUpdate = true;
      rebuildTextureTransfer.delete(transferKey);
      return;
    }

    const assetId = mesh.userData.surfaceState?.imageAssetId;
    if (!assetId) return;
    // Görsel dosyası bulunamadıysa (ör. sunucuda eksik) yüzey beyaz kalmaz; kendi rengiyle çizilir.
    // Bağlantı projede korunur; görsel geri gelirse sonraki açılışta görünür.
    if (!getAssetUrl(assetId)) {
      applyMissingImageFallback(mesh);
      return;
    }
    loadImageOnSurface(mesh, assetId);
  }

  function applyMissingImageFallback(mesh) {
    if (!mesh?.material?.color) return;
    const state = mesh.userData.surfaceState;
    mesh.material.map = null;
    mesh.material.color.set(state?.isGlass ? GLASS_APPEARANCE.color : (state?.color ?? '#ffffff'));
    mesh.material.needsUpdate = true;
  }

  function imageLayoutItems(meshes) {
    return visualImageColumnItems(meshes.map((mesh) => {
      const meta = getSurfaceSelectionPlaneMeta(mesh);
      return {
        mesh,
        moduleId: mesh.userData.moduleId ?? mesh.userData.moduleIndex,
        moduleIndex: mesh.userData.moduleIndex,
        stripIndex: mesh.userData.stripIndex,
        pathCm: meta?.pathCm,
        axis: meta?.axis ?? null,
        crossCm: meta?.crossCm,
        planeKey: meta?.planeKey ?? null,
        width: mesh.geometry.parameters.width,
        height: mesh.geometry.parameters.height,
      };
    }));
  }

  function sharedFabricImage(meshes) {
    const groupIds = [...new Set(meshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean))];
    if (groupIds.length !== 1) return null;
    const [groupId] = groupIds;
    if (!meshes.every((mesh) => mesh.userData.surfaceState?.fabricGroupId === groupId)) return null;
    const assetIds = [...new Set(meshes.map((mesh) => mesh.userData.surfaceState?.fabricImageAssetId).filter(Boolean))];
    if (assetIds.length !== 1) return null;
    return { groupId, assetId: assetIds[0] };
  }

  function measureImageAreaCm(meshes) {
    let areaWidthCm;
    let areaHeightCm;
    let columnCount = 1;
    let rowCount = 1;
    if (meshes.length === 1) {
      areaWidthCm = Number(meshes[0].geometry?.parameters?.width) * 100;
      areaHeightCm = Number(meshes[0].geometry?.parameters?.height) * 100;
    } else {
      const layout = createRectImageLayout(imageLayoutItems(meshes));
      if (!layout.ok) return layout;
      areaWidthCm = layout.totalWidth * 100;
      areaHeightCm = layout.totalHeight * 100;
      columnCount = layout.columnCount;
      rowCount = layout.rowCount;
    }
    if (!(areaWidthCm > 0) || !(areaHeightCm > 0)) {
      return { ok: false, message: 'Seçili alanın ölçüsü okunamadı.' };
    }
    return { ok: true, areaWidthCm, areaHeightCm, columnCount, rowCount };
  }

  function resolveImageBlock(surfaceId) {
    const seed = surfaceMeshes.find((surface) => surface.userData.surfaceId === surfaceId);
    if (!seed) return [];
    const fabricGroupId = seed.userData.surfaceState?.fabricGroupId;
    if (fabricGroupId) {
      const fabricAssetId = seed.userData.surfaceState?.fabricImageAssetId;
      if (!fabricAssetId) return [];
      return surfaceMeshes.filter((mesh) => (
        mesh.userData.surfaceState?.fabricGroupId === fabricGroupId
        && mesh.userData.surfaceState?.fabricImageAssetId === fabricAssetId
      ));
    }
    if (seed.userData.acceptsImage === false) return [];
    const assetId = seed.userData.surfaceState?.imageAssetId;
    if (!assetId) return [];

    const selected = [...selectedSurfaces].filter((mesh) => (
      mesh.userData.acceptsImage !== false
      && !mesh.userData.surfaceState?.fabricGroupId
      && mesh.userData.surfaceState?.imageAssetId === assetId
    ));
    if (selected.includes(seed) && selected.length > 1) return selected;

    const sameAsset = surfaceMeshes.filter((mesh) => (
      mesh.userData.acceptsImage !== false
      && !mesh.userData.surfaceState?.fabricGroupId
      && mesh.userData.surfaceState?.imageAssetId === assetId
    ));
    if (sameAsset.length > 1 && createRectImageLayout(imageLayoutItems(sameAsset)).ok) {
      return sameAsset;
    }
    return [seed];
  }

  function describeImageSizeTarget(meshOrMeshes) {
    const meshes = normalizeMeshes(meshOrMeshes).filter((mesh) => {
      if (!mesh?.material) return false;
      if (mesh.userData.surfaceState?.fabricGroupId) return true;
      return mesh.userData.acceptsImage !== false;
    });
    if (!meshes.length) {
      return { ok: false, message: 'Ölçülendirmek için önce bir panel seç.' };
    }
    const fabric = sharedFabricImage(meshes);
    if (meshes.some((mesh) => mesh.userData.surfaceState?.fabricGroupId) && !fabric) {
      return { ok: false, message: 'Ölçülendirmek için Lightbox veya Mesh kaplamasına önce bir görsel ata.' };
    }
    const assetIds = fabric
      ? new Set([fabric.assetId])
      : new Set(meshes.map((mesh) => mesh.userData.surfaceState?.imageAssetId).filter(Boolean));
    if (assetIds.size !== 1) {
      return { ok: false, message: 'Ölçülendirmek için önce bu alana bir görsel ata.' };
    }

    const area = measureImageAreaCm(meshes);
    if (!area.ok) return area;

    const surfaceState = meshes[0].userData.surfaceState;
    const sized = fabric
      ? surfaceState?.fabricImageFit === 'size'
      : surfaceState?.imageTransform?.fit === 'size';
    const storedWidth = fabric ? surfaceState?.fabricImageWidthCm : surfaceState?.imageTransform?.widthCm;
    const storedHeight = fabric ? surfaceState?.fabricImageHeightCm : surfaceState?.imageTransform?.heightCm;
    const currentWidthCm = sized && Number(storedWidth) > 0 ? Number(storedWidth) : area.areaWidthCm;
    const currentHeightCm = sized && Number(storedHeight) > 0 ? Number(storedHeight) : area.areaHeightCm;
    return {
      ok: true,
      assetId: [...assetIds][0],
      areaWidthCm: area.areaWidthCm,
      areaHeightCm: area.areaHeightCm,
      currentWidthCm,
      currentHeightCm,
      panelCount: meshes.length,
      columnCount: area.columnCount,
      rowCount: area.rowCount,
    };
  }

  function applySizeImageAsset(meshOrMeshes, assetId, { widthCm, heightCm = null } = {}) {
    if (!assetId) return { ok: false, message: 'Önce bir görsel seç.' };
    const width = Number(widthCm);
    if (!Number.isFinite(width) || width <= 0) {
      return { ok: false, message: 'Görsel genişliğini cm olarak yaz.' };
    }
    const height = Number(heightCm);
    const storedHeight = Number.isFinite(height) && height > 0 ? height : null;
    const meshes = normalizeMeshes(meshOrMeshes).filter((mesh) => {
      if (!mesh?.material) return false;
      if (mesh.userData.surfaceState?.fabricGroupId) return true;
      return mesh.userData.acceptsImage !== false;
    });
    if (!meshes.length) {
      return { ok: false, message: 'Bu modüle görsel uygulanamaz; yalnızca renk uygulanabilir.' };
    }
    const fabric = sharedFabricImage(meshes);
    if (meshes.some((mesh) => mesh.userData.surfaceState?.fabricGroupId) && !fabric) {
      return { ok: false, message: 'Ölçülendirmek için Lightbox veya Mesh kaplamasına önce bir görsel ata.' };
    }
    if (fabric) {
      const area = measureImageAreaCm(meshes);
      if (!area.ok) return area;
      const groupSurfaces = surfaceMeshes.filter(
        (surface) => surface.userData.surfaceState?.fabricGroupId === fabric.groupId,
      );
      groupSurfaces.forEach((surface) => {
        writePersistentSurface(surface, (state) => {
          state.fabricImageAssetId = assetId;
          state.fabricImageFit = 'size';
          state.fabricImageWidthCm = width;
          if (storedHeight) state.fabricImageHeightCm = storedHeight;
          else delete state.fabricImageHeightCm;
        });
      });
      rebuildFabricOverlays();
      return {
        ok: true,
        panelCount: groupSurfaces.length,
        widthCm: width,
        heightCm: storedHeight,
        areaWidthCm: area.areaWidthCm,
        areaHeightCm: area.areaHeightCm,
        columnCount: area.columnCount,
        rowCount: area.rowCount,
      };
    }

    let entries;
    let groupWidthCm;
    let groupHeightCm;
    let columnCount = 1;
    let rowCount = 1;
    if (meshes.length === 1) {
      groupWidthCm = Number(meshes[0].geometry?.parameters?.width) * 100;
      groupHeightCm = Number(meshes[0].geometry?.parameters?.height) * 100;
      entries = [{
        mesh: meshes[0],
        regionStartX: 0,
        regionStartY: 0,
        regionWidth: 1,
        regionHeight: 1,
      }];
    } else {
      const layout = createRectImageLayout(imageLayoutItems(meshes));
      if (!layout.ok) return layout;
      groupWidthCm = layout.totalWidth * 100;
      groupHeightCm = layout.totalHeight * 100;
      columnCount = layout.columnCount;
      rowCount = layout.rowCount;
      entries = layout.entries;
    }
    if (!(groupWidthCm > 0) || !(groupHeightCm > 0)) {
      return { ok: false, message: 'Seçili alanın ölçüsü okunamadı.' };
    }

    entries.forEach((entry) => {
      writePersistentSurface(entry.mesh, (surfaceState) => {
        surfaceState.imageAssetId = assetId;
        surfaceState.imageTransform = {
          ...createDefaultImageTransform(),
          fit: 'size',
          mode: entries.length > 1 ? 'size-group' : 'single',
          widthCm: width,
          ...(storedHeight ? { heightCm: storedHeight } : {}),
          groupWidthCm,
          groupHeightCm,
          regionStartX: entry.regionStartX,
          regionStartY: entry.regionStartY,
          regionWidth: entry.regionWidth,
          regionHeight: entry.regionHeight,
        };
      });
      loadSingleImageOnSurface(entry.mesh, assetId);
    });
    return {
      ok: true,
      panelCount: entries.length,
      widthCm: width,
      heightCm: storedHeight,
      areaWidthCm: groupWidthCm,
      areaHeightCm: groupHeightCm,
      columnCount,
      rowCount,
    };
  }

  function applyImageAsset(meshOrMeshes, assetId, fit = null) {
    requestEditorRender();
    if (!assetId) return;
    normalizeMeshes(meshOrMeshes).forEach((mesh) => {
      if (!mesh?.material || mesh.userData.acceptsImage === false) return;
      writePersistentSurface(mesh, (surfaceState) => {
        surfaceState.imageAssetId = assetId;
        surfaceState.imageTransform = createDefaultImageTransform();
        if (fit === 'cover' || fit === 'contain') {
          surfaceState.imageTransform.fit = fit;
        }
      });
      loadSingleImageOnSurface(mesh, assetId);
    });
  }

  function applyHorizontalImageAsset(meshOrMeshes, assetId) {
    const meshes = normalizeMeshes(meshOrMeshes);
    if (!assetId) return { ok: false, message: 'Önce bir görsel seç.' };
    if (meshes.some((mesh) => mesh.userData.acceptsImage === false)) {
      return { ok: false, message: 'Bu modüle görsel uygulanamaz; yalnızca renk uygulanabilir.' };
    }

    if (meshes.length === 1) {
      applyImageAsset(meshes, assetId);
      return { ok: true, mode: 'single' };
    }

    const layout = createHorizontalImageLayout(
      meshes.map((mesh) => ({
        mesh,
        moduleIndex: mesh.userData.moduleIndex,
        stripIndex: mesh.userData.stripIndex,
        width: mesh.geometry.parameters.width,
        height: mesh.geometry.parameters.height,
      })),
    );

    if (!layout.ok) return layout;

    layout.entries.forEach((entry) => {
      writePersistentSurface(entry.mesh, (surfaceState) => {
        surfaceState.imageAssetId = assetId;
        surfaceState.imageTransform = {
          mode: 'horizontal-group',
          groupAspect: layout.groupAspect,
          regionStart: entry.regionStart,
          regionWidth: entry.regionWidth,
        };
      });
      loadGroupedImageOnSurface(entry.mesh, assetId, 'horizontal-group');
    });

    return {
      ok: true,
      mode: 'horizontal-group',
      panelCount: layout.entries.length,
    };
  }

  function applyRectImageAsset(meshOrMeshes, assetId, fit = 'contain') {
    const meshes = normalizeMeshes(meshOrMeshes);
    if (!assetId) return { ok: false, message: 'Önce bir görsel seç.' };
    const fabricGroupIds = new Set(
      meshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean),
    );
    if (fabricGroupIds.size > 1) {
      return { ok: false, message: 'Görsel için tek bir Lightbox/Mesh kaplaması seç.' };
    }
    if (fabricGroupIds.size === 1) {
      const [groupId] = fabricGroupIds;
      if (!meshes.every((mesh) => mesh.userData.surfaceState?.fabricGroupId === groupId)) {
        return { ok: false, message: 'Lightbox/Mesh kaplaması ile normal panelleri aynı anda görselleme; tek bir kaplama seç.' };
      }
      const groupSurfaces = surfaceMeshes.filter(
        (surface) => surface.userData.surfaceState?.fabricGroupId === groupId,
      );
      groupSurfaces.forEach((surface) => {
        writePersistentSurface(surface, (state) => {
          state.fabricImageAssetId = assetId;
          state.fabricImageFit = fit === 'contain' ? 'contain' : 'cover';
          delete state.fabricImageWidthCm;
          delete state.fabricImageHeightCm;
        });
      });
      rebuildFabricOverlays();
      return {
        ok: true,
        mode: 'fabric-group',
        panelCount: groupSurfaces.length,
        fabricGroupId: groupId,
        fabricType: groupSurfaces[0]?.userData.surfaceState?.fabricType === 'mesh' ? 'mesh' : 'lightbox',
      };
    }
    if (meshes.some((mesh) => mesh.userData.acceptsImage === false)) {
      return { ok: false, message: 'Bu modüle görsel uygulanamaz; yalnızca renk uygulanabilir.' };
    }

    const normalizedFit = fit === 'cover' ? 'cover' : 'contain';

    if (meshes.length === 1) {
      applyImageAsset(meshes, assetId, normalizedFit);
      return {
        ok: true,
        mode: 'single',
        columnCount: 1,
        rowCount: 1,
        panelCount: 1,
      };
    }

    const layout = createRectImageLayout(imageLayoutItems(meshes));

    if (!layout.ok) return layout;

    layout.entries.forEach((entry) => {
      writePersistentSurface(entry.mesh, (surfaceState) => {
        surfaceState.imageAssetId = assetId;
        surfaceState.imageTransform = {
          mode: 'rect-group',
          fit: normalizedFit,
          groupAspect: layout.groupAspect,
          regionStartX: entry.regionStartX,
          regionStartY: entry.regionStartY,
          regionWidth: entry.regionWidth,
          regionHeight: entry.regionHeight,
        };
      });
      loadGroupedImageOnSurface(entry.mesh, assetId, 'rect-group');
    });

    return {
      ok: true,
      mode: 'rect-group',
      fit: normalizedFit,
      columnCount: layout.columnCount,
      rowCount: layout.rowCount,
      panelCount: layout.entries.length,
    };
  }

  function clearImage(meshOrMeshes) {
    requestEditorRender();
    const meshes = normalizeMeshes(meshOrMeshes);
    const fabricGroupIds = new Set(
      meshes.map((mesh) => mesh.userData.surfaceState?.fabricGroupId).filter(Boolean),
    );
    fabricGroupIds.forEach((groupId) => {
      surfaceMeshes.forEach((surface) => {
        if (surface.userData.surfaceState?.fabricGroupId !== groupId) return;
        writePersistentSurface(surface, (state) => {
          state.fabricImageAssetId = null;
          state.fabricImageFit = 'cover';
          delete state.fabricImageWidthCm;
          delete state.fabricImageHeightCm;
        });
      });
    });

    meshes.filter((mesh) => !mesh.userData.surfaceState?.fabricGroupId).forEach((mesh) => {
      if (!mesh?.material || mesh.userData.acceptsImage === false) return;
      writePersistentSurface(mesh, (surfaceState) => {
        if ('imageAssetId' in surfaceState) {
          surfaceState.imageAssetId = null;
          surfaceState.imageTransform = createDefaultImageTransform();
        }
      });
      const surfaceState = mesh.userData.surfaceState;
      mesh.material.map?.dispose?.();
      mesh.material.map = null;
      mesh.material.color.set(
        surfaceState?.isGlass ? GLASS_APPEARANCE.color : (surfaceState?.color ?? '#ffffff'),
      );
      mesh.material.needsUpdate = true;
    });
    if (fabricGroupIds.size) rebuildFabricOverlays();
  }

  function clearImageAssetById(assetId) {
    if (!assetId) return 0;

    const directSurfaces = surfaceMeshes.filter(
      (surface) => surface.userData?.surfaceState?.imageAssetId === assetId,
    );
    const fabricGroupIds = new Set(
      surfaceMeshes
        .filter((surface) => surface.userData?.surfaceState?.fabricImageAssetId === assetId)
        .map((surface) => surface.userData?.surfaceState?.fabricGroupId)
        .filter(Boolean),
    );
    const fabricSurfaces = surfaceMeshes.filter(
      (surface) => fabricGroupIds.has(surface.userData?.surfaceState?.fabricGroupId),
    );
    const targets = [...new Set([...directSurfaces, ...fabricSurfaces])];
    if (!targets.length) return 0;

    clearImage(targets);
    renderer.render(scene, camera);
    return targets.length;
  }

  renderer.domElement.addEventListener('contextmenu', (event) => {
    // Dokunmatik uzun basma menüyü zaten açtıysa tarayıcının kendi contextmenu olayı ikinci kez açmaz.
    if (performance.now() - lastLongPressAt < 800) {
      event.preventDefault();
      return;
    }
    if (openModuleContextMenuAt(event)) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  function openModuleContextMenuAt(event) {
    const context = pickModuleContext(event);
    if (!context) {
      onModuleContextMenu?.(null);
      return false;
    }

    // Toplu seçim (≥2) varken sağ tık seçimi asla bozmaz: komşu panele kaymış
    // tıklama 6–7 öğelik seçimi tek öğeye düşürüp "Grup oluştur"u kaçırıyordu.
    // Tek seçimde eski davranış: sağ tıklanan yüzeye geç.
    if (multiSelectedModuleIds.size < 2
      && context.surfaceId
      && !multiSelectedModuleIds.has(context.moduleId)) {
      const contextSurface = surfaceMeshes.find(
        (surface) => surface.userData.surfaceId === context.surfaceId,
      );
      if (contextSurface && !selectedSurfaces.has(contextSurface)) {
        selectOnly(contextSurface);
      }
    }

    onModuleContextMenu?.(context);
    return true;
  }

  // Tablet iki parmak: ekranda ikinci parmak belirince (yakınlaştırma / kaydırma) ilk parmağın
  // başlattığı öğe sürüklemesi iptal edilir ve öğe yerine döner; iki parmak doğrudan kameraya
  // verilir. İkinci parmak bir öğenin üstüne gelse de öğeyi yakalamaz.
  const activeTouchPointers = new Map();
  function cancelDragForMultiTouch() {
    const session = dragSession;
    if (!session) return null;
    try {
      renderer.domElement.releasePointerCapture?.(session.pointerId);
    } catch {
      // İşaretçi zaten bırakılmış olabilir.
    }
    if (session.groupId && session.dragging) {
      restoreGroupPlacements(session.groupId);
      dragSession = null;
      controls.enabled = true;
      disposeDragBadge();
      clearPlacementFeedback();
    } else {
      clearPlacementDrag();
    }
    requestEditorRender();
    return session;
  }
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const firstTouch = [...activeTouchPointers.entries()][0] ?? null;
    activeTouchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (!firstTouch || !stageLayout) return;
    cancelLongPress();
    const cancelled = cancelDragForMultiTouch();
    controls.enabled = true;
    // Kamera ilk parmağı tanımıyorsa (öğe yakaladığı için) son konumuyla ona tanıtılır.
    if (cancelled && cancelled.pointerId === firstTouch[0]) {
      const last = activeTouchPointers.get(firstTouch[0]);
      controls._onPointerDown?.(new orbitWindow.PointerEvent('pointerdown', {
        pointerId: firstTouch[0],
        pointerType: 'touch',
        isPrimary: true,
        clientX: Number(last?.clientX ?? cancelled.lastClientX),
        clientY: Number(last?.clientY ?? cancelled.lastClientY),
        button: 0,
        buttons: 1,
      }));
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    controls._onPointerDown?.(event);
  }, { capture: true, signal });
  orbitWindow.addEventListener('pointermove', (event) => {
    if (activeTouchPointers.has(event.pointerId)) {
      activeTouchPointers.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    }
  }, { signal });
  const releaseTouchPointer = (event) => activeTouchPointers.delete(event.pointerId);
  orbitWindow.addEventListener('pointerup', releaseTouchPointer, { signal });
  orbitWindow.addEventListener('pointercancel', releaseTouchPointer, { signal });

  // Tablet: parmakla ~0,55 sn basılı tutmak sağ tıkla aynı menüyü açar. Parmak oynarsa
  // (sürükleme / kamera) iptal olur; açılınca başlamış modül sürüklemesi bırakılır.
  const LONG_PRESS_MS = 550;
  const LONG_PRESS_MOVE_PX = 10;
  let longPress = null;
  let lastLongPressAt = -Infinity;

  function cancelLongPress() {
    if (!longPress) return;
    clearTimeout(longPress.timer);
    longPress = null;
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    cancelLongPress();
    if (event.pointerType !== 'touch' || !stageLayout || multiSelectMode) return;
    const { pointerId, clientX, clientY } = event;
    longPress = {
      pointerId,
      clientX,
      clientY,
      timer: setTimeout(() => {
        longPress = null;
        if (dragSession && dragSession.pointerId === pointerId && !dragSession.dragging) {
          try {
            renderer.domElement.releasePointerCapture?.(pointerId);
          } catch {
            // İşaretçi zaten bırakılmış olabilir.
          }
          dragSession = null;
          controls.enabled = true;
        }
        lastLongPressAt = performance.now();
        openModuleContextMenuAt({ clientX, clientY });
      }, LONG_PRESS_MS),
    };
  }, { capture: true, signal });

  function handleSurfaceSelectionAt(clientX, clientY, rectangleSelect, fallbackModuleId = null) {
    setPointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(surfaceMeshes, false);
    // Ctrl/Cmd seçiminin kuralı paneldir: görünür noktada panel hit'i varsa
    // modül proxy/yardımcı yüzeyinden önce onu seç. Panel yoksa eski ilk-hit
    // davranışını koru (örn. banko özel çoklu seçimi).
    const panelHit = rectangleSelect
      ? hits.find((entry) => entry.object?.userData?.selectionMode === 'panel')
      : nearestBoxFaceHit(hits);
    const hit = panelHit ?? hits[0];

    if (hit) {
      if (rectangleSelect && hit.object.userData.moduleType === 'counter') {
        toggleCounterSurface(hit.object);
        return;
      }

      const anchorMesh = surfaceMeshes.find(
        (surface) => surface.userData.surfaceId === selectionAnchorSurfaceId,
      );
      const canRectangleSelect = rectangleSelect
        && hit.object.userData.selectionMode === 'panel'
        && anchorMesh?.userData.selectionMode === 'panel';

      if (canRectangleSelect) selectRectangleTo(hit.object);
      else selectOnly(hit.object);
      return;
    }

    if (!rectangleSelect && fallbackModuleId) {
      selectModuleOnly(fallbackModuleId);
      return;
    }

    if (!rectangleSelect && floorAreaMesh) {
      const areaHit = raycaster.intersectObject(floorAreaMesh, false)[0];
      if (areaHit) {
        clearSelection({ notify: false });
        selectedModuleId = null;
        floorAreaSelected = true;
        setFloorAreaHighlight(true);
        notifyFloorAreaSelection();
        return;
      }
    }

    if (!rectangleSelect && activeFloor.visible) {
      const floorHit = raycaster.intersectObject(activeFloor, false)[0];
      if (floorHit) {
        clearSelection({ notify: false });
        selectedModuleId = null;
        floorSelected = true;
        notifyFloorSelection();
        return;
      }
    }

    if (!rectangleSelect) {
      selectedModuleId = null;
      clearSelection();
    }
  }

  function moduleIdAt(clientX, clientY) {
    const picked = pickModuleAt(clientX, clientY);
    return picked?.moduleGroup?.userData?.moduleState?.id
      ?? picked?.moduleGroup?.userData?.moduleId
      ?? null;
  }

  // Çift tık / çift dokunuş: modülün herhangi bir yerine (panel dahil) kısa arayla aynı yere iki
  // kez basmak modülün tamamını seçer (turuncu). Tek tık bugünkü gibi paneli seçer; ikinci basış
  // sürükleme başlatmaz. Kopyala / katalog yerleştirme (viewport'ta yakalanır) ve Çoklu panel
  // modunda devreye girmez.
  const DOUBLE_PRESS_MS = 350;
  const DOUBLE_PRESS_PX = 10;
  let lastModulePress = null;
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
      || !stageLayout || floorAreaDrawArmed || multiSelectMode) {
      lastModulePress = null;
      return;
    }
    const moduleId = moduleIdAt(event.clientX, event.clientY);
    const now = performance.now();
    const previous = lastModulePress;
    lastModulePress = moduleId ? { moduleId, at: now, clientX: event.clientX, clientY: event.clientY } : null;
    if (!moduleId || previous?.moduleId !== moduleId || now - previous.at > DOUBLE_PRESS_MS
      || Math.hypot(event.clientX - previous.clientX, event.clientY - previous.clientY) > DOUBLE_PRESS_PX) {
      return;
    }
    // Kayıt kalır: hemen ardından gelen basış (üçlü tık) da modül seçimini korur, panele dönmez.
    event.preventDefault();
    event.stopImmediatePropagation();
    selectModuleOnly(moduleId);
  }, { capture: true });

  // Tablet Çoklu modül modunda dokunuş bir modülün üstündeyse toplu seçime ekler/çıkarır ve
  // kameraya gitmez. (Shift + tık ile modül seçimi yoktur; boş alanda Shift kamerayı kaydırır.)
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || multiSelectMode !== 'module' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!stageLayout || floorAreaDrawArmed) return;
    const picked = pickModuleAt(event.clientX, event.clientY);
    const moduleId = picked?.moduleGroup?.userData?.moduleState?.id
      ?? picked?.moduleGroup?.userData?.moduleId
      ?? null;
    if (!moduleId) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    toggleMultiModuleSelection(moduleId);
  }, { capture: true });

  // Çoklu panel (tek seferlik), Ctrl + tık ile aynı dikdörtgen (komşu modüller ve köşe dahil):
  // - dokunuş: önceden seçili panel (çapa) ile dokunulan panel arası seçilir;
  // - kaydırma: parmağın konduğu panel çapa olur, parmağın altındaki panele kadar seçilir.
  // Parmak kalkınca seçim kalır ve mod kapanır; sonraki sürükleme yine taşır / kamerayı çevirir.
  function pickPanelAt(clientX, clientY) {
    setPointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(surfaceMeshes, false)
      .find((entry) => entry.object?.userData?.selectionMode === 'panel')?.object ?? null;
  }

  function endMultiSelectMode() {
    panelSweep = null;
    multiSelectMode = false;
    const done = onMultiSelectModeEnd;
    onMultiSelectModeEnd = null;
    done?.();
  }

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (multiSelectMode !== 'panel' || event.button !== 0 || !stageLayout) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const panel = pickPanelAt(event.clientX, event.clientY);
    if (!panel) return;
    panelSweep = { pointerId: event.pointerId, downPanel: panel, surfaceId: panel.userData.surfaceId, swept: false };
  }, { capture: true, signal });

  // Ctrl/Cmd + sol tık, seçili olana göre ("seçilenin çoğulu"); OrbitControls'tan önce yakalanır.
  // - modülün tamamı seçiliyse (çift tık, turuncu): tıklanan modülü toplu seçime ekler/çıkarır;
  // - yüzey seçiliyse veya seçim yoksa: çoklu panel dikdörtgeni / banko yüzü (bugünkü davranış).
  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const moduleLevelSelection = selectedSurfaces.size === 0
      && (Boolean(selectedModuleId) || multiSelectedModuleIds.size > 0);
    if (moduleLevelSelection) {
      const moduleId = moduleIdAt(event.clientX, event.clientY);
      if (moduleId) toggleMultiModuleSelection(moduleId);
      return;
    }
    handleSurfaceSelectionAt(event.clientX, event.clientY, true);
  }, { capture: true });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (!floorAreaDrawArmed || event.button !== 0 || event.ctrlKey || event.metaKey) return;
    const ground = getGroundPoint(event.clientX, event.clientY);
    if (!ground || !stageLayout) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    controls.enabled = false;
    floorDrawSession = {
      pointerId: event.pointerId,
      anchor: ground,
      current: ground,
    };
  }, { capture: true });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const rectangleSelect = event.ctrlKey || event.metaKey;
    if (rectangleSelect) {
      handleSurfaceSelectionAt(event.clientX, event.clientY, true);
      return;
    }

    const picked = stageLayout ? pickModuleAt(event.clientX, event.clientY) : null;
    if (!picked) {
      handleSurfaceSelectionAt(event.clientX, event.clientY, false);
      return;
    }

    const moduleState = picked.moduleGroup.userData.moduleState;
    if (!moduleState) {
      handleSurfaceSelectionAt(event.clientX, event.clientY, false);
      return;
    }

    const fabricMoveLock = getFabricMoveLock(moduleState.id);
    if (fabricMoveLock) {
      handleSurfaceSelectionAt(event.clientX, event.clientY, false, moduleState.id);
      showPlacementFeedback('Bu modül tek parça Lightbox/Mesh kaplamasına bağlı. Taşımak için önce kaplamayı kaldır.', {
        clientX: event.clientX,
        clientY: event.clientY,
        durationMs: 1800,
      });
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    controls.enabled = false;
    const dragRotationZDeg = normalizeModuleRotationZDeg(moduleState.placement?.rotationZDeg);
    const dragVertical = isVerticalModuleRotation(dragRotationZDeg);
    const moduleWidthCm = Number(moduleState.widthCm) || 0;
    const moduleCenterXCm = Number(moduleState.placement?.xCm || 0) + (dragVertical ? 0 : moduleWidthCm / 2);
    const moduleCenterYCm = Number(moduleState.placement?.yCm || 0) + (dragVertical ? moduleWidthCm / 2 : 0);
    const dragPlaneY = Number(picked.hit?.point?.y);
    const dragStartPoint = getDragPlanePoint(event.clientX, event.clientY, dragPlaneY);
    dragSession = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moduleGroup: picked.moduleGroup,
      moduleState,
      dragging: false,
      preview: null,
      preferredRotationZDeg: dragRotationZDeg,
      rotationCursorZDeg: dragRotationZDeg,
      rotationLocked: false,
      dragPlaneY,
      dragAnchorOffsetXCm: dragStartPoint ? moduleCenterXCm - dragStartPoint.xCm : 0,
      dragAnchorOffsetYCm: dragStartPoint ? moduleCenterYCm - dragStartPoint.yCm : 0,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      // Kilitli modülde oturum yalnız tıklamayı ve uyarıyı yönetir; taşıma başlamaz.
      locked: isModuleLocked(moduleState),
      lockedWarned: false,
      // Gruptaki öğe sürüklenince bütün grup aynı kaydırmayla taşınır.
      groupId: getModuleGroupId(moduleState),
      groupStartPoint: dragStartPoint,
      groupPreview: null,
      groupFeedback: null,
    };

    renderer.domElement.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });

  const hostWindow = getFairStandHostWindow();
  hostWindow.addEventListener('pointermove', (event) => {
    if (longPress && event.pointerId === longPress.pointerId
      && Math.hypot(event.clientX - longPress.clientX, event.clientY - longPress.clientY) > LONG_PRESS_MOVE_PX) {
      cancelLongPress();
    }
  }, { signal });
  hostWindow.addEventListener('pointerup', (event) => {
    if (longPress && event.pointerId === longPress.pointerId) cancelLongPress();
  }, { signal });
  hostWindow.addEventListener('pointercancel', cancelLongPress, { signal });
  hostWindow.addEventListener('pointermove', (event) => {
    if (!panelSweep || event.pointerId !== panelSweep.pointerId) return;
    const panel = pickPanelAt(event.clientX, event.clientY);
    if (!panel || panel.userData.surfaceId === panelSweep.surfaceId) return;
    if (!panelSweep.swept) {
      panelSweep.swept = true;
      selectOnly(panelSweep.downPanel);
    }
    panelSweep.surfaceId = panel.userData.surfaceId;
    selectRectangleTo(panel);
  }, { signal });
  const finishPanelSweep = (event) => {
    if (!panelSweep || event.pointerId !== panelSweep.pointerId) return;
    if (event.type === 'pointerup' && !panelSweep.swept) {
      const hasPanelAnchor = [...selectedSurfaces].some((mesh) => mesh.userData?.selectionMode === 'panel');
      if (hasPanelAnchor) selectRectangleTo(panelSweep.downPanel);
      else selectOnly(panelSweep.downPanel);
    }
    endMultiSelectMode();
  };
  hostWindow.addEventListener('pointerup', finishPanelSweep, { signal });
  hostWindow.addEventListener('pointercancel', finishPanelSweep, { signal });
  hostWindow.addEventListener('pointermove', (event) => {
    if (floorDrawSession && event.pointerId === floorDrawSession.pointerId) {
      const ground = getGroundPoint(event.clientX, event.clientY);
      if (!ground || !stageLayout) return;
      floorDrawSession.current = ground;
      const draft = rectangleFromCorners(floorDrawSession.anchor, ground, {
        xCm: stageLayout.widthCm,
        yCm: stageLayout.depthCm,
      });
      updateFloorAreaPreview(draft.ok ? draft.area : null);
      return;
    }
    if (!dragSession || event.pointerId !== dragSession.pointerId) return;
    updatePlacementDrag(event);
  }, { signal });

  hostWindow.addEventListener('keydown', (event) => {
    const pressedKey = String(event.key).toLowerCase();

    const arrowScreenDirection = {
      arrowleft: new THREE.Vector2(-1, 0),
      arrowright: new THREE.Vector2(1, 0),
      arrowup: new THREE.Vector2(0, 1),
      arrowdown: new THREE.Vector2(0, -1),
    }[pressedKey];
    if (arrowScreenDirection) {
      const target = event.target;
      const tagName = String(target?.tagName ?? '').toLowerCase();
      const isEditing = tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || Boolean(target?.isContentEditable);
      if (isEditing || dragSession?.dragging) return;

      const moduleGroup = getSingleSelectedModuleGroup();
      const moduleState = moduleGroup?.userData?.moduleState;
      if (!moduleGroup || !moduleState?.placement || !stageLayout) return;

      event.preventDefault();
      if (isModuleLocked(moduleState)) {
        showPlacementFeedback(MODULE_LOCKED_MESSAGE, { durationMs: 1800 });
        return;
      }
      if (getModuleGroupId(moduleState)) {
        moveGroupByArrow(moduleGroup, moduleState, arrowScreenDirection);
        return;
      }
      // Dikey adayları yalnız DB vertical_move açık öğede (fair_stand_items.vertical_move).
      const canMoveVertically = itemMovesVertically(moduleState);
      const verticalAllowed = (candidate) => canMoveVertically || (candidate.kind !== 'vertical' && candidate.kind !== 'z');
      if (moduleState.type === 'tulle-fabric' && canMoveVertically) {
        if (pressedKey !== 'arrowup' && pressedKey !== 'arrowdown') return;
        const stepCm = getModulePlacementSnapCm(moduleState.type);
        const currentZCm = Number(moduleState.placement.zCm || 0);
        // Tül dikey kalınlığı depthCm; tepe stand tavanını geçemez.
        const nextZCm = stepTulleFabricZCm(
          currentZCm,
          pressedKey === 'arrowup' ? 'up' : 'down',
          stepCm,
          Number(moduleState.depthCm) || 0,
        );
        if (nextZCm === currentZCm) {
          showPlacementFeedback('Tül bu yönde stand sınırına ulaştı.', { durationMs: 900 });
          return;
        }
        const nextPlacement = { ...moduleState.placement, zCm: nextZCm };
        moduleState.placement = nextPlacement;
        moduleGroup.userData.placement = { ...nextPlacement };
        applyPlacementToGroup(moduleGroup, nextPlacement, moduleState.widthCm);
        clearPlacementFeedback();
        return;
      }
      if (getFabricMoveLock(moduleState.id)) {
        showPlacementFeedback('Bu modül tek parça Lightbox/Mesh kaplamasına bağlı. Taşımak için önce kaplamayı kaldır.', {
          durationMs: 1800,
        });
        return;
      }
      if (isWallOverlayModule(moduleState.type)) {
        if (usesPanelSeamOverlaySnap(moduleState)) {
          const moduleWorldPosition = new THREE.Vector3();
          moduleGroup.getWorldPosition(moduleWorldPosition);
          const projectedOrigin = moduleWorldPosition.clone().project(camera);
          const probeStepM = 0.5;
          const probeCandidates = [
            { kind: 'horizontal', delta: 1, world: new THREE.Vector3(probeStepM, 0, 0) },
            { kind: 'horizontal', delta: -1, world: new THREE.Vector3(-probeStepM, 0, 0) },
            { kind: 'vertical', delta: 1, world: new THREE.Vector3(0, probeStepM, 0) },
            { kind: 'vertical', delta: -1, world: new THREE.Vector3(0, -probeStepM, 0) },
          ];
          const bestArrowMove = probeCandidates
            .filter(verticalAllowed)
            .map((candidate) => {
              const projectedTarget = moduleWorldPosition.clone().add(candidate.world).project(camera);
              const screenDelta = new THREE.Vector2(
                projectedTarget.x - projectedOrigin.x,
                projectedTarget.y - projectedOrigin.y,
              );
              const lengthSq = screenDelta.lengthSq();
              const score = lengthSq > 1e-12
                ? screenDelta.normalize().dot(arrowScreenDirection)
                : -Infinity;
              return { ...candidate, score };
            })
            .sort((a, b) => b.score - a.score)[0];
          if (!bestArrowMove || !Number.isFinite(bestArrowMove.score)) return;
          if (bestArrowMove.kind === 'vertical') {
            const nextPlacement = stepPanelSeamOverlayPlacement({
              moduleState,
              modules: getRenderedModuleStates(),
              seamDelta: bestArrowMove.delta,
            });
            if (!nextPlacement) {
              showPlacementFeedback('Raf bu yönde panel birleşimine ulaştı.', { durationMs: 900 });
              return;
            }
            moduleState.placement = { ...nextPlacement };
            moduleGroup.userData.placement = { ...nextPlacement };
            applyPlacementToGroup(moduleGroup, nextPlacement, moduleState.widthCm);
            clearPlacementFeedback();
            return;
          }
          const stepCm = getModulePlacementSnapCm(moduleState.type);
          const nextPlacement = stepPanelSeamOverlayPlacement({
            moduleState,
            modules: getRenderedModuleStates(),
            horizontalDeltaCm: bestArrowMove.delta * stepCm,
          });
          if (!nextPlacement) {
            showPlacementFeedback('Raf bu yönde duvar açıklığı sınırına ulaştı.', { durationMs: 900 });
            return;
          }
          moduleState.placement = { ...nextPlacement };
          moduleGroup.userData.placement = { ...nextPlacement };
          applyPlacementToGroup(moduleGroup, nextPlacement, moduleState.widthCm);
          clearPlacementFeedback();
          return;
        }
        const stepCm = getModulePlacementSnapCm(moduleState.type);
        const wallId = moduleState.placement.wallId ?? 'free';
        const rotationZDeg = normalizeModuleRotationZDeg(moduleState.placement.rotationZDeg);
        const vertical = isVerticalModuleRotation(rotationZDeg);
        const horizontalAxis = wallId === 'back'
          ? 'x'
          : ((wallId === 'left' || wallId === 'right') ? 'y' : (vertical ? 'y' : 'x'));
        const horizontalLimitCm = horizontalAxis === 'x'
          ? Number(stageLayout.widthCm)
          : Number(stageLayout.depthCm);
        const widthCm = Math.max(1, Number(moduleState.widthCm) || 1);
        const currentHorizontalCm = Number(moduleState.placement[horizontalAxis + 'Cm'] || 0);
        const maxHorizontalCm = Math.max(0, horizontalLimitCm - widthCm);
        const currentZCm = Number(moduleState.placement.zCm || 0);
        const heightCm = Math.max(1, Number(moduleState.heightCm));
        const { minZCm, maxZCm } = getWallOverlayZBoundsCm(heightCm);

        const moduleWorldPosition = new THREE.Vector3();
        moduleGroup.getWorldPosition(moduleWorldPosition);
        const projectedOrigin = moduleWorldPosition.clone().project(camera);
        const worldStepM = stepCm / 100;
        const horizontalWorld = horizontalAxis === 'x'
          ? new THREE.Vector3(worldStepM, 0, 0)
          : new THREE.Vector3(0, 0, worldStepM);
        const candidates = [
          { kind: 'horizontal', deltaCm: stepCm, world: horizontalWorld.clone() },
          { kind: 'horizontal', deltaCm: -stepCm, world: horizontalWorld.clone().multiplyScalar(-1) },
          { kind: 'vertical', deltaCm: stepCm, world: new THREE.Vector3(0, worldStepM, 0) },
          { kind: 'vertical', deltaCm: -stepCm, world: new THREE.Vector3(0, -worldStepM, 0) },
        ];
        const bestArrowMove = candidates
          .filter(verticalAllowed)
          .map((candidate) => {
            const projectedTarget = moduleWorldPosition.clone().add(candidate.world).project(camera);
            const screenDelta = new THREE.Vector2(
              projectedTarget.x - projectedOrigin.x,
              projectedTarget.y - projectedOrigin.y,
            );
            const lengthSq = screenDelta.lengthSq();
            const score = lengthSq > 1e-12
              ? screenDelta.normalize().dot(arrowScreenDirection)
              : -Infinity;
            return { ...candidate, score };
          })
          .sort((a, b) => b.score - a.score)[0];
        if (!bestArrowMove || !Number.isFinite(bestArrowMove.score)) return;

        const desiredPlacement = { ...moduleState.placement };
        if (bestArrowMove.kind === 'vertical') {
          const nextZCm = THREE.MathUtils.clamp(
            currentZCm + bestArrowMove.deltaCm,
            minZCm,
            maxZCm,
          );
          if (nextZCm === currentZCm) {
            showPlacementFeedback(formatWallOverlayFeedback('stand-limit', getItem(moduleState.itemKey)), { durationMs: 900 });
            return;
          }
          desiredPlacement.zCm = nextZCm;
        } else {
          const nextHorizontalCm = THREE.MathUtils.clamp(
            currentHorizontalCm + bestArrowMove.deltaCm,
            0,
            maxHorizontalCm,
          );
          if (nextHorizontalCm === currentHorizontalCm) {
            showPlacementFeedback(formatWallOverlayFeedback('stand-limit', getItem(moduleState.itemKey)), { durationMs: 900 });
            return;
          }
          desiredPlacement[horizontalAxis + 'Cm'] = nextHorizontalCm;
        }

        moduleState.placement = { ...desiredPlacement };
        moduleGroup.userData.placement = { ...desiredPlacement };
        applyPlacementToGroup(moduleGroup, desiredPlacement, moduleState.widthCm);
        clearPlacementFeedback();
        return;
      }

      if (canMoveVertically && getModuleBehavior(moduleState).placement === 'wall') {
        const stepCm = getModulePlacementSnapCm(moduleState.type);
        const moduleWorldPosition = new THREE.Vector3();
        moduleGroup.getWorldPosition(moduleWorldPosition);
        const projectedOrigin = moduleWorldPosition.clone().project(camera);
        const worldStepM = stepCm / 100;
        const candidates = [
          { kind: 'horizontal', world: new THREE.Vector3(worldStepM, 0, 0) },
          { kind: 'horizontal', world: new THREE.Vector3(-worldStepM, 0, 0) },
          { kind: 'horizontal', world: new THREE.Vector3(0, 0, worldStepM) },
          { kind: 'horizontal', world: new THREE.Vector3(0, 0, -worldStepM) },
          { kind: 'vertical', deltaCm: stepCm, world: new THREE.Vector3(0, worldStepM, 0) },
          { kind: 'vertical', deltaCm: -stepCm, world: new THREE.Vector3(0, -worldStepM, 0) },
        ];
        const bestArrowMove = candidates
          .filter(verticalAllowed)
          .map((candidate) => {
            const projectedTarget = moduleWorldPosition.clone().add(candidate.world).project(camera);
            const screenDelta = new THREE.Vector2(
              projectedTarget.x - projectedOrigin.x,
              projectedTarget.y - projectedOrigin.y,
            );
            const lengthSq = screenDelta.lengthSq();
            const score = lengthSq > 1e-12
              ? screenDelta.normalize().dot(arrowScreenDirection)
              : -Infinity;
            return { ...candidate, score };
          })
          .sort((a, b) => b.score - a.score)[0];
        if (bestArrowMove?.kind === 'vertical' && Number.isFinite(bestArrowMove.score)) {
          const currentZCm = Number(moduleState.placement.zCm || 0);
          const nextZCm = stepWallShortFloorZCm(currentZCm, bestArrowMove.deltaCm, moduleState.heightCm);
          if (nextZCm === currentZCm) {
            showPlacementFeedback('Panel bu yönde stand sınırına ulaştı.', { durationMs: 900 });
            return;
          }
          const desiredPlacement = {
            ...moduleState.placement,
            zCm: nextZCm,
          };
          moduleState.placement = { ...desiredPlacement };
          moduleGroup.userData.placement = { ...desiredPlacement };
          applyPlacementToGroup(moduleGroup, desiredPlacement, moduleState.widthCm);
          clearPlacementFeedback();
          return;
        }
      }

      if (moduleState.type === 'box-block') {
        const stepCm = getModulePlacementSnapCm(moduleState.type);
        const moduleWorldPosition = new THREE.Vector3();
        moduleGroup.getWorldPosition(moduleWorldPosition);
        const projectedOrigin = moduleWorldPosition.clone().project(camera);
        const worldStepM = stepCm / 100;
        const candidates = [
          { kind: 'x', deltaCm: stepCm, world: new THREE.Vector3(worldStepM, 0, 0) },
          { kind: 'x', deltaCm: -stepCm, world: new THREE.Vector3(-worldStepM, 0, 0) },
          { kind: 'y', deltaCm: stepCm, world: new THREE.Vector3(0, 0, worldStepM) },
          { kind: 'y', deltaCm: -stepCm, world: new THREE.Vector3(0, 0, -worldStepM) },
          { kind: 'z', deltaCm: stepCm, world: new THREE.Vector3(0, worldStepM, 0) },
          { kind: 'z', deltaCm: -stepCm, world: new THREE.Vector3(0, -worldStepM, 0) },
        ];
        const bestArrowMove = candidates
          .filter(verticalAllowed)
          .map((candidate) => {
            const projectedTarget = moduleWorldPosition.clone().add(candidate.world).project(camera);
            const screenDelta = new THREE.Vector2(
              projectedTarget.x - projectedOrigin.x,
              projectedTarget.y - projectedOrigin.y,
            );
            const lengthSq = screenDelta.lengthSq();
            const score = lengthSq > 1e-12
              ? screenDelta.normalize().dot(arrowScreenDirection)
              : -Infinity;
            return { ...candidate, score };
          })
          .sort((a, b) => b.score - a.score)[0];
        if (!bestArrowMove || !Number.isFinite(bestArrowMove.score)) return;

        if (bestArrowMove.kind === 'z') {
          const currentZCm = Number(moduleState.placement.zCm || 0);
          const nextZCm = stepWallShortFloorZCm(currentZCm, bestArrowMove.deltaCm, moduleState.heightCm);
          if (nextZCm === currentZCm) {
            showPlacementFeedback('Kutu bu yönde stand sınırına ulaştı.', { durationMs: 900 });
            return;
          }
          const liftedPlacement = { ...moduleState.placement, zCm: nextZCm };
          moduleState.placement = { ...liftedPlacement };
          moduleGroup.userData.placement = { ...liftedPlacement };
          applyPlacementToGroup(moduleGroup, liftedPlacement, moduleState.widthCm);
          clearPlacementFeedback();
          return;
        }

        const desiredPlacement = createModulePlacement({
          ...moduleState.placement,
          xCm: Number(moduleState.placement.xCm || 0) + (bestArrowMove.kind === 'x' ? bestArrowMove.deltaCm : 0),
          yCm: Number(moduleState.placement.yCm || 0) + (bestArrowMove.kind === 'y' ? bestArrowMove.deltaCm : 0),
          wallId: 'free',
        });
        desiredPlacement.zCm = Number(moduleState.placement.zCm || 0);
        const renderedModules = getRenderedModuleStates();
        const validation = validatePlacementAgainstModules({
          placement: desiredPlacement,
          widthCm: moduleState.widthCm,
          depthCm: moduleState.depthCm,
          moduleId: moduleState.id,
          moduleType: moduleState.type,
          itemKey: moduleState.itemKey,
          heightCm: moduleState.heightCm,
          shape: moduleState.shape,
          modules: renderedModules,
          standType: stageLayout.standType,
          standXCm: stageLayout.widthCm,
          standYCm: stageLayout.depthCm,
        });
        if (!validation.ok) {
          showPlacementFeedback(validation.message ?? 'Kutu bu yönde hareket edemez.', { durationMs: 900 });
          return;
        }
        moduleState.placement = { ...desiredPlacement };
        moduleGroup.userData.placement = { ...desiredPlacement };
        applyPlacementToGroup(moduleGroup, desiredPlacement, moduleState.widthCm);
        clearPlacementFeedback();
        return;
      }

      if (isTopFixtureType(moduleState.type)) {
        const stepCm = getModulePlacementSnapCm(moduleState.type) || 20;
        const moduleWorldPosition = new THREE.Vector3();
        moduleGroup.getWorldPosition(moduleWorldPosition);
        const projectedOrigin = moduleWorldPosition.clone().project(camera);
        const worldStepM = stepCm / 100;
        const candidates = [
          { kind: 'x', deltaCm: stepCm, world: new THREE.Vector3(worldStepM, 0, 0) },
          { kind: 'x', deltaCm: -stepCm, world: new THREE.Vector3(-worldStepM, 0, 0) },
          { kind: 'y', deltaCm: stepCm, world: new THREE.Vector3(0, 0, worldStepM) },
          { kind: 'y', deltaCm: -stepCm, world: new THREE.Vector3(0, 0, -worldStepM) },
          { kind: 'z', deltaCm: stepCm, world: new THREE.Vector3(0, worldStepM, 0) },
          { kind: 'z', deltaCm: -stepCm, world: new THREE.Vector3(0, -worldStepM, 0) },
        ];
        const bestArrowMove = candidates
          .filter(verticalAllowed)
          .map((candidate) => {
            const projectedTarget = moduleWorldPosition.clone().add(candidate.world).project(camera);
            const screenDelta = new THREE.Vector2(
              projectedTarget.x - projectedOrigin.x,
              projectedTarget.y - projectedOrigin.y,
            );
            const lengthSq = screenDelta.lengthSq();
            const score = lengthSq > 1e-12
              ? screenDelta.normalize().dot(arrowScreenDirection)
              : -Infinity;
            return { ...candidate, score };
          })
          .sort((a, b) => b.score - a.score)[0];
        if (!bestArrowMove || !Number.isFinite(bestArrowMove.score)) return;

        if (bestArrowMove.kind === 'z') {
          const currentZCm = Number(moduleState.placement.zCm || 0);
          const nextZCm = stepMountBottomZCm(currentZCm, bestArrowMove.deltaCm);
          if (nextZCm === currentZCm) {
            showPlacementFeedback('Projektör bu yönde stand sınırına ulaştı.', { durationMs: 900 });
            return;
          }
          const liftedPlacement = { ...moduleState.placement, zCm: nextZCm };
          moduleState.placement = { ...liftedPlacement };
          moduleGroup.userData.placement = { ...liftedPlacement };
          applyPlacementToGroup(moduleGroup, liftedPlacement, moduleState.widthCm);
          clearPlacementFeedback();
          return;
        }

        const desiredTopPlacement = createModulePlacement({
          ...moduleState.placement,
          xCm: Number(moduleState.placement.xCm || 0) + (bestArrowMove.kind === 'x' ? bestArrowMove.deltaCm : 0),
          yCm: Number(moduleState.placement.yCm || 0) + (bestArrowMove.kind === 'y' ? bestArrowMove.deltaCm : 0),
          wallId: moduleState.placement.wallId || 'free',
        });
        desiredTopPlacement.zCm = clampMountBottomZCm(Number(moduleState.placement.zCm || 0));
        const topRendered = getRenderedModuleStates();
        const topValidation = validatePlacementAgainstModules({
          placement: desiredTopPlacement,
          widthCm: moduleState.widthCm,
          depthCm: moduleState.depthCm,
          moduleId: moduleState.id,
          moduleType: moduleState.type,
          itemKey: moduleState.itemKey,
          heightCm: moduleState.heightCm,
          shape: moduleState.shape,
          modules: topRendered,
          standType: stageLayout.standType,
          standXCm: stageLayout.widthCm,
          standYCm: stageLayout.depthCm,
        });
        if (!topValidation.ok) {
          showPlacementFeedback(topValidation.message ?? 'Projektör bu yönde hareket edemez.', { durationMs: 900 });
          return;
        }
        moduleState.placement = { ...desiredTopPlacement };
        moduleGroup.userData.placement = { ...desiredTopPlacement };
        applyPlacementToGroup(moduleGroup, desiredTopPlacement, moduleState.widthCm);
        clearPlacementFeedback();
        return;
      }

      const stepCm = getModulePlacementSnapCm(moduleState.type);
      const moduleWorldPosition = new THREE.Vector3();
      moduleGroup.getWorldPosition(moduleWorldPosition);
      const projectedOrigin = moduleWorldPosition.clone().project(camera);
      const worldStepM = stepCm / 100;
      const candidates = [
        { xCm: stepCm, yCm: 0, world: new THREE.Vector3(worldStepM, 0, 0) },
        { xCm: -stepCm, yCm: 0, world: new THREE.Vector3(-worldStepM, 0, 0) },
        { xCm: 0, yCm: stepCm, world: new THREE.Vector3(0, 0, worldStepM) },
        { xCm: 0, yCm: -stepCm, world: new THREE.Vector3(0, 0, -worldStepM) },
      ];
      const bestArrowMove = candidates
        .map((candidate) => {
          const projectedTarget = moduleWorldPosition.clone().add(candidate.world).project(camera);
          const screenDelta = new THREE.Vector2(
            projectedTarget.x - projectedOrigin.x,
            projectedTarget.y - projectedOrigin.y,
          );
          const lengthSq = screenDelta.lengthSq();
          const score = lengthSq > 1e-12
            ? screenDelta.normalize().dot(arrowScreenDirection)
            : -Infinity;
          return { ...candidate, score };
        })
        .sort((a, b) => b.score - a.score)[0];
      if (!bestArrowMove || !Number.isFinite(bestArrowMove.score)) return;

      const desiredPlacement = createModulePlacement({
        ...moduleState.placement,
        xCm: Number(moduleState.placement.xCm || 0) + bestArrowMove.xCm,
        yCm: Number(moduleState.placement.yCm || 0) + bestArrowMove.yCm,
        wallId: 'free',
      });
      desiredPlacement.zCm = Number(moduleState.placement.zCm || 0);

      const renderedModules = getRenderedModuleStates();
      const validation = validatePlacementAgainstModules({
        placement: desiredPlacement,
        widthCm: moduleState.widthCm,
        depthCm: moduleState.depthCm,
        moduleId: moduleState.id,
        moduleType: moduleState.type,
        itemKey: moduleState.itemKey,
        heightCm: moduleState.heightCm,
        shape: moduleState.shape,
        modules: renderedModules,
        standType: stageLayout.standType,
        standXCm: stageLayout.widthCm,
        standYCm: stageLayout.depthCm,
      });
      if (!validation.ok) {
        showPlacementFeedback(validation.message ?? 'Bu yöne hareket edemez.', { durationMs: 900 });
        return;
      }

      moduleState.placement = { ...desiredPlacement };
      moduleGroup.userData.placement = { ...desiredPlacement };
      applyPlacementToGroup(moduleGroup, desiredPlacement, moduleState.widthCm);
      clearPlacementFeedback();
      return;
    }
    if (pressedKey === 'delete') {
      const target = event.target;
      const tagName = String(target?.tagName ?? '').toLowerCase();
      const isEditing = tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || Boolean(target?.isContentEditable);
      if (isEditing || event.repeat || deleteShortcutLatched) return;

      const moduleGroup = getSingleSelectedModuleGroup();
      if (!moduleGroup) return;
      event.preventDefault();
      deleteShortcutLatched = true;
      queueMicrotask(() => {
        deleteShortcutLatched = false;
      });
      window.dispatchEvent(new CustomEvent('fair-stand:delete-selected-module', {
        detail: {
          moduleId: moduleGroup.userData?.moduleId ?? null,
          moduleIndex: moduleGroup.userData?.moduleIndex ?? null,
        },
      }));
      return;
    }

    const shortcut = resolveViewKeyboardShortcut(event);
    if (!shortcut) return;

    const isEditing = isEditableKeyboardTarget(event.target);

    if (isEditing && !dragSession?.dragging) return;

    if (shortcut.type === 'projection') {
      if (dragSession?.dragging) return;
      event.preventDefault();
      setCameraMode(shortcut.mode);
      return;
    }

    if (shortcut.type === 'view') {
      if (dragSession?.dragging) return;
      const directions = {
        left: new THREE.Vector3(-1, 0, 0),
        right: new THREE.Vector3(1, 0, 0),
        top: new THREE.Vector3(0, 1, 0),
        front: new THREE.Vector3(0, 0, 1),
        home: resolveHomeViewDirection(stageLayout?.standType),
      };
      const direction = directions[shortcut.direction];
      if (!direction) return;
      event.preventDefault();
      viewCube.setViewDirection(direction);
      return;
    }

    if (shortcut.type !== 'rotate') return;

    const requestedDeltaDeg = -90;

    if (dragSession?.dragging) {
      event.preventDefault();
      const deltaDeg = resolveModuleRotationDeltaDeg(dragSession.moduleState, requestedDeltaDeg);
      const rotationCursorZDeg = rotateModuleRotationZDeg(
        dragSession.rotationCursorZDeg ?? dragSession.preferredRotationZDeg,
        deltaDeg,
      );
      // Rotation intent must survive an invalid intermediate preview. Snap/validation may
      // turn the ghost red, but the next Shift+R continues from this requested angle
      // instead of falling back to the last valid placement rotation.
      dragSession.rotationCursorZDeg = rotationCursorZDeg;
      dragSession.preferredRotationZDeg = rotationCursorZDeg;
      dragSession.rotationLocked = true;
      updatePlacementDrag({
        clientX: dragSession.lastClientX,
        clientY: dragSession.lastClientY,
      });
      dragSession.preferredRotationZDeg = rotationCursorZDeg;
      return;
    }

    const rotationResult = rotateSelectedModule(requestedDeltaDeg);
    if (rotationResult.handled) event.preventDefault();
  }, { signal });

  hostWindow.addEventListener('pointerup', (event) => {
    if (floorDrawSession && event.pointerId === floorDrawSession.pointerId) {
      const draft = rectangleFromCorners(floorDrawSession.anchor, floorDrawSession.current, {
        xCm: stageLayout?.widthCm,
        yCm: stageLayout?.depthCm,
      });
      floorDrawSession = null;
      floorAreaDrawArmed = false;
      controls.enabled = true;
      clearFloorAreaPreview();
      onFloorAreaDrawn(draft);
      return;
    }
    if (!dragSession || event.pointerId !== dragSession.pointerId) return;
    const startClientX = dragSession.startClientX;
    const startClientY = dragSession.startClientY;
    const clickedModuleId = dragSession.moduleState?.id ?? null;
    const wasDragging = finishPlacementDrag(event);
    if (!wasDragging) {
      handleSurfaceSelectionAt(startClientX, startClientY, false, clickedModuleId);
    }
  }, { signal });

  hostWindow.addEventListener('pointercancel', (event) => {
    if (floorDrawSession && event.pointerId === floorDrawSession.pointerId) {
      floorDrawSession = null;
      floorAreaDrawArmed = false;
      controls.enabled = true;
      clearFloorAreaPreview();
      return;
    }
    if (!dragSession || event.pointerId !== dragSession.pointerId) return;
    clearPlacementDrag();
  }, { signal });

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    updateCameraProjection(width, height);
    requestEditorRender();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  // Duran sahne her kare çizilmez. Kamera, sürükleme, model veya doku gelince bir kare istenir.
  const activeFrameIntervalMs = coarsePointer ? (1000 / 30) : (1000 / 50);
  let lastRenderAt = -Infinity;
  let lastControlsUpdateAt = null;
  const lastCubePosition = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  const lastCubeQuaternion = new THREE.Quaternion(Number.NaN, Number.NaN, Number.NaN, Number.NaN);

  renderer.setAnimationLoop((now) => {
    // Keep the existing 0.05/60Hz smoothing, independent of slow WebGL frames.
    // Use the full elapsed time: capping it prolongs inertia below 10 FPS.
    // Blur/visibility loss already discard queued motion before a paused frame.
    const elapsedMs = lastControlsUpdateAt === null ? 1000 / 60 : Math.max(0, now - lastControlsUpdateAt);
    lastControlsUpdateAt = now;
    controls.dampingFactor = 1 - Math.pow(1 - 0.05, elapsedMs * 60 / 1000);
    const controlsChanged = Boolean(controls.update());
    const activelyDragging = Boolean(dragSession?.dragging);
    if (controlsChanged || activelyDragging) editorRenderRequested = true;
    if (!editorRenderRequested) return;
    const frameInterval = (controlsChanged || activelyDragging) ? activeFrameIntervalMs : 0;
    if (frameInterval && now - lastRenderAt < frameInterval) return;
    lastRenderAt = now;

    const cameraChanged = !camera.position.equals(lastCubePosition)
      || !camera.quaternion.equals(lastCubeQuaternion);
    if (cameraChanged) {
      syncPerspectiveNear();
      viewCube.update();
      lastCubePosition.copy(camera.position);
      lastCubeQuaternion.copy(camera.quaternion);
    }
    syncMeasureOverlay();
    const renderStartedAt = performance.now();
    const programsBefore = renderer.info.programs?.length ?? 0;
    const texturesBefore = renderer.info.memory?.textures ?? 0;
    renderer.render(scene, camera);
    flushDeferredWallDisposal();
    // Proje açılışı "sahne çizildi" anını bekler; sahne yenileme ölçümü kare süresini kullanır.
    noteSceneRender(
      performance.now() - renderStartedAt,
      (renderer.info.programs?.length ?? 0) - programsBefore,
      (renderer.info.memory?.textures ?? 0) - texturesBefore,
    );
    if (!controlsChanged && !activelyDragging) editorRenderRequested = false;
    emitSelectionAnchor(activelyDragging);
  });

  let lastSelectionAnchorKey = '';
  const selectionAnchorBox = new THREE.Box3();
  const selectionAnchorPoint = new THREE.Vector3();

  function selectedModuleGroupsForAnchor() {
    if (multiSelectedModuleIds.size > 1) {
      return [...multiSelectedModuleIds].map((id) => findModuleGroupById(id)).filter(Boolean);
    }
    const single = getSingleSelectedModuleGroup();
    if (single) return [single];
    // Komşu modüllere yayılan panel seçimi (Ctrl + tık / parmak taraması): panellerin modülleri.
    const moduleIds = new Set([...selectedSurfaces].map((surface) => surface.userData?.moduleId).filter(Boolean));
    return [...moduleIds].map((moduleId) => findModuleGroupById(moduleId)).filter(Boolean);
  }

  function emitSelectionAnchor(dragging) {
    let anchor = null;
    const groups = dragging ? [] : selectedModuleGroupsForAnchor();
    if (groups.length) {
      selectionAnchorBox.makeEmpty();
      groups.forEach((group) => selectionAnchorBox.expandByObject(group));
      selectionAnchorBox.getCenter(selectionAnchorPoint);
      selectionAnchorPoint.y = selectionAnchorBox.max.y;
      selectionAnchorPoint.project(camera);
      const rect = renderer.domElement.getBoundingClientRect();
      // Yakınlaşınca modülün tepesi ekranın üstünde kalabilir: çubuk o zaman üst kenara yapışır
      // (konumu çubuk sınırlar); yalnız tepe ekranın altında veya yanlarda kalırsa gizlenir.
      const visible = selectionAnchorPoint.z < 1
        && Math.abs(selectionAnchorPoint.x) <= 1.05 && selectionAnchorPoint.y >= -1.05;
      if (visible) {
        anchor = {
          clientX: Math.round(rect.left + ((selectionAnchorPoint.x + 1) / 2) * rect.width),
          clientY: Math.round(rect.top + ((1 - selectionAnchorPoint.y) / 2) * rect.height),
          count: groups.length,
          kind: multiSelectedModuleIds.size <= 1
            && [...selectedSurfaces].some((mesh) => mesh.userData?.selectionMode === 'panel')
            ? 'panel'
            : 'module',
        };
      }
    }
    const key = anchor ? `${anchor.clientX},${anchor.clientY},${anchor.count},${anchor.kind}` : '';
    if (key === lastSelectionAnchorKey) return;
    lastSelectionAnchorKey = key;
    onSelectionAnchor?.(anchor);
  }

  // mode: false | 'module' | 'panel'. onEnd: tek seferlik panel taraması bitince çağrılır.
  function setMultiSelectMode(mode, { onEnd = null } = {}) {
    multiSelectMode = mode === 'panel' || mode === 'module' ? mode : false;
    onMultiSelectModeEnd = multiSelectMode ? onEnd : null;
    panelSweep = null;
  }

  // Menü ve araç çubuğu Döndür: modülü seçip klavyedeki Shift+R ile aynı döndürmeyi yapar.
  function rotateModuleById(moduleId) {
    if (moduleId && getSingleSelectedModuleGroup()?.userData?.moduleState?.id !== moduleId) {
      selectModulesById([moduleId]);
    }
    return rotateSelectedModule(-90);
  }

  async function captureCurrentViewPng({ scale = 3 } = {}) {
    if (!stageLayout) return { ok: false, message: 'Önce stand sahnesini oluştur.' };

    const cssWidth = Math.max(1, renderer.domElement.clientWidth || container.clientWidth || 1);
    const cssHeight = Math.max(1, renderer.domElement.clientHeight || container.clientHeight || 1);
    const safeScale = Math.min(3, Math.max(1, Number(scale) || 3));
    const targetWidth = Math.round(cssWidth * safeScale);
    const targetHeight = Math.round(cssHeight * safeScale);
    const previousPixelRatio = renderer.getPixelRatio();
    const selectedFrames = [...selectedSurfaces]
      .map((surface) => surface.userData?.selectionFrame)
      .filter(Boolean);
    const selectedVisibility = selectedFrames.map((frame) => frame.visible);
    const moduleSelectionFrame = findModuleGroupById(selectedModuleId)?.userData?.moduleSelectionFrame ?? null;
    const moduleSelectionVisibility = moduleSelectionFrame?.visible ?? false;
    const guideVisibility = activeWallGuides.map((guide) => guide.visible);
    const renderTransmissionMaterials = new Set();
    scene.traverse((object) => {
      [object.material].flat().forEach((material) => {
        if (material?.userData?.renderTransmission > 0) renderTransmissionMaterials.add(material);
      });
    });

    const editorAidVisibility = [measureGroup.visible, standFloorGrid?.visible ?? false];
    try {
      selectedFrames.forEach((frame) => { frame.visible = false; });
      if (moduleSelectionFrame) moduleSelectionFrame.visible = false;
      activeWallGuides.forEach((guide) => { guide.visible = false; });
      // Müşteriye giden görselde ölçü katmanı ve zemin ızgarası yok.
      measureGroup.visible = false;
      if (standFloorGrid) standFloorGrid.visible = false;

      renderer.setPixelRatio(1);
      renderer.setSize(targetWidth, targetHeight, false);
      updateCameraProjection(targetWidth, targetHeight);
      controls.update();
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.needsUpdate = true;
      camera.layers.enable(RENDER_ONLY_LIGHT_LAYER);
      applyStageLighting(true, { forRender: true });
      renderTransmissionMaterials.forEach((material) => { material.transmission = material.userData.renderTransmission; });
      renderer.render(scene, camera);

      const blob = await new Promise((resolve) => {
        renderer.domElement.toBlob(resolve, 'image/png');
      });
      if (!blob) return { ok: false, message: 'Render görüntüsü oluşturulamadı.' };
      return { ok: true, blob, width: targetWidth, height: targetHeight };
    } finally {
      renderer.shadowMap.enabled = false;
      camera.layers.disable(RENDER_ONLY_LIGHT_LAYER);
      // Render öncesi önizleme açıksa açık, kapalıysa kapalı haline döner.
      applyStageLighting(stageLightPreview);
      renderTransmissionMaterials.forEach((material) => { material.transmission = 0; });
      selectedFrames.forEach((frame, index) => { frame.visible = selectedVisibility[index]; });
      if (moduleSelectionFrame) moduleSelectionFrame.visible = moduleSelectionVisibility;
      activeWallGuides.forEach((guide, index) => { guide.visible = guideVisibility[index]; });
      [measureGroup.visible] = editorAidVisibility;
      if (standFloorGrid) standFloorGrid.visible = editorAidVisibility[1];
      renderer.setPixelRatio(previousPixelRatio);
      renderer.setSize(cssWidth, cssHeight, false);
      updateCameraProjection(cssWidth, cssHeight);
      controls.update();
      renderer.render(scene, camera);
    }
    if (fabricGroupIds.size) rebuildFabricOverlays();
  }

  function setShelfLightingVisible(moduleIndex, enabled) {
    requestEditorRender();
    const targetIndex = Number(moduleIndex);
    const visible = Boolean(enabled);
    let changed = false;

    wallRoot.children.forEach((group) => {
      if (Number(group.userData?.moduleIndex) !== targetIndex) return;
      if (group.userData?.moduleState?.type !== 'shelf') return;

      group.userData.moduleState.shelfLightingOn = visible;
      group.traverse((object) => {
        const role = object.userData?.role;
        if (role === 'shelf-under-led-strip' || role === 'shelf-under-light') {
          object.visible = visible;
          changed = true;
        }
      });
    });

    return changed;
  }

  function setFloorArea(area) {
    currentFloorArea = area ? { ...area } : null;
    floorAreaDrawArmed = false;
    floorDrawSession = null;
    clearFloorAreaPreview();
    rebuildFloorAreaVisual();
    return currentFloorArea;
  }

  function setFloorAreaColor(color) {
    if (!currentFloorArea || !getFloorItem(currentFloorArea.itemKey)?.paintable) return null;
    const normalized = String(color ?? '').trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(normalized)) return currentFloorArea.color ?? null;
    currentFloorArea = { ...currentFloorArea, color: normalized.toLowerCase() };
    rebuildFloorAreaVisual();
    if (floorAreaSelected) setFloorAreaHighlight(true);
    return currentFloorArea.color;
  }

  function setFloorAreaDrawArmed(enabled, handler) {
    floorAreaDrawArmed = Boolean(enabled);
    if (typeof handler === 'function') onFloorAreaDrawn = handler;
    if (!floorAreaDrawArmed) {
      floorDrawSession = null;
      clearFloorAreaPreview();
      controls.enabled = true;
    }
    return floorAreaDrawArmed;
  }

  return {
    captureCurrentViewPng,
    setStageLightPreview,
    requestRender: requestEditorRender,
    appendModule,
    removeModule,
    syncModules,
    setShelfLightingVisible,
    setCameraMode,
    getCameraMode: () => cameraMode,
    createStage,
    setFloorType,
    setFloorColor,
    setFloorArea,
    setFloorAreaColor,
    setFloorAreaDrawArmed,
    isFloorAreaSelected: () => floorAreaSelected,
    getSelectedModuleIds,
    selectModulesById,
    getSelectionContext,
    rotateModuleById,
    setMultiSelectMode,
    showPlacementFeedback,
    buildWall,
    clearWall,
    clearSelection: (...args) => {
      selectedModuleId = null;
      return clearSelection(...args);
    },
    resetStageView,
    resetDefaultView,
    applyColor,
    applyGlassMode,
    applyMetalSeparatorMode,
    applyFabricMode,
    applyMeshMode,
    setFabricLighting,
    applyImageAsset,
    applySizeImageAsset,
    resolveImageBlock,
    describeImageSizeTarget,
    applyHorizontalImageAsset,
    applyRectImageAsset,
    clearImage,
    clearImageAssetById,
    previewCatalogModuleDrag,
    dropCatalogModuleDrag,
    clearCatalogModuleDrag,
    getStageLayout: () => (stageLayout ? { ...stageLayout } : null),
    getSelectedSurface: () => [...selectedSurfaces][0] ?? null,
    getSelectedSurfaces: () => [...selectedSurfaces],
    isFloorSelected: () => floorSelected,
    getSelectedFloorType: () => (floorSelected ? currentFloorType : null),
    setIlluminatedFoamHaloColor: (moduleId, color) => {
      const normalized=String(color??'').trim().toLowerCase();
      if(!/^#[0-9a-f]{6}$/.test(normalized)) return false;
      let changed=false;
      wallRoot.traverse((object)=>{
        if(object.userData?.role!=='illuminated-foam-halo'||object.userData?.moduleId!==moduleId) return;
        if(object.material?.color){ object.material.color.set(normalized); object.material.needsUpdate=true; changed=true; requestEditorRender(); }
      });
      return changed;
    },
    dispose() {
      sceneAbort.abort();
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      deferredWallDisposal.splice(0).forEach(disposeObject);
      controls.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
      placementFeedback?.remove?.();
      dragBadge?.remove?.();
      measureLabels.forEach(({ element }) => element.remove());
    },
  };
}

function createBoxBlockModule(moduleState, moduleIndex, onSurfaceReady) {
  const widthCm = Math.max(1, Number(moduleState.widthCm) || 100);
  const depthCm = Math.max(1, Number(moduleState.depthCm) || 50);
  const heightCm = Math.max(1, Number(moduleState.heightCm) || 50);
  const widthM = widthCm / 100;
  const depthM = depthCm / 100;
  const heightM = heightCm / 100;
  const opacityRaw = Number(moduleState.opacity);
  const opacity = Number.isFinite(opacityRaw)
    ? Math.min(1, Math.max(0, opacityRaw))
    : 1;
  const color = typeof moduleState.surface?.color === 'string' && moduleState.surface.color
    ? moduleState.surface.color
    : '#e8e0d5';

  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    moduleType: 'box-block',
    widthCm,
    depthCm,
    heightCm,
  };

  // Yüz plakaları kutunun dış sınırına tam oturur (6 yüz, açıklık sıfır). Gövde aynı düzlemde
  // titreşmesin diye yanlardan ve üstten bodyInsetM kadar içeridedir; taban zeminde kalır.
  const bodyInsetM = 0.002;
  const bodyHeightM = Math.max(0.001, heightM - bodyInsetM);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(0.001, widthM - bodyInsetM * 2), bodyHeightM, Math.max(0.001, depthM - bodyInsetM * 2)),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 0.999,
    }),
  );
  // Placement-center pivot: ±W/2 ±D/2, H taban 0 (baza ile aynı).
  mesh.position.set(0, bodyHeightM / 2, 0);
  mesh.castShadow = opacity >= 0.2;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: 'surface',
    moduleId: moduleState.id,
    moduleIndex,
    moduleType: 'box-block',
    selectionMode: 'module',
    surfaceId: `${moduleState.id}:box-block`,
    widthCm,
    depthCm,
    heightCm,
    acceptsColor: true,
    acceptsImage: false,
    acceptsGlass: false,
    acceptsLightbox: false,
    acceptsMesh: false,
    ...bindRendererSurfaceState(moduleState.surface),
  };
  group.add(mesh);

  ensureBoxBlockFaces(moduleState);
  // Plakalar kutunun tam ölçüsündedir ve dış sınırında durur: kenarlarda birbirine sıfır
  // açıklıkla kavuşur, gövde rengi hiçbir köşede görünmez. Ölçü, kayıt ve BOM değişmez.
  const faceLayouts = [
    { slot: 'front', stripIndex: 0, width: widthM, height: heightM, position: [0, heightM / 2, depthM / 2], rotationY: 0 },
    { slot: 'right', stripIndex: 1, width: depthM, height: heightM, position: [widthM / 2, heightM / 2, 0], rotationY: Math.PI / 2 },
    { slot: 'back', stripIndex: 2, width: widthM, height: heightM, position: [0, heightM / 2, -depthM / 2], rotationY: Math.PI },
    { slot: 'left', stripIndex: 3, width: depthM, height: heightM, position: [-widthM / 2, heightM / 2, 0], rotationY: -Math.PI / 2 },
    // Üst yüz: yatay plaka, kutunun tepesinde. Plakanın "yukarısı" arkaya bakar; önden bakınca görsel düz okunur.
    { slot: 'top', stripIndex: 4, width: widthM, height: depthM, position: [0, heightM, 0], rotationX: -Math.PI / 2, rotationY: 0 },
  ];
  const faceCapabilities = surfaceCapabilityUserData(moduleState.itemKey);
  const faces = faceLayouts.map((layout) => {
    const faceState = moduleState.faces[layout.slot];
    const faceColor = typeof faceState?.color === 'string' && faceState.color ? faceState.color : color;
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(layout.width, layout.height),
      new THREE.MeshStandardMaterial({
        color: faceColor,
        roughness: 0.88,
        metalness: 0,
        transparent: opacity < 1,
        opacity,
        depthWrite: opacity >= 0.999,
        side: THREE.FrontSide,
      }),
    );
    face.position.set(...layout.position);
    face.rotation.set(layout.rotationX ?? 0, layout.rotationY, 0);
    const selectionFrame = createSelectionFrame(layout.width, layout.height);
    selectionFrame.visible = false;
    face.add(selectionFrame);
    face.castShadow = opacity >= 0.2;
    face.receiveShadow = true;
    face.userData = {
      kind: 'surface',
      moduleId: moduleState.id,
      moduleIndex,
      moduleType: 'box-block',
      selectionMode: 'panel',
      surfaceId: `${moduleState.id}:box-face:${layout.slot}`,
      faceSlot: layout.slot,
      stripIndex: layout.stripIndex,
      stripNumber: layout.stripIndex + 1,
      selectionFrame,
      widthCm: faceState.widthCm,
      heightCm: faceState.heightCm,
      ...faceCapabilities,
      acceptsGlass: false,
      ...bindRendererSurfaceState(faceState),
    };
    group.add(face);
    // Flat panels restore their stored image through the same hook after a rebuild
    // (project open, reload); without it a saved face image stays in state but is not drawn.
    onSurfaceReady?.(face);
    return face;
  });
  return { group, surfaces: [mesh, ...faces] };
}

function createTulleFabricModule(moduleState, moduleIndex) {
  const item = getItem(moduleState.itemKey);
  const scene = item ? resolveSceneDimensions(item) : null;
  const widthCm = Math.max(1, Number(moduleState.widthCm) || Number(scene?.widthCm) || 1);
  const heightCm = Math.max(1, Number(moduleState.heightCm) || Number(scene?.heightCm) || 1);
  const depthCm = Number(moduleState.depthCm) || Number(scene?.depthCm);
  const widthM = widthCm / 100;
  const spanM = heightCm / 100;
  const thicknessM = depthCm / 100;
  const opacity = Math.min(1, Math.max(0, Number(item?.defaultOpacity ?? 1)));
  const color = typeof moduleState.surface?.color === 'string' && moduleState.surface.color
    ? moduleState.surface.color
    : itemDefaultColorCss(item);

  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    moduleType: 'tulle-fabric',
    widthCm,
    depthCm,
    heightCm,
    selectionBounds: Object.freeze({
      widthM,
      heightM: thicknessM,
      depthM: spanM,
      centerY: thicknessM / 2,
    }),
  };
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, thicknessM, spanM),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.72,
      metalness: 0,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 0.999,
      side: THREE.DoubleSide,
    }),
  );
  mesh.position.set(0, thicknessM / 2, 0);
  mesh.castShadow = opacity >= 0.2;
  mesh.receiveShadow = true;
  mesh.userData = {
    kind: 'surface',
    moduleId: moduleState.id,
    moduleIndex,
    moduleType: 'tulle-fabric',
    selectionMode: 'module',
    surfaceId: `${moduleState.id}:tulle-fabric`,
    widthCm,
    depthCm,
    heightCm,
    acceptsColor: true,
    acceptsImage: false,
    acceptsGlass: false,
    acceptsLightbox: false,
    acceptsMesh: false,
    ...bindRendererSurfaceState(moduleState.surface),
  };
  group.add(mesh);
  return { group, surfaces: [mesh] };
}

function createIlluminatedFoamModule(moduleState, moduleIndex, assetUrl) {
  const widthM = Math.max(0.1, Number(moduleState.widthCm || 200) / 100);
  const heightM = Math.max(0.05, Number(moduleState.heightCm || 50) / 100);
  const depthM = Math.max(0.005, Number(moduleState.depthCm || 3.5) / 100);
  const wallGapM = Math.max(0, Number(moduleState.wallGapCm || 1.5) / 100);
  const centerYM = 1.75;
  const wallFrontM = STAND_DIMENSIONS.depth / 2 + PANEL_FACE_OFFSET_M;
  const bodyBackZM = wallFrontM + wallGapM;
  const centerZM = bodyBackZM + depthM / 2;

  const group = new THREE.Group();
  group.userData.kind = 'module';
  group.userData.moduleId = moduleState.id;
  group.userData.moduleIndex = moduleIndex;
  group.userData.moduleType = 'illuminated-foam';
  group.userData.type = 'illuminated-foam';
  group.userData.widthCm = Number(moduleState.widthCm) || 200;
  group.userData.depthCm = Number(moduleState.depthCm) || 3.5;
  group.userData.heightCm = Number(moduleState.heightCm) || 50;
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, heightM, depthM),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitbox.position.set(0, centerYM, centerZM);
  hitbox.userData.kind = 'surface';
  hitbox.userData.surfaceId = moduleState.id + ':illuminated-foam';
  hitbox.userData.moduleId = moduleState.id;
  hitbox.userData.moduleType = 'illuminated-foam';
  hitbox.userData.moduleIndex = moduleIndex;
  hitbox.userData.widthCm = Number(moduleState.widthCm) || 200;
  hitbox.userData.acceptsImage = false;
  hitbox.userData.selectionMode = 'module';
  group.add(hitbox);

  const visualRoot = new THREE.Group();
  visualRoot.position.set(0, centerYM, bodyBackZM);
  group.add(visualRoot);

  if (assetUrl) {
    const loader = new SVGLoader();
    loader.loadAsync(assetUrl).then((data) => {
      const raw = new THREE.Group();
      let meshCount = 0;
      data.paths.forEach((path) => {
        const style = path.userData?.style ?? {};
        const fill = style.fill;
        const fillOpacity = Number(style.fillOpacity ?? style.opacity ?? 1);
        if (!fill || fill === 'none' || fill === 'transparent' || fillOpacity < 0.5) return;
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach((shape) => {
          const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: 1,
            bevelEnabled: false,
            curveSegments: 10,
          });
          const material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(fill),
            roughness: 0.72,
            metalness: 0,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.scale.z = depthM;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          raw.add(mesh);
          meshCount += 1;
        });
      });

      if (!meshCount) return;
      const box = new THREE.Box3().setFromObject(raw);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      if (!(size.x > 0 && size.y > 0)) return;
      const scaleX = widthM / size.x;
      const scaleY = heightM / size.y;
      raw.scale.set(scaleX, -scaleY, 1);
      raw.position.set(-center.x * scaleX, center.y * scaleY, 0);
      visualRoot.add(raw);
      // SVG asenkron yüklenir; sahne yalnız istekle çizildiği için yeniden çizim iste.
      requestEditorRender();

      const haloCanvas = document.createElement('canvas');
      haloCanvas.width = 512; haloCanvas.height = 256;
      const haloCtx = haloCanvas.getContext('2d');
      const haloImage = new Image();
      haloImage.onload = () => {
        haloCtx.clearRect(0,0,512,256);
        haloCtx.filter = 'blur(14px)';
        haloCtx.globalAlpha = 0.9;
        haloCtx.drawImage(haloImage,24,24,464,208);
        haloCtx.filter = 'none';
        haloCtx.globalCompositeOperation = 'source-in';
        haloCtx.fillStyle = '#ffffff';
        haloCtx.fillRect(0,0,512,256);
        haloCtx.globalCompositeOperation = 'source-over';
        const texture = new THREE.CanvasTexture(haloCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.generateMipmaps = false;
        const haloMaterial = new THREE.MeshBasicMaterial({map:texture,color:new THREE.Color(moduleState.haloColor || '#ffffff'),transparent:true,opacity:0.72,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
        const halo = new THREE.Mesh(new THREE.PlaneGeometry(widthM * 1.10, heightM * 1.18), haloMaterial);
        halo.position.set(0,0,-Math.max(0.004,wallGapM*0.68));
        halo.raycast=()=>{};
        halo.userData.role='illuminated-foam-halo';
        halo.userData.moduleId=moduleState.id;
        visualRoot.add(halo);
        requestEditorRender();
      };
      haloImage.src = assetUrl;
    }).catch((error) => {
      console.warn('Işıklı strafor SVG yüklenemedi:', error);
    });
  }

  group.userData.selectionBounds = Object.freeze({
    widthM,
    heightM,
    depthM,
    centerX: hitbox.position.x,
    centerY: hitbox.position.y,
    centerZ: hitbox.position.z,
  });
  return { group, surfaces: [hitbox] };
}

function createTvModule(moduleState, moduleIndex) {
  const item = getItem(moduleState.itemKey);
  const rows = Math.max(1, Math.round(Number(item?.videoWall?.rows ?? moduleState.videoWallRows ?? 1)));
  const cols = Math.max(1, Math.round(Number(item?.videoWall?.cols ?? moduleState.videoWallCols ?? 1)));
  const widthM = Number(moduleState.widthCm) / 100;
  const heightM = Number(moduleState.heightCm) / 100;
  let panelWidthM = widthM;
  let panelHeightM = heightM;
  if (item?.videoWall?.panelItemKey) {
    const panelItem = getItem(item.videoWall.panelItemKey);
    panelWidthM = Number(panelItem?.dimensions?.widthCm) / 100;
    panelHeightM = Number(panelItem?.dimensions?.heightCm) / 100;
    if (!Number.isFinite(panelWidthM) || !Number.isFinite(panelHeightM)) {
      throw new TypeError(`Missing video_wall_panel dimensions for ${item.itemKey}.`);
    }
  }
  const depthM = Number(moduleState.depthCm || 5) / 100;
  const centerYM = 1.75;
  const wallFrontM = STAND_DIMENSIONS.depth / 2 + PANEL_FACE_OFFSET_M;
  const centerZM = wallFrontM + depthM / 2 + 0.003;
  const isVideoWall = rows > 1 || cols > 1;

  const group = new THREE.Group();
  group.userData.kind = 'module';
  group.userData.moduleId = moduleState.id;
  group.userData.moduleIndex = moduleIndex;
  group.userData.moduleType = 'tv';
  group.userData.type = 'tv';
  group.userData.widthCm = Number(moduleState.widthCm || widthM * 100);
  group.userData.depthCm = Number(moduleState.depthCm || 5);
  group.userData.heightCm = heightM * 100;
  group.userData.videoWallRows = rows;
  group.userData.videoWallCols = cols;

  const blackMaterial = () => new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.72,
    metalness: 0.05,
  });

  const screenTexture = createTvScreenTexture(item);
  const tv = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, heightM, depthM),
    [
      blackMaterial(), blackMaterial(), blackMaterial(), blackMaterial(),
      new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
      blackMaterial(),
    ],
  );
  tv.position.set(0, centerYM, centerZM);
  tv.castShadow = true;
  tv.receiveShadow = true;
  tv.userData.kind = 'surface';
  tv.userData.surfaceId = moduleState.id + ':tv';
  tv.userData.moduleId = moduleState.id;
  tv.userData.moduleType = 'tv';
  tv.userData.moduleIndex = moduleIndex;
  Object.assign(tv.userData, surfaceCapabilityUserData(moduleState.itemKey));
  tv.userData.selectionMode = 'module';
  group.add(tv);

  if (isVideoWall) {
    const seamMaterial = new THREE.MeshBasicMaterial({ color: 0x090909, toneMapped: false });
    const seamThicknessM = 0.010;
    const seamDepthM = 0.002;
    for (let col = 1; col < cols; col += 1) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(seamThicknessM, heightM, seamDepthM), seamMaterial.clone());
      seam.position.set((col - cols / 2) * panelWidthM, centerYM, centerZM + depthM / 2 + seamDepthM / 2 + 0.0002);
      group.add(seam);
    }
    for (let row = 1; row < rows; row += 1) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(widthM, seamThicknessM, seamDepthM), seamMaterial.clone());
      seam.position.set(0, centerYM + (rows / 2 - row) * panelHeightM, centerZM + depthM / 2 + seamDepthM / 2 + 0.0003);
      group.add(seam);
    }
  }

  group.userData.selectionBounds = Object.freeze({
    widthM,
    heightM,
    depthM,
    centerX: tv.position.x,
    centerY: tv.position.y,
    centerZ: tv.position.z,
  });
  return { group, surfaces: [tv] };
}

function createMiniFridgeTopLabel(heightCm) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '800 220px Arial, Helvetica, sans-serif';
  context.lineJoin = 'round';
  context.lineWidth = 32;
  context.strokeStyle = 'rgba(255,255,255,0.96)';

  const centerX = canvas.width / 2;
  context.strokeText('BUZ', centerX, 245);
  context.strokeText('DOLABI', centerX, 525);
  context.fillStyle = '#111827';
  context.fillText('BUZ', centerX, 245);
  context.fillText('DOLABI', centerX, 525);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.40, 0.30),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, Number(heightCm) / 100 + 0.004, -0.04);
  label.renderOrder = 30;
  label.userData.kind = 'decoration';
  label.userData.role = 'mini-fridge-top-label';
  return label;
}


function createPlasticTrashBinTopLabel(heightCm) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 768;
  const context = canvas.getContext('2d');
  if (!context) return null;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '800 220px Arial, Helvetica, sans-serif';
  context.lineJoin = 'round';
  context.lineWidth = 32;
  context.strokeStyle = 'rgba(255,255,255,0.96)';

  const centerX = canvas.width / 2;
  context.strokeText('ÇÖP', centerX, 245);
  context.strokeText('KOVASI', centerX, 525);
  context.fillStyle = '#111827';
  context.fillText('ÇÖP', centerX, 245);
  context.fillText('KOVASI', centerX, 525);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.40, 0.30),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.rotation.z = Math.PI / 2;
  label.position.set(0, Number(heightCm) / 100 + 0.004, -0.04);
  label.renderOrder = 30;
  label.userData.kind = 'decoration';
  label.userData.role = 'plastic-trash-bin-top-label';
  return label;
}
function createMiniFridgeModule(moduleState, moduleIndex) {
  const defaults = getItem('mini_fridge_avanti').dimensions;
  const widthCm = Number(moduleState.widthCm || defaults.widthCm);
  const depthCm = Number(moduleState.depthCm || defaults.depthCm);
  const heightCm = Number(moduleState.heightCm || defaults.heightCm);
  const group = new THREE.Group();
  const topLabel = createMiniFridgeTopLabel(heightCm);
  if (topLabel) group.add(topLabel);
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: 'mini-fridge',
    type: 'mini-fridge',
    widthCm,
    depthCm,
    heightCm,
  };

  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.y = heightCm / 200;
  proxy.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:mini-fridge`,
    moduleId: moduleState.id,
    moduleType: 'mini-fridge',
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm,
    depthCm,
    heightCm,
  };
  group.add(proxy);

  loadItemModel('mini_fridge_avanti').then((template) => {
    const model = template.clone(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const targetHeightM = heightCm / 100;
    const uniformScale = size.y > 0 ? targetHeightM / size.y : 1;
    model.scale.multiplyScalar(uniformScale);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    group.add(model);
  }).catch((error) => {
    console.warn('Mini Buzdolabı GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces: [proxy] };
}


function createIndoorPlantModule(moduleState, moduleIndex) {
  const type = moduleState.type === 'plastic-trash-bin' ? 'plastic-trash-bin' : 'indoor-plant-1';
  const item = getCommercialItemForType(type);
  const modelFile = moduleState.modelFile ?? item?.modelFile;
  const widthCm = Number(moduleState.widthCm || item?.dimensions.widthCm || 60);
  const depthCm = Number(moduleState.depthCm || item?.dimensions.depthCm || 60);
  const heightCm = Number(moduleState.heightCm || item?.dimensions.heightCm || 120);
  const widthM = widthCm / 100;
  const depthM = depthCm / 100;
  const heightM = heightCm / 100;

  const group = new THREE.Group();
  let topLabel = null;
  let trashVisualGroup = null;
  if (type === 'plastic-trash-bin') {
    trashVisualGroup = new THREE.Group();
    trashVisualGroup.userData.role = 'plastic-trash-bin-visual';
    // Instance state may override the Item-owned initial visual orientation later.
    const visualRotationYDeg = Number(moduleState.visualRotationYDeg ?? item.visualRotationYDeg) || 0;
    trashVisualGroup.rotation.y = THREE.MathUtils.degToRad(visualRotationYDeg);
    group.add(trashVisualGroup);
    topLabel = createPlasticTrashBinTopLabel(heightCm);
    if (topLabel) trashVisualGroup.add(topLabel);
  }
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: type,
    type,
    widthCm,
    depthCm,
    heightCm,
  };

  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, heightM, depthM),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.y = heightM / 2;
  proxy.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:${type}`,
    moduleId: moduleState.id,
    moduleType: type,
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm,
    depthCm,
    heightCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole: type === 'plastic-trash-bin'
      ? 'trash-bin'
      : (moduleState.surface ? 'planter-body' : 'plant'),
    surfaceId: moduleState.surface?.id ?? null,
    ...bindRendererSurfaceState(moduleState.surface),
    selectionFrame: null,
    colorTargets: [],
  };
  group.add(proxy);

  loadItemModel({ modelFile }).then((template) => {
    if (!group.parent) return;
    const model = template.clone(true);
    const removedNodes = [];
    const trashBodyMaterials = [];
    if (type === 'plastic-trash-bin') {
      const strayNodes = [];
      model.traverse((object) => {
        if (object.name === 'Sphere_1') strayNodes.push(object);
      });
      strayNodes.forEach((object) => {
        removedNodes.push(object.name);
        object.parent?.remove(object);
      });
    }
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;

      if (type === 'plastic-trash-bin' && child.name === 'Object_5') {
        const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
        const whiteMaterials = sourceMaterials.map((material) => {
          const next = material?.clone?.() ?? material;
          if (!next) return next;
          next.map = null;
          next.color?.set(0xffffff);
          if ('metalness' in next) next.metalness = 0;
          if ('roughness' in next) next.roughness = 0.58;
          next.needsUpdate = true;
          return next;
        });
        child.material = Array.isArray(child.material) ? whiteMaterials : whiteMaterials[0];
        trashBodyMaterials.push({
          name: child.name,
          materials: whiteMaterials.filter(Boolean).map((material) => ({
            color: material.color?.getHexString?.() ?? null,
            hasMap: Boolean(material.map),
          })),
        });
      }

      if (moduleState.surface) {
        const targetName = [child.name, child.geometry?.name, child.material?.name]
          .filter(Boolean)
          .join(' ');
        if (/planter|plant_pot|pot_0/i.test(targetName)) {
          child.material = Array.isArray(child.material)
            ? child.material.map((material) => material.clone())
            : child.material?.clone?.() ?? child.material;
          proxy.userData.colorTargets.push(child);
        }
      }
    });

    if (moduleState.surface?.color && proxy.userData.colorTargets.length) {
      proxy.userData.colorTargets.forEach((target) => {
        const materials = Array.isArray(target.material) ? target.material : [target.material];
        materials.forEach((material) => {
          if (!material?.color) return;
          material.color.set(moduleState.surface.color);
          material.needsUpdate = true;
        });
      });
    }

    model.rotation.y = THREE.MathUtils.degToRad(Number(moduleState.modelRotationYDeg) || 0);
    model.updateMatrixWorld(true);

    const sourceBox = new THREE.Box3().setFromObject(model);
    const sourceSize = sourceBox.getSize(new THREE.Vector3());

    if (!moduleState.preserveModelScale) {
      const fitScales = [
        sourceSize.x > 0 ? widthM / sourceSize.x : Infinity,
        sourceSize.y > 0 ? heightM / sourceSize.y : Infinity,
        sourceSize.z > 0 ? depthM / sourceSize.z : Infinity,
      ].filter((value) => Number.isFinite(value) && value > 0);
      const uniformScale = fitScales.length ? Math.min(...fitScales) : 1;
      model.scale.setScalar(uniformScale);
      model.updateMatrixWorld(true);
    }

    const fittedBox = new THREE.Box3().setFromObject(model);
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
    model.position.set(-fittedCenter.x, -fittedBox.min.y, -fittedCenter.z);
    if (trashVisualGroup) trashVisualGroup.add(model);
    else group.add(model);
    group.userData.modelLoaded = true;
    group.userData.modelFile = modelFile;
    window.dispatchEvent(new CustomEvent('fair-stand:model-rendered', {
      detail: { moduleId: moduleState.id, moduleIndex, type, modelFile, removedNodes, trashBodyMaterials, topLabelRole: topLabel?.userData.role ?? null, topLabelRotationZ: topLabel?.rotation.z ?? null, trashVisualRotationY: trashVisualGroup?.rotation.y ?? null, topLabelParentRole: topLabel?.parent?.userData?.role ?? null, modelParentRole: model.parent?.userData?.role ?? null },
    }));
  }).catch((error) => {
    console.warn('Sabit GLB modülü yüklenemedi:', type, modelFile, error);
  });

  return { group, surfaces: [proxy] };
}

function createCoatRackModule(moduleState, moduleIndex) {
  const defaults = getItem('coat_rack').dimensions;
  const widthCm = Number(moduleState.widthCm || defaults.widthCm);
  const depthCm = Number(moduleState.depthCm || defaults.depthCm);
  const heightCm = Number(moduleState.heightCm || defaults.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: 'coat-rack',
    type: 'coat-rack',
    widthCm,
    depthCm,
    heightCm,
  };

  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.y = heightCm / 200;
  proxy.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:coat-rack`,
    moduleId: moduleState.id,
    moduleType: 'coat-rack',
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm,
    depthCm,
    heightCm,
  };
  group.add(proxy);

  loadItemModel('coat_rack').then((template) => {
    if (!group.parent) return;
    const model = template.clone(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const targetHeightM = heightCm / 100;
    const uniformScale = size.y > 0 ? targetHeightM / size.y : 1;
    model.scale.multiplyScalar(uniformScale);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    group.add(model);
  }).catch((error) => {
    console.warn('Askılık GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces: [proxy] };
}

// Tekil ticari öğelerin ortak iskeleti: ölçü kutusu kadar görünmez seçim yüzeyi.
function createFreeItemShell(moduleState, moduleIndex, type) {
  const { widthCm, depthCm, heightCm } = getItem(moduleState.itemKey).dimensions;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: type,
    type,
    widthCm,
    depthCm,
    heightCm,
  };
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.y = heightCm / 200;
  proxy.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:${type}`,
    moduleId: moduleState.id,
    moduleType: type,
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm,
    depthCm,
    heightCm,
  };
  group.add(proxy);
  return { group, proxy, widthM: widthCm / 100, depthM: depthCm / 100, heightM: heightCm / 100 };
}

function addShadowedMesh(group, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

// Ayaklı vitrin: beyaz gövde + üstte cam fanus. Gövde/cam oranı ürün kararıdır
// (100 cm toplamda 70 cm gövde, 30 cm cam); BOM tek kalem, çizim görünüm içindir.
const FLOOR_SHOWCASE_GLASS_HEIGHT_RATIO = 0.3;

function createFloorShowcaseModule(moduleState, moduleIndex, onSurfaceReady = null) {
  const { group, proxy, widthM, depthM, heightM } = createFreeItemShell(moduleState, moduleIndex, 'floor-showcase');
  const glassHeightM = heightM * FLOOR_SHOWCASE_GLASS_HEIGHT_RATIO;
  const bodyHeightM = heightM - glassHeightM;
  const plinthM = 0.05;
  const plinthInsetM = 0.012;
  const deckM = 0.02;
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.62, metalness: 0.02 });
  const plinthMaterial = new THREE.MeshStandardMaterial({ color: 0x8e9398, roughness: 0.4, metalness: 0.55 });
  const deckMaterial = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.35, metalness: 0.4 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0xb9bec3, roughness: 0.3, metalness: 0.8 });

  addShadowedMesh(group, new THREE.BoxGeometry(widthM - plinthInsetM * 2, plinthM, depthM - plinthInsetM * 2),
    plinthMaterial, 0, plinthM / 2, 0);
  addShadowedMesh(group, new THREE.BoxGeometry(widthM, bodyHeightM - plinthM - deckM, depthM),
    bodyMaterial, 0, plinthM + (bodyHeightM - plinthM - deckM) / 2, 0);
  addShadowedMesh(group, new THREE.BoxGeometry(widthM, deckM, depthM), deckMaterial, 0, bodyHeightM - deckM / 2, 0);

  // Gövdenin ön/sol/sağ yüzü düzenlenebilir yüzeydir (renk, görsel, Lightbox); seçim kutusu düzenlenmez.
  Object.assign(proxy.userData, {
    acceptsColor: false, acceptsImage: false, acceptsGlass: false, acceptsLightbox: false, acceptsMesh: false,
  });
  const surfaces = [proxy];
  const faceBottomM = plinthM;
  const faceHeightM = bodyHeightM - deckM - plinthM;
  const faceY = faceBottomM + faceHeightM / 2;
  const faceOffsetM = 0.002;
  [
    ['front', widthM, new THREE.Vector3(0, faceY, depthM / 2 + faceOffsetM), 0],
    ['left', depthM, new THREE.Vector3(-widthM / 2 - faceOffsetM, faceY, 0), -Math.PI / 2],
    ['right', depthM, new THREE.Vector3(widthM / 2 + faceOffsetM, faceY, 0), Math.PI / 2],
  ].forEach(([role, faceWidthM, position, rotationY]) => {
    const surfaceState = moduleState.faces?.[role];
    if (!surfaceState) return;
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(faceWidthM, faceHeightM), panelFaceSurfaceMaterial(surfaceState));
    surface.position.copy(position);
    surface.rotation.y = rotationY;
    surface.receiveShadow = true;
    const selectionFrame = createSelectionFrame(faceWidthM, faceHeightM);
    selectionFrame.visible = false;
    surface.add(selectionFrame);
    surface.userData = {
      kind: 'surface',
      moduleType: 'floor-showcase',
      selectionMode: 'panel',
      ...surfaceCapabilityUserData(moduleState.itemKey),
      moduleIndex,
      moduleId: moduleState.id,
      widthCm: Math.round(faceWidthM * 100),
      heightCm: Math.round(faceHeightM * 100),
      stripIndex: 0,
      stripNumber: 1,
      surfaceRole: role,
      surfaceId: surfaceState.id,
      ...bindRendererSurfaceState(surfaceState),
      selectionFrame,
    };
    group.add(surface);
    surfaces.push(surface);
    onSurfaceReady?.(surface);
  });

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(widthM - 0.006, glassHeightM, depthM - 0.006),
    new THREE.MeshPhysicalMaterial({
      ...TABLE_GLASS_APPEARANCE,
      side: THREE.DoubleSide,
      depthWrite: false,
      userData: { renderTransmission: TABLE_GLASS_RENDER_TRANSMISSION },
    }),
  );
  glass.position.y = bodyHeightM + glassHeightM / 2;
  glass.renderOrder = 2;
  group.add(glass);

  // Cam kenarlarında ince alüminyum çerçeve.
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(glass.geometry),
    new THREE.LineBasicMaterial({ color: 0xa7adb3 }),
  );
  frame.position.copy(glass.position);
  frame.raycast = () => {};
  group.add(frame);

  // İç spot: iki küçük gövde (ışık kaynağı değildir, yalnız görünüm).
  [-1, 1].forEach((side) => {
    const spot = addShadowedMesh(group, new THREE.CylinderGeometry(0.008, 0.012, 0.05, 12), frameMaterial,
      side * (widthM / 2 - 0.04), bodyHeightM + glassHeightM - 0.05, -depthM / 2 + 0.04);
    spot.rotation.x = Math.PI / 5;
  });

  return { group, surfaces };
}

// Broşürlük: iki dikme arasında öne eğik, delikli beyaz metal cepler ve taban plakası.
const BROCHURE_STAND_POCKET_COUNT = 5;

function createBrochureStandModule(moduleState, moduleIndex) {
  const { group, proxy, widthM, depthM, heightM } = createFreeItemShell(moduleState, moduleIndex, 'brochure-stand');
  const metal = new THREE.MeshStandardMaterial({ color: 0xf2f3f4, roughness: 0.42, metalness: 0.35 });
  const baseM = 0.012;
  addShadowedMesh(group, new THREE.BoxGeometry(widthM, baseM, depthM), metal, 0, baseM / 2, 0);

  const pocketWidthM = widthM * 0.92;
  const topM = heightM - 0.02;
  const bottomM = 0.12;
  const pitchM = (topM - bottomM) / BROCHURE_STAND_POCKET_COUNT;
  const backZ = -depthM * 0.18;
  const pocketTexture = createPerforatedTexture();
  const pocketMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.3,
    alphaMap: pocketTexture,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  for (let index = 0; index < BROCHURE_STAND_POCKET_COUNT; index += 1) {
    const y = bottomM + pitchM * index;
    // Arka levha (broşür dayanağı) hafif arkaya yatık; ön dudak cebi tutar.
    const back = addShadowedMesh(group, new THREE.PlaneGeometry(pocketWidthM, pitchM * 1.05), pocketMaterial,
      0, y + pitchM / 2, backZ);
    back.rotation.x = -0.18;
    const lip = addShadowedMesh(group, new THREE.BoxGeometry(pocketWidthM, pitchM * 0.28, 0.004), metal,
      0, y + pitchM * 0.14, backZ + depthM * 0.32);
    lip.rotation.x = 0.35;
    addShadowedMesh(group, new THREE.BoxGeometry(pocketWidthM, 0.004, depthM * 0.34), metal,
      0, y + 0.002, backZ + depthM * 0.16);
  }
  [-1, 1].forEach((side) => {
    addShadowedMesh(group, new THREE.BoxGeometry(0.008, topM - baseM, 0.012), metal,
      side * (pocketWidthM / 2 + 0.004), baseM + (topM - baseM) / 2, backZ - 0.01);
  });

  return { group, surfaces: [proxy] };
}

let perforatedTexture = null;

function createPerforatedTexture() {
  if (perforatedTexture) return perforatedTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#000000';
  context.beginPath();
  context.arc(size / 2, size / 2, size * 0.28, 0, Math.PI * 2);
  context.fill();
  perforatedTexture = new THREE.CanvasTexture(canvas);
  perforatedTexture.wrapS = THREE.RepeatWrapping;
  perforatedTexture.wrapT = THREE.RepeatWrapping;
  perforatedTexture.repeat.set(4, 3);
  return perforatedTexture;
}

function createUprightModule(moduleState, moduleIndex) {
  const { widthCm: sectionWidthCm, depthCm, heightCm } = requireModuleSceneBoxCm(moduleState);
  const thicknessM = sectionWidthCm / 100;
  const depthM = (Number.isFinite(depthCm) && depthCm > 0 ? depthCm : sectionWidthCm) / 100;
  const heightM = heightCm / 100;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: 'upright',
    type: 'upright',
    widthCm: sectionWidthCm,
    depthCm: Number.isFinite(depthCm) ? depthCm : sectionWidthCm,
    heightCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });
  const mesh = createFrameProfileMesh(
    createSlottedProfileGeometry(thicknessM, heightM, depthM),
    frameMaterial,
    createFrameEdgeMaterial(frameMaterial),
  );
  mesh.position.y = heightM / 2;
  mesh.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:upright`,
    moduleId: moduleState.id,
    moduleType: 'upright',
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm: sectionWidthCm,
    depthCm: Number.isFinite(depthCm) ? depthCm : sectionWidthCm,
    heightCm,
  };
  group.add(mesh);
  return { group, surfaces: [mesh] };
}

function createProfileModule(moduleState, moduleIndex) {
  const {
    widthCm: spanWidthCm,
    depthCm: crossDepthCm,
    heightCm,
  } = requireModuleSceneBoxCm(moduleState);
  const widthM = spanWidthCm / 100;
  const thicknessM = crossDepthCm / 100;
  const railHeightM = heightCm / 100;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: 'profile',
    type: 'profile',
    widthCm: spanWidthCm,
    depthCm: crossDepthCm,
    heightCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });
  const mesh = createFrameProfileMesh(
    createSlottedProfileGeometry(widthM, railHeightM, thicknessM),
    frameMaterial,
    createFrameEdgeMaterial(frameMaterial),
  );
  mesh.position.y = railHeightM / 2;
  mesh.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:profile`,
    moduleId: moduleState.id,
    moduleType: 'profile',
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm: spanWidthCm,
    depthCm: crossDepthCm,
    heightCm,
  };
  group.add(mesh);
  return { group, surfaces: [mesh] };
}

function createKettleModule(moduleState, moduleIndex) {
  const defaults = getItem('kettle').dimensions;
  const widthCm = Number(moduleState.widthCm || defaults.widthCm);
  const depthCm = Number(moduleState.depthCm || defaults.depthCm);
  const heightCm = Number(moduleState.heightCm || defaults.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    moduleType: 'kettle',
    type: 'kettle',
    widthCm,
    depthCm,
    heightCm,
  };

  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.y = heightCm / 200;
  proxy.userData = {
    kind: 'surface',
    surfaceId: `${moduleState.id}:kettle`,
    moduleId: moduleState.id,
    moduleType: 'kettle',
    moduleIndex,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    widthCm,
    depthCm,
    heightCm,
  };
  group.add(proxy);

  loadItemModel('kettle').then((template) => {
    const model = template.clone(true);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    model.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const targetHeightM = heightCm / 100;
    const uniformScale = size.y > 0 ? targetHeightM / size.y : 1;
    model.scale.multiplyScalar(uniformScale);
    model.updateMatrixWorld(true);

    box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    group.add(model);
  }).catch((error) => {
    console.warn('Kettle GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces: [proxy] };
}

const floodlightRendererAssets = {
  ready: false,
};
let editorRenderRequested = true;

function requestEditorRender() {
  editorRenderRequested = true;
}

function floodlightRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function floodlightRoundedBoxGeometry(width, height, depth, radius, bevel = 0.008) {
  const geometry = new THREE.ExtrudeGeometry(
    floodlightRoundedRectShape(width, height, radius),
    {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 2,
      curveSegments: 4,
      steps: 1,
    },
  );
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function ensureFloodlightRendererAssets() {
  if (floodlightRendererAssets.ready) return floodlightRendererAssets;
  floodlightRendererAssets.bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x101216,
    roughness: 0.3,
    metalness: 0.72,
  });
  floodlightRendererAssets.edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x24282d,
    roughness: 0.34,
    metalness: 0.7,
  });
  floodlightRendererAssets.ledMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff8d8,
    emissive: 0xfff2b8,
    emissiveIntensity: 2.5,
    roughness: 0.22,
    metalness: 0,
  });
  floodlightRendererAssets.capMaterial = new THREE.MeshStandardMaterial({
    color: 0x70757b,
    roughness: 0.3,
    metalness: 0.82,
  });
  floodlightRendererAssets.mount = floodlightRoundedBoxGeometry(0.13, 0.026, 0.075, 0.012, 0.004);
  floodlightRendererAssets.bracketBase = floodlightRoundedBoxGeometry(0.235, 0.026, 0.035, 0.01, 0.003);
  floodlightRendererAssets.ear = floodlightRoundedBoxGeometry(0.026, 0.105, 0.034, 0.01, 0.003);
  floodlightRendererAssets.body = floodlightRoundedBoxGeometry(0.305, 0.178, 0.052, 0.018, 0.007);
  floodlightRendererAssets.fin = floodlightRoundedBoxGeometry(0.012, 0.128, 0.018, 0.004, 0.002);
  floodlightRendererAssets.bezel = new THREE.ShapeGeometry(floodlightRoundedRectShape(0.272, 0.145, 0.012), 4);
  floodlightRendererAssets.lens = new THREE.ShapeGeometry(floodlightRoundedRectShape(0.246, 0.119, 0.009), 4);
  floodlightRendererAssets.led = new THREE.CircleGeometry(0.0042, 8);
  floodlightRendererAssets.screw = new THREE.CylinderGeometry(0.016, 0.016, 0.014, 12);
  floodlightRendererAssets.cap = new THREE.CylinderGeometry(0.009, 0.009, 0.016, 12);
  floodlightRendererAssets.ready = true;
  return floodlightRendererAssets;
}

function addFloodlightMesh(parent, geometry, material, position, rotationZ = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (rotationZ) mesh.rotation.z = rotationZ;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.userData.retainRendererAsset = true;
  parent.add(mesh);
  return mesh;
}

function createLedFloodlightModule(moduleState, moduleIndex) {
  const item = getItem('led_floodlight');
  const widthCm = Number(moduleState.widthCm ?? item.dimensions.widthCm);
  const depthCm = Number(moduleState.depthCm ?? item.dimensions.depthCm);
  const heightCm = Number(moduleState.heightCm ?? item.dimensions.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: item.type,
    widthCm,
    depthCm,
    heightCm,
  };
  const assets = ensureFloodlightRendererAssets();
  if (!assets.glassMaterial) {
    assets.glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf8fff4,
      emissive: 0xf2ffe8,
      emissiveIntensity: 1.65,
      roughness: 0.08,
      metalness: 0,
      // transmission kullanılmaz: tek bir malzemede bile açık olması three.js'te sahneyi her
      // karede ikinci kez çizdirir ve projektör eklenince bütün malzemeleri yeniden derletir
      // (bırakınca ~1,3 sn donma, +29 program). Lens zaten kendinden parlar; fark görünmez.
      clearcoat: 0.75,
      clearcoatRoughness: 0.1,
      side: THREE.DoubleSide,
    });
  }

  function roundedRectShape(width, height, radius) {
    return floodlightRoundedRectShape(width, height, radius);
  }

  addFloodlightMesh(group, assets.mount, assets.bodyMaterial, [0, 0.014, 0.012]);

  const bracket = new THREE.Group();
  bracket.position.set(0, 0.045, 0.045);
  group.add(bracket);
  addFloodlightMesh(bracket, assets.bracketBase, assets.edgeMaterial);
  [-1, 1].forEach((side) => {
    addFloodlightMesh(bracket, assets.ear, assets.edgeMaterial, [side * 0.106, 0.057, 0.018]);
  });

  const head = new THREE.Group();
  head.position.set(0, 0.145, 0.108);
  head.rotation.x = THREE.MathUtils.degToRad(38);
  group.add(head);
  addFloodlightMesh(head, assets.body, assets.bodyMaterial);

  addFloodlightMesh(head, assets.bezel, assets.edgeMaterial, [0, 0, 0.032]);
  const lens = addFloodlightMesh(head, assets.lens, assets.glassMaterial, [0, 0, 0.0335]);

  const ledGroup = new THREE.Group();
  ledGroup.position.z = 0.0342;
  const leds = new THREE.InstancedMesh(assets.led, assets.ledMaterial, 45);
  const ledDummy = new THREE.Object3D();
  let ledIndex = 0;
  for (let row = -2; row <= 2; row += 1) {
    for (let col = -4; col <= 4; col += 1) {
      ledDummy.position.set(col * 0.023, row * 0.021, 0);
      ledDummy.updateMatrix();
      leds.setMatrixAt(ledIndex, ledDummy.matrix);
      ledIndex += 1;
    }
  }
  leds.instanceMatrix.needsUpdate = true;
  leds.castShadow = false;
  leds.receiveShadow = false;
  leds.userData.retainRendererAsset = true;
  ledGroup.add(leds);
  head.add(ledGroup);

  for (let index = -4; index <= 4; index += 1) {
    addFloodlightMesh(head, assets.fin, assets.edgeMaterial, [index * 0.027, 0, -0.039]);
  }

  [-1, 1].forEach((side) => {
    addFloodlightMesh(head, assets.screw, assets.edgeMaterial, [side * 0.157, 0.01, 0], Math.PI / 2);
    addFloodlightMesh(head, assets.cap, assets.capMaterial, [side * 0.166, 0.01, 0], Math.PI / 2);
  });

  // Panel yüzüne gerçek aydınlatma.
  const spot = new THREE.SpotLight(0xfffbed, 44, 5.6, 0.48, 0.62, 1.35);
  spot.position.set(0, 0.16, 0.13);
  spot.castShadow = false;
  spot.layers.set(RENDER_ONLY_LIGHT_LAYER);
  spot.target.position.set(0, -1.5, 1.15);
  group.add(spot, spot.target);

  const selectionFrame = createSelectionFrame(0.305, 0.178);
  selectionFrame.visible = false;
  lens.add(selectionFrame);
  lens.userData = {
    kind: 'surface',
    moduleType: 'led-floodlight',
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole: 'light',
    surfaceId: moduleState.surface?.id,
    ...bindRendererSurfaceState(moduleState.surface),
    selectionFrame,
    colorTargets: [],
  };

  return { group, surfaces: [lens] };
}

function createBarStoolModule(moduleState, moduleIndex) {
  const widthCm = Number(moduleState.widthCm || 60);
  const depthCm = Number(moduleState.depthCm || 55);
  const heightCm = Number(moduleState.heightCm || 121);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'bar-stool',
    widthCm,
    depthCm,
    heightCm,
  };

  // Selection proxy only. The GLB frame/legs stay untouched; only the seat is color-editable.
  const colorTargets = [];
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.set(0, heightCm / 200, 0);
  group.add(proxy);

  const selectionFrame = createSelectionFrame(widthCm / 100, heightCm / 100);
  selectionFrame.visible = false;
  proxy.add(selectionFrame);
  proxy.userData = {
    kind: 'surface',
    moduleType: 'bar-stool',
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole: 'chair',
    surfaceId: moduleState.surface?.id,
    ...bindRendererSurfaceState(moduleState.surface),
    selectionFrame,
    colorTargets,
  };

  loadItemModel('furniture_bar_stool_classic').then((template) => {
    if (!group.parent) return;
    const chair = template.clone(true);
    chair.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;

      const isSeat = object.name === 'Cube.001_Burlington Leather_0'
        || object.material?.name === 'Burlington_Leather';
      if (!isSeat || !object.material) return;

      // The seat starts white and follows the module surface color. Remove only the
      // base-color texture so the original frame/legs and every other GLB material stay intact.
      object.material = object.material.clone();
      object.material.map = null;
      object.material.color?.set(moduleSurfaceColor(moduleState, 'furniture_bar_stool_classic'));
      object.material.needsUpdate = true;
      colorTargets.push(object);
    });

    chair.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(chair);
    const center = box.getCenter(new THREE.Vector3());
    chair.position.x -= center.x;
    chair.position.z -= center.z;
    chair.position.y -= box.min.y;
    group.add(chair);
  }).catch((error) => {
    console.warn('Bar Taburesi GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces: [proxy] };
}


function createEamesChairModule(moduleState, moduleIndex) {
  const item = getItem('chair_eames');
  const widthCm = Number(moduleState.widthCm || item.dimensions.widthCm);
  const depthCm = Number(moduleState.depthCm || item.dimensions.depthCm);
  const heightCm = Number(moduleState.heightCm || item.dimensions.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'chair',
    widthCm,
    depthCm,
    heightCm,
  };

  const colorTargets = [];
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.set(0, heightCm / 200, 0);
  group.add(proxy);

  const selectionFrame = createSelectionFrame(widthCm / 100, heightCm / 100);
  selectionFrame.visible = false;
  proxy.add(selectionFrame);
  proxy.userData = {
    kind: 'surface',
    moduleType: 'chair',
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole: 'chair',
    surfaceId: moduleState.surface?.id,
    ...bindRendererSurfaceState(moduleState.surface),
    selectionFrame,
    colorTargets,
  };

  loadItemModel('chair_eames').then((template) => {
    if (!group.parent) return;
    const chair = template.clone(true);
    chair.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      if (object.material) object.material = object.material.clone();
      if (object.material?.name === 'plastic_wit') {
        object.material.color.set(moduleSurfaceColor(moduleState, 'chair_eames'));
        colorTargets.push(object);
      } else if (object.material?.name === 'Material1') {
        object.material.color.set(itemDefaultColorCss('furniture_coffee_table_classic'));
        object.material.metalness = 0;
        object.material.roughness = 0.58;
      }
    });

    chair.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(chair);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? (heightCm / 100) / size.y : 1;
    chair.scale.multiplyScalar(scale);
    chair.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(chair);
    const center = box.getCenter(new THREE.Vector3());
    chair.position.x -= center.x;
    chair.position.z -= center.z;
    chair.position.y -= box.min.y;
    group.add(chair);
  }).catch((error) => {
    console.warn('Eames Sandalye GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces: [proxy] };
}


function addProceduralGlassTable(group, tableItem) {
  const diameterCm = Number(tableItem.dimensions.widthCm);
  const heightCm = Number(tableItem.dimensions.heightCm);
  const radiusM = diameterCm / 200;
  const heightM = heightCm / 100;

  const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.32, metalness: 0.74 });
  const tabletopMaterial = new THREE.MeshPhysicalMaterial({
    ...TABLE_GLASS_APPEARANCE,
    clearcoatRoughness: 0.08,
    userData: { renderTransmission: TABLE_GLASS_RENDER_TRANSMISSION },
  });

  const top = new THREE.Mesh(new THREE.CylinderGeometry(radiusM, radiusM, 0.018, 64), tabletopMaterial);
  top.position.set(0, heightM, 0);
  top.receiveShadow = true;
  group.add(top);

  // Ayak tabladan tablaya uzanır: 74 cm masada 0,70 m, 108 cm bar masasında 1,04 m.
  const stemLengthM = heightM - 0.04;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, stemLengthM, 20), metalMaterial.clone());
  stem.position.set(0, 0.02 + stemLengthM / 2, 0);
  stem.castShadow = true;
  group.add(stem);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.035, 32), metalMaterial.clone());
  base.position.set(0, 0.018, 0);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);
}


function createGlassTableModule(moduleState, moduleIndex) {
  const item = getItem(moduleState.itemKey ?? 'glass_table');
  const widthCm = Number(moduleState.widthCm || item.dimensions.widthCm);
  const depthCm = Number(moduleState.depthCm || item.dimensions.depthCm);
  const heightCm = Number(moduleState.heightCm || item.dimensions.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'table-glass',
    widthCm,
    depthCm,
    heightCm,
  };

  addProceduralGlassTable(group, item);

  const proxy = new THREE.Mesh(
    new THREE.CylinderGeometry(widthCm / 200, widthCm / 200, heightCm / 100, 32),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.set(0, heightCm / 200, 0);
  group.add(proxy);

  const selectionFrame = createSelectionFrame(widthCm / 100, heightCm / 100);
  selectionFrame.visible = false;
  proxy.add(selectionFrame);
  proxy.userData = {
    kind: 'surface',
    moduleType: 'table-glass',
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole: 'table',
    surfaceId: moduleState.id,
    ...bindRendererSurfaceState(null),
    selectionFrame,
    colorTargets: [],
  };

  return { group, surfaces: [proxy] };
}


function createEamesTableChairSetModule(moduleState, moduleIndex) {
  const widthCm = Number(moduleState.widthCm || 150);
  const depthCm = Number(moduleState.depthCm || 150);
  const heightCm = Number(moduleState.heightCm || 82);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'table-chair-set-eames',
    widthCm,
    depthCm,
    heightCm,
  };

  addProceduralGlassTable(group, getItem('glass_table'));

  const colorTargets = [];
  const surfaces = [];
  const chairPlacements = [
    [-0.33, -0.33, Math.PI / 4],
    [0.33, -0.33, -Math.PI / 4],
    [-0.33, 0.33, Math.PI * 3 / 4],
    [0.33, 0.33, -Math.PI * 3 / 4],
  ];

  chairPlacements.forEach(([x, z, rotationY], index) => {
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.82, 0.56),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
    );
    proxy.position.set(x, 0.41, z);
    proxy.rotation.y = rotationY;
    group.add(proxy);

    const selectionFrame = index === 0 ? createSelectionFrame(0.50, 0.82) : null;
    if (selectionFrame) {
      selectionFrame.visible = false;
      proxy.add(selectionFrame);
    }

    proxy.userData = {
      kind: 'surface',
      moduleType: 'table-chair-set-eames',
      selectionMode: 'module',
      ...surfaceCapabilityUserData(moduleState.itemKey),
      moduleIndex,
      moduleId: moduleState.id,
      widthCm,
      stripIndex: null,
      stripNumber: null,
      surfaceRole: 'chair',
      surfaceId: index === 0 ? moduleState.surface?.id : moduleState.surface?.id + '-' + index,
      ...bindRendererSurfaceState(moduleState.surface),
      selectionFrame,
      colorTargets,
    };
    surfaces.push(proxy);
  });

  loadItemModel('chair_eames').then((template) => {
    if (!group.parent) return;

    chairPlacements.forEach(([x, z, rotationY]) => {
      const chair = template.clone(true);
      chair.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.material) object.material = object.material.clone();
        if (object.material?.name === 'plastic_wit') {
          object.material.color.set(moduleSurfaceColor(moduleState, 'chair_eames'));
          colorTargets.push(object);
        } else if (object.material?.name === 'Material1') {
          // Eames GLB: Material1 is the four wooden chair legs.
          object.material.color.set(itemDefaultColorCss('furniture_coffee_table_classic'));
          object.material.metalness = 0;
          object.material.roughness = 0.58;
        }
      });

      chair.updateMatrixWorld(true);
      let box = new THREE.Box3().setFromObject(chair);
      const size = box.getSize(new THREE.Vector3());
      const scale = size.y > 0 ? EAMES_CHAIR_TARGET_HEIGHT_M / size.y : 1;
      chair.scale.multiplyScalar(scale);
      chair.updateMatrixWorld(true);
      box = new THREE.Box3().setFromObject(chair);
      const center = box.getCenter(new THREE.Vector3());
      chair.position.x -= center.x;
      chair.position.z -= center.z;
      chair.position.y -= box.min.y;

      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      holder.rotation.y = rotationY;
      holder.add(chair);
      group.add(holder);
    });
  }).catch((error) => {
    console.warn('Eames GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces };
}



const BEIGE_SOFA_LEG_MASKS = Object.freeze({
  beigechair2seatsofa_tripo_mat_0691346e_0: Object.freeze({
    radius: 0.00175,
    maxYRatio: 0.245,
    centers: Object.freeze([
      Object.freeze([-0.00284, -0.03336]),
      Object.freeze([-0.03125, -0.00507]),
      Object.freeze([-0.01806, -0.04668]),
      Object.freeze([-0.04541, -0.01885]),
    ]),
  }),
  beigechair1_tripo_mat_0691346e_0: Object.freeze({
    radius: 0.00165,
    maxYRatio: 0.245,
    centers: Object.freeze([
      Object.freeze([-0.03313, 0.03660]),
      Object.freeze([-0.01031, 0.03512]),
      Object.freeze([-0.02506, 0.02244]),
      Object.freeze([-0.02182, 0.04626]),
    ]),
  }),
  beigechair3_tripo_mat_0691346e_0: Object.freeze({
    radius: 0.00165,
    maxYRatio: 0.245,
    centers: Object.freeze([
      Object.freeze([0.03456, -0.03568]),
      Object.freeze([0.03415, -0.01213]),
      Object.freeze([0.02072, -0.02595]),
      Object.freeze([0.04524, -0.02491]),
    ]),
  }),
});

function makeBeigeSofaBodyWhite(object, upholsteryColor) {
  if (!object?.isMesh || !object.geometry || !object.material) return;
  const mask = BEIGE_SOFA_LEG_MASKS[object.name];
  if (!mask) return;

  const sourceMaterial = Array.isArray(object.material) ? object.material[0] : object.material;
  if (!sourceMaterial) return;

  const geometry = object.geometry.clone();
  const position = geometry.getAttribute('position');
  if (!position || position.count < 3) return;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    const y = position.getY(vertexIndex);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const legMaxY = minY + Math.max(maxY - minY, 1e-9) * mask.maxYRatio;
  const radiusSquared = mask.radius * mask.radius;
  const index = geometry.index;
  const triangleCount = Math.floor((index ? index.count : position.count) / 3);

  const triangleMaterial = new Uint8Array(triangleCount);
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const offset = triangleIndex * 3;
    const a = index ? index.getX(offset) : offset;
    const b = index ? index.getX(offset + 1) : offset + 1;
    const c = index ? index.getX(offset + 2) : offset + 2;
    const centerX = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const centerY = (position.getY(a) + position.getY(b) + position.getY(c)) / 3;
    const centerZ = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;

    if (centerY > legMaxY) continue;
    const isLeg = mask.centers.some(([legX, legZ]) => {
      const dx = centerX - legX;
      const dz = centerZ - legZ;
      return dx * dx + dz * dz <= radiusSquared;
    });
    if (isLeg) triangleMaterial[triangleIndex] = 1;
  }

  const whiteMaterial = sourceMaterial.clone();
  whiteMaterial.map = null;
  whiteMaterial.color?.set(upholsteryColor);
  whiteMaterial.userData = { ...(whiteMaterial.userData || {}), sofaUpholstery: true };
  whiteMaterial.needsUpdate = true;

  // Leg material is a plain clone of the original GLB material. No property is altered.
  const originalLegMaterial = sourceMaterial.clone();
  originalLegMaterial.userData = { ...(originalLegMaterial.userData || {}), sofaFixedWood: true };

  geometry.clearGroups();
  if (triangleCount > 0) {
    let runStart = 0;
    let runMaterial = triangleMaterial[0];
    for (let triangleIndex = 1; triangleIndex <= triangleCount; triangleIndex += 1) {
      const nextMaterial = triangleIndex < triangleCount ? triangleMaterial[triangleIndex] : 255;
      if (triangleIndex < triangleCount && nextMaterial === runMaterial) continue;
      geometry.addGroup(runStart * 3, (triangleIndex - runStart) * 3, runMaterial);
      runStart = triangleIndex;
      runMaterial = nextMaterial;
    }
  }

  object.geometry = geometry;
  object.material = [whiteMaterial, originalLegMaterial];
}

function applyBeigeSofaBodyColor(target, hexColor) {
  if (!target?.material) return;
  const materials = Array.isArray(target.material) ? target.material : [target.material];
  materials.forEach((material) => {
    if (!material?.userData?.sofaUpholstery) return;
    material.map = null;
    material.color?.set(hexColor);
    material.needsUpdate = true;
  });
}

const BEIGE_SOFA_MESH = Object.freeze({
  double: 'beigechair2seatsofa_tripo_mat_0691346e_0',
  singleLeft: 'beigechair1_tripo_mat_0691346e_0',
  singleRight: 'beigechair3_tripo_mat_0691346e_0',
});

function addClassicCoffeeTable(group, item, { x = 0, z = 0 } = {}) {
  const widthM = Number(item.dimensions.widthCm) / 100;
  const depthM = Number(item.dimensions.depthCm) / 100;
  const heightM = Number(item.dimensions.heightCm) / 100;

  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, 0.018, depthM),
    new THREE.MeshPhysicalMaterial({
      ...TABLE_GLASS_APPEARANCE,
      clearcoatRoughness: 0.08,
      userData: { renderTransmission: TABLE_GLASS_RENDER_TRANSMISSION },
    }),
  );
  tableTop.position.set(x, heightM, z);
  tableTop.receiveShadow = true;
  group.add(tableTop);

  const tableStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.35, 20),
    new THREE.MeshStandardMaterial({ color: itemDefaultColorCss(item), metalness: 0.72, roughness: 0.28 }),
  );
  tableStem.position.set(x, 0.19, z);
  tableStem.castShadow = true;
  group.add(tableStem);

  const tableBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.24, 0.035, 32),
    new THREE.MeshStandardMaterial({ color: itemDefaultColorCss(item), metalness: 0.72, roughness: 0.30 }),
  );
  tableBase.position.set(x, 0.018, z);
  tableBase.castShadow = true;
  tableBase.receiveShadow = true;
  group.add(tableBase);
}

function attachBeigeSofaMesh(group, template, placement, hexColor, colorTargets) {
  const source = template.getObjectByName(placement.meshName);
  if (!source) {
    console.warn('Bej koltuk GLB mesh bulunamadı:', placement.meshName);
    return;
  }

  source.updateWorldMatrix(true, false);
  const mesh = source.clone(true);
  mesh.matrixAutoUpdate = true;
  mesh.position.set(0, 0, 0);
  mesh.rotation.set(0, 0, 0);
  mesh.quaternion.identity();
  mesh.scale.set(1, 1, 1);
  mesh.updateMatrix();
  mesh.applyMatrix4(source.matrixWorld);

  mesh.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    makeBeigeSofaBodyWhite(object, hexColor);
    colorTargets.push(object);
  });

  mesh.updateMatrixWorld(true);
  let sourceBox = new THREE.Box3().setFromObject(mesh);
  const sourceCenter = sourceBox.getCenter(new THREE.Vector3());
  mesh.position.x -= sourceCenter.x;
  mesh.position.z -= sourceCenter.z;
  mesh.position.y -= sourceBox.min.y;
  mesh.updateMatrixWorld(true);
  sourceBox = new THREE.Box3().setFromObject(mesh);

  const oriented = new THREE.Group();
  oriented.rotation.y = THREE.MathUtils.degToRad(placement.rotationYDeg);
  oriented.add(mesh);
  oriented.updateMatrixWorld(true);

  const orientedBox = new THREE.Box3().setFromObject(oriented);
  const orientedSize = orientedBox.getSize(new THREE.Vector3());
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const isLoveseat = placement.meshName === BEIGE_SOFA_MESH.double;
  const sizeCorrection = isLoveseat ? 1.40 : 1.25;
  const physicalWidthM = isLoveseat
    ? orientedSize.x
    : Math.max(sourceSize.x, sourceSize.z);
  const uniformScale = physicalWidthM > 0
    ? (placement.targetWidthM / physicalWidthM) * sizeCorrection
    : sizeCorrection;

  const fitted = new THREE.Group();
  fitted.scale.setScalar(uniformScale);
  fitted.position.set(placement.x, 0, placement.z);
  fitted.add(oriented);
  group.add(fitted);
}

function createBeigeSofaFurnitureProxy(group, moduleState, {
  type,
  widthCm,
  depthCm,
  heightCm,
  colorTargets,
  surfaceRole = 'furniture',
}) {
  const proxy = new THREE.Mesh(
    new THREE.BoxGeometry(widthCm / 100, heightCm / 100, depthCm / 100),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }),
  );
  proxy.position.set(0, heightCm / 200, 0);
  group.add(proxy);

  const selectionFrame = createSelectionFrame(widthCm / 100, heightCm / 100);
  selectionFrame.visible = false;
  proxy.add(selectionFrame);
  proxy.userData = {
    kind: 'surface',
    moduleType: type,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(moduleState.itemKey),
    moduleIndex: group.userData.moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole,
    surfaceId: moduleState.surface?.id ?? moduleState.id,
    ...bindRendererSurfaceState(moduleState.surface),
    selectionFrame,
    colorTargets,
  };
  return proxy;
}

function createBeigeSofaSetModule(moduleState, moduleIndex) {
  const setItem = getItem('furniture_sofa_set_classic');
  const doubleItem = getItem('furniture_sofa_double_classic');
  const singleItem = getItem('furniture_sofa_single_classic');
  const tableItem = getItem('furniture_coffee_table_classic');
  const widthCm = Number(moduleState.widthCm || setItem.dimensions.widthCm);
  const depthCm = Number(moduleState.depthCm || setItem.dimensions.depthCm);
  const heightCm = Number(moduleState.heightCm || setItem.dimensions.heightCm);
  const depthM = depthCm / 100;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'sofa-set-classic',
    widthCm,
    depthCm,
    heightCm,
  };

  const loveseatWidthM = Number(doubleItem.dimensions.widthCm) / 100;
  const chairWidthM = Number(singleItem.dimensions.widthCm) / 100;
  const sofaDepthM = Number(singleItem.dimensions.depthCm) / 100;
  const chairGapM = 0.20;
  const chairCenterOffsetM = (chairWidthM + chairGapM) / 2;
  const backRowZ = -depthM / 2 + sofaDepthM / 2;
  const frontRowZ = depthM / 2 - sofaDepthM / 2;

  const colorTargets = [];
  const proxy = createBeigeSofaFurnitureProxy(group, moduleState, {
    type: 'sofa-set-classic',
    widthCm,
    depthCm,
    heightCm,
    colorTargets,
  });

  const placements = Object.freeze([
    Object.freeze({
      meshName: BEIGE_SOFA_MESH.double,
      targetWidthM: loveseatWidthM,
      x: 0,
      z: backRowZ,
      rotationYDeg: -45,
    }),
    Object.freeze({
      meshName: BEIGE_SOFA_MESH.singleLeft,
      targetWidthM: chairWidthM,
      x: -chairCenterOffsetM,
      z: frontRowZ,
      rotationYDeg: 40,
    }),
    Object.freeze({
      meshName: BEIGE_SOFA_MESH.singleRight,
      targetWidthM: chairWidthM,
      x: chairCenterOffsetM,
      z: frontRowZ,
      rotationYDeg: 225,
    }),
  ]);

  loadItemModel('furniture_sofa_single_classic').then((template) => {
    if (!group.parent) return;
    placements.forEach((placement) => {
      attachBeigeSofaMesh(
        group,
        template,
        placement,
        moduleSurfaceColor(moduleState, 'furniture_sofa_set_classic'),
        colorTargets,
      );
    });
  }).catch((error) => {
    console.warn('Bej koltuk takımı GLB modeli yüklenemedi:', error);
  });

  addClassicCoffeeTable(group, tableItem, { x: 0, z: 0.10 });

  return { group, surfaces: [proxy] };
}

function createSofaPieceClassicModule(moduleState, moduleIndex, itemKey, meshName) {
  const item = getItem(itemKey);
  const widthCm = Number(moduleState.widthCm || item.dimensions.widthCm);
  const depthCm = Number(moduleState.depthCm || item.dimensions.depthCm);
  const heightCm = Number(moduleState.heightCm || item.dimensions.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: item.type,
    widthCm,
    depthCm,
    heightCm,
  };

  const colorTargets = [];
  const proxy = createBeigeSofaFurnitureProxy(group, moduleState, {
    type: item.type,
    widthCm,
    depthCm,
    heightCm,
    colorTargets,
  });

  loadItemModel('furniture_sofa_single_classic').then((template) => {
    if (!group.parent) return;
    attachBeigeSofaMesh(
      group,
      template,
      {
        meshName,
        targetWidthM: widthCm / 100,
        x: 0,
        z: 0,
        rotationYDeg: Number(moduleState.visualRotationYDeg ?? item.visualRotationYDeg) || 0,
      },
      moduleSurfaceColor(moduleState, item),
      colorTargets,
    );
  }).catch((error) => {
    console.warn('Bej koltuk GLB modeli yüklenemedi:', error);
  });

  return { group, surfaces: [proxy] };
}

function createSofaSingleClassicModule(moduleState, moduleIndex) {
  return createSofaPieceClassicModule(
    moduleState,
    moduleIndex,
    'furniture_sofa_single_classic',
    BEIGE_SOFA_MESH.singleLeft,
  );
}

function createSofaDoubleClassicModule(moduleState, moduleIndex) {
  return createSofaPieceClassicModule(
    moduleState,
    moduleIndex,
    'furniture_sofa_double_classic',
    BEIGE_SOFA_MESH.double,
  );
}

function createCoffeeTableClassicModule(moduleState, moduleIndex) {
  const item = getItem('furniture_coffee_table_classic');
  const widthCm = Number(moduleState.widthCm || item.dimensions.widthCm);
  const depthCm = Number(moduleState.depthCm || item.dimensions.depthCm);
  const heightCm = Number(moduleState.heightCm || item.dimensions.heightCm);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'coffee-table-classic',
    widthCm,
    depthCm,
    heightCm,
  };

  addClassicCoffeeTable(group, item);

  const proxy = createBeigeSofaFurnitureProxy(group, moduleState, {
    type: 'coffee-table-classic',
    widthCm,
    depthCm,
    heightCm,
    colorTargets: [],
    surfaceRole: 'table',
  });

  return { group, surfaces: [proxy] };
}

function mountRecipeTopSurface(mesh, part, moduleState, moduleType, moduleIndex, surfaces, onSurfaceReady) {
  if (!mesh || !part) return;
  // Baza/banko üst geometrisi prosedürel zarfa (module W/D + overhang) bağlı kalır.
  // BOM child ölçüleri (ör. base_top_107_50) kimlik/renk için damgalanır; mesh’i ezmez.
  if (part.color && mesh.material?.color) mesh.material.color.set(part.color);
  mesh.userData = {
    kind: 'surface',
    moduleType,
    selectionMode: 'module',
    ...surfaceCapabilityUserData(part.itemKey ?? moduleState.itemKey),
    moduleIndex,
    moduleId: moduleState.id,
    surfaceRole: 'top',
    surfaceId: part.id,
    ...bindRendererSurfaceState(part),
  };
  surfaces.push(mesh);
  onSurfaceReady?.(mesh);
}

// Baza ve banko çerçevesi: köşe dikmeleri ile alt/üst raylar aynı kare profil kesitinde
// (getProceduralFrameCrossSectionM). railYs ray eksen kotlarıdır; 0 ve tepe kotundaki raylar
// çerçeve kutusunun içinde kalacak şekilde kaydırılır.
function addBoxModuleFrame(group, frameMaterial, { posts, rails, railYs, frameHeightM, profileM }) {
  const edgeMaterial = createFrameEdgeMaterial(frameMaterial);
  const addProfile = (geometry, x, y, z) => {
    const profile = createFrameProfileMesh(geometry, frameMaterial, edgeMaterial);
    profile.position.set(x, y, z);
    group.add(profile);
  };
  const postGeometry = createSlottedProfileGeometry(profileM, frameHeightM, profileM);
  posts.forEach(([x, z]) => addProfile(postGeometry.clone(), x, frameHeightM / 2, z));
  const railCenterY = (y) => Math.min(Math.max(y, profileM / 2), frameHeightM - profileM / 2);
  rails.forEach(({ axis, length, x, z }) => {
    const geometry = axis === 'x'
      ? createSlottedProfileGeometry(length, profileM, profileM)
      : createSlottedProfileGeometry(profileM, profileM, length);
    railYs.forEach((y) => addProfile(geometry.clone(), x, railCenterY(y), z));
  });
}

// Baza/banko panel gövdesi reçetedeki panel Item kalınlığındadır; reçetede panel yoksa 12 mm.
function resolveBoxPanelBackingDepth(moduleState) {
  const thicknessCm = resolveRecipePanelThicknessCm(moduleState);
  return thicknessCm == null ? 0.012 : Math.min(thicknessCm / 100, PANEL_FACE_OFFSET_M - 0.003);
}

// Baza/banko yüz paneli profil dış yüzünün PANEL_FACE_OFFSET_M önündedir; gövde yüzün 3 mm
// arkasında durur. anchor dış çerçeve düzlemindeki yüz merkezi, outward dışa bakan birim vektördür.
function placeBoxPanelFace(backing, surface, anchor, outward, backingDepth) {
  surface.position.copy(anchor).addScaledVector(outward, PANEL_FACE_OFFSET_M);
  backing.position.copy(anchor).addScaledVector(outward, PANEL_FACE_OFFSET_M - 0.003 - backingDepth / 2);
}

function createBaseModule(moduleState, moduleIndex, onSurfaceReady) {
  const widthCm = Number(moduleState.widthCm);
  const depthCm = Number(moduleState.depthCm) || 50;
  const heightCm = Number(moduleState.heightCm) || 50;
  const widthM = widthCm / 100;
  const depthM = depthCm / 100;
  const heightM = heightCm / 100;
  const profileM = getProceduralFrameCrossSectionM(moduleState).frameWidth;
  const railHeightM = STAND_DIMENSIONS.panelRailHeight;
  const frameDepthM = getProceduralFrameCrossSectionM(moduleState).frameDepth;
  const topThicknessM = 0.035;
  const topOverhangM = 0.02;
  const frameHeightM = Math.max(heightM - topThicknessM, profileM * 3);
  const panelHeightM = Math.max(
    frameHeightM - railHeightM - PANEL_VERTICAL_CLEARANCE_M,
    0.05,
  );
  // Panel yüzü çerçevenin dış kenarından sağ/solda PANEL_FRAME_SIDE_INSET_M, alt/üstte PANEL_FRAME_INSET_M içeride biter.
  const frontPanelWidthM = Math.max(widthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const sidePanelWidthM = Math.max(depthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const railSpanXM = Math.max(widthM - profileM * 2, 0.02);
  const railSpanZM = Math.max(depthM - profileM * 2, 0.02);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    widthCm,
    depthCm,
    heightCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });
  // Baza dış ölçüsü korunur; ara yatay profil yok (her yüz tek panel).
  const railYs = [0, frameHeightM];
  addBoxModuleFrame(group, frameMaterial, {
    posts: [-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => [
      xSide * (widthM / 2 - profileM / 2),
      zSide * (depthM / 2 - profileM / 2),
    ])),
    rails: [
      { axis: 'x', length: railSpanXM, x: 0, z: depthM / 2 - frameDepthM / 2 },
      { axis: 'z', length: railSpanZM, x: -(widthM / 2 - frameDepthM / 2), z: 0 },
      { axis: 'z', length: railSpanZM, x: widthM / 2 - frameDepthM / 2, z: 0 },
    ],
    railYs,
    frameHeightM,
    profileM,
  });

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(
      widthM + topOverhangM * 2,
      topThicknessM,
      depthM + topOverhangM * 2,
    ),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.74, metalness: 0 }),
  );
  top.position.set(0, frameHeightM + topThicknessM / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const surfaces = [];
  const backingDepth = resolveBoxPanelBackingDepth(moduleState);
  const { centerY: panelCenterY, panelHeight: fittedPanelHeightM } = fitPanelToFrameOpening(
    frameHeightM / 2,
    panelHeightM,
    panelFrameOpening(0, frameHeightM),
  );
  const addPanelFace = (surfaceRole, surfaceState, faceWidthM, anchor, outward, rotationY = 0) => {
    if (!surfaceState) return;
    // Yüz mesh boyutu = prosedürel açıklık (module W/D/H). BOM panel W/H damgası
    // (panel_48_5 / panel_98 sırası) burada ezmez; aksi halde yan yüzler kayar.
    const faceWidth = faceWidthM;
    const faceHeight = fittedPanelHeightM;
    const faceDepth = backingDepth;

    const isGlass = Boolean(surfaceState.isGlass);
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(faceWidth, faceHeight, faceDepth),
      panelFaceBackingMaterial(isGlass),
    );
    backing.rotation.y = rotationY;
    backing.castShadow = !isGlass;
    backing.receiveShadow = true;
    group.add(backing);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(faceWidth, faceHeight),
      panelFaceSurfaceMaterial(surfaceState),
    );
    surface.rotation.y = rotationY;
    placeBoxPanelFace(backing, surface, anchor, outward, backingDepth);

    const selectionFrame = createSelectionFrame(faceWidth, faceHeight);
    selectionFrame.visible = false;
    surface.add(selectionFrame);
    surface.userData = {
      kind: 'surface',
      moduleType: 'base',
      selectionMode: 'module',
      ...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey),
      moduleIndex,
      moduleId: moduleState.id,
      widthCm,
      stripIndex: null,
      stripNumber: null,
      surfaceRole,
      surfaceId: surfaceState.id,
      ...bindRendererSurfaceState(surfaceState),
      selectionFrame,
      backing,
    };
    group.add(surface);
    surfaces.push(surface);
    onSurfaceReady?.(surface);
  };

  addPanelFace('front', moduleState.faces?.front, frontPanelWidthM, new THREE.Vector3(0, panelCenterY, depthM / 2), new THREE.Vector3(0, 0, 1));
  addPanelFace('left', moduleState.faces?.left, sidePanelWidthM, new THREE.Vector3(-widthM / 2, panelCenterY, 0), new THREE.Vector3(-1, 0, 0), -Math.PI / 2);
  addPanelFace('right', moduleState.faces?.right, sidePanelWidthM, new THREE.Vector3(widthM / 2, panelCenterY, 0), new THREE.Vector3(1, 0, 0), Math.PI / 2);
  mountRecipeTopSurface(top, moduleState.renderParts?.tops?.[0], moduleState, 'base', moduleIndex, surfaces, onSurfaceReady);

  return { group, surfaces };
}

function createCounterModule(moduleState, moduleIndex, onSurfaceReady) {
  if (moduleState.shape === 'L') return createLCounterModule(moduleState, moduleIndex, onSurfaceReady);
  const widthCm = Number(moduleState.widthCm);
  const depthCm = Number(moduleState.depthCm) || 50;
  const heightCm = Number(moduleState.heightCm) || 100;
  const widthM = widthCm / 100;
  const depthM = depthCm / 100;
  const heightM = heightCm / 100;
  const profileM = getProceduralFrameCrossSectionM(moduleState).frameWidth;
  const topThicknessM = 0.04;
  const topOverhangM = 0.02;
  const frameHeightM = Math.max(heightM - topThicknessM, profileM * 3);
  // Banko panel aralıkları duvar panel sistemiyle birebir aynı mantığı kullanır.
  const railHeightM = STAND_DIMENSIONS.panelRailHeight;
  const stripHeightM = frameHeightM / 2;
  const panelHeightM = Math.max(
    stripHeightM - railHeightM - PANEL_VERTICAL_CLEARANCE_M,
    0.05,
  );
  // Panel yüzü çerçevenin dış kenarından sağ/solda PANEL_FRAME_SIDE_INSET_M, alt/üstte PANEL_FRAME_INSET_M içeride biter.
  const frontPanelWidthM = Math.max(widthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const sidePanelWidthM = Math.max(depthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const railSpanXM = Math.max(widthM - profileM * 2, 0.02);
  const railSpanZM = Math.max(depthM - profileM * 2, 0.02);
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    widthCm,
    depthCm,
    heightCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });
  // 4 köşe dikmesi; ara yatay profil kaldırıldı, yalnız en alt ve en üst profil kalır.
  const railYs = [0, frameHeightM];
  const frameDepthM = getProceduralFrameCrossSectionM(moduleState).frameDepth;
  addBoxModuleFrame(group, frameMaterial, {
    posts: [-1, 1].flatMap((xSide) => [-1, 1].map((zSide) => [
      xSide * (widthM / 2 - profileM / 2),
      zSide * (depthM / 2 - profileM / 2),
    ])),
    rails: [
      { axis: 'x', length: railSpanXM, x: 0, z: depthM / 2 - frameDepthM / 2 },
      { axis: 'z', length: railSpanZM, x: -(widthM / 2 - frameDepthM / 2), z: 0 },
      { axis: 'z', length: railSpanZM, x: widthM / 2 - frameDepthM / 2, z: 0 },
    ],
    railYs,
    frameHeightM,
    profileM,
  });

  const top = new THREE.Mesh(
    new THREE.BoxGeometry(
      widthM + topOverhangM * 2,
      topThicknessM,
      depthM + topOverhangM * 2,
    ),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.58, metalness: 0 }),
  );
  top.position.set(0, frameHeightM + topThicknessM / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  const surfaces = [];
  const backingDepth = resolveBoxPanelBackingDepth(moduleState);
  const panelOpening = panelFrameOpening(0, frameHeightM);
  const lowerPanel = fitPanelToFrameOpening(stripHeightM / 2, panelHeightM, panelOpening);
  const upperPanel = fitPanelToFrameOpening(stripHeightM + stripHeightM / 2, panelHeightM, panelOpening);
  const addFace = (
    surfaceRole,
    panelLevel,
    surfaceState,
    faceWidthM,
    anchor,
    outward,
    rotationY = 0,
  ) => {
    if (!surfaceState) return;
    // Banko yüzleri de module zarfına oturur; BOM child ölçüleri mesh’i ezmez.
    const faceWidth = faceWidthM;
    const faceHeight = panelLevel === 'lower' ? lowerPanel.panelHeight : upperPanel.panelHeight;
    const faceDepth = backingDepth;

    const isGlass = Boolean(surfaceState.isGlass);
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(faceWidth, faceHeight, faceDepth),
      panelFaceBackingMaterial(isGlass),
    );
    backing.rotation.y = rotationY;
    backing.castShadow = !isGlass;
    backing.receiveShadow = true;
    group.add(backing);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(faceWidth, faceHeight),
      panelFaceSurfaceMaterial(surfaceState),
    );
    surface.rotation.y = rotationY;
    placeBoxPanelFace(backing, surface, anchor, outward, backingDepth);

    const selectionFrame = createSelectionFrame(faceWidth, faceHeight);
    selectionFrame.visible = false;
    surface.add(selectionFrame);

    surface.userData = {
      kind: 'surface',
      moduleType: 'counter',
      selectionMode: 'module',
      ...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey),
      moduleIndex,
      moduleId: moduleState.id,
      widthCm,
      stripIndex: panelLevel === 'lower' ? 0 : 1,
      stripNumber: panelLevel === 'lower' ? 1 : 2,
      surfaceRole,
      panelLevel,
      surfaceId: surfaceState.id,
      ...bindRendererSurfaceState(surfaceState),
      selectionFrame,
      backing,
    };
    group.add(surface);
    surfaces.push(surface);
    onSurfaceReady?.(surface);
  };

  const lowerY = lowerPanel.centerY;
  const upperY = upperPanel.centerY;
  const front = new THREE.Vector3(0, 0, 1);
  const left = new THREE.Vector3(-1, 0, 0);
  const right = new THREE.Vector3(1, 0, 0);

  addFace('front', 'lower', moduleState.faces?.frontLower, frontPanelWidthM, new THREE.Vector3(0, lowerY, depthM / 2), front);
  addFace('front', 'upper', moduleState.faces?.frontUpper, frontPanelWidthM, new THREE.Vector3(0, upperY, depthM / 2), front);
  addFace('left', 'lower', moduleState.faces?.leftLower, sidePanelWidthM, new THREE.Vector3(-widthM / 2, lowerY, 0), left, -Math.PI / 2);
  addFace('left', 'upper', moduleState.faces?.leftUpper, sidePanelWidthM, new THREE.Vector3(-widthM / 2, upperY, 0), left, -Math.PI / 2);
  addFace('right', 'lower', moduleState.faces?.rightLower, sidePanelWidthM, new THREE.Vector3(widthM / 2, lowerY, 0), right, Math.PI / 2);
  addFace('right', 'upper', moduleState.faces?.rightUpper, sidePanelWidthM, new THREE.Vector3(widthM / 2, upperY, 0), right, Math.PI / 2);
  mountRecipeTopSurface(top, moduleState.renderParts?.tops?.[0], moduleState, 'counter', moduleIndex, surfaces, onSurfaceReady);

  return { group, surfaces };
}

function createLCounterModule(moduleState, moduleIndex, onSurfaceReady) {
  const widthCm = Number(moduleState.widthCm) || 100;
  const depthCm = Number(moduleState.depthCm) || widthCm;
  const widthM = widthCm / 100;
  const depthM = depthCm / 100;
  const armM = 0.50;
  const heightM = Number(moduleState.heightCm || 100) / 100;
  const profileM = getProceduralFrameCrossSectionM(moduleState).frameWidth;
  const frameDepthM = getProceduralFrameCrossSectionM(moduleState).frameDepth;
  const railHeightM = STAND_DIMENSIONS.panelRailHeight;
  const topThicknessM = 0.04;
  const frameHeightM = heightM - topThicknessM;
  const stripHeightM = frameHeightM / 2;
  const panelHeightM = Math.max(stripHeightM - railHeightM - PANEL_VERTICAL_CLEARANCE_M, 0.05);
  // Panel yüzü çerçevenin dış kenarından sağ/solda PANEL_FRAME_SIDE_INSET_M, alt/üstte PANEL_FRAME_INSET_M içeride biter.
  const frontPanelM = Math.max(widthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const rightPanelM = Math.max(depthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const shortPanelM = Math.max(armM - PANEL_FRAME_SIDE_INSET_M * 2, 0.05);
  const group = new THREE.Group();
  group.userData = { kind:'module', moduleIndex, moduleId:moduleState.id, type:'counter', widthCm, depthCm, heightCm:100, counterShape:'L' };
  const frameMaterial = new THREE.MeshStandardMaterial({ color:frameColorForModule(moduleState), metalness:0.68, roughness:0.28 });
  const railYs=[0,stripHeightM,frameHeightM];
  addBoxModuleFrame(group, frameMaterial, {
    posts: [
      [-widthM / 2 + profileM / 2, -depthM / 2 + profileM / 2],
      [widthM / 2 - profileM / 2, -depthM / 2 + profileM / 2],
      [widthM / 2 - profileM / 2, depthM / 2 - profileM / 2],
      [widthM / 2 - armM + profileM / 2, depthM / 2 - profileM / 2],
      [-widthM / 2 + profileM / 2, -depthM / 2 + armM - profileM / 2],
    ],
    rails: [
      { axis: 'x', length: Math.max(widthM - profileM * 2, 0.02), x: 0, z: -depthM / 2 + frameDepthM / 2 },
      { axis: 'z', length: Math.max(depthM - profileM * 2, 0.02), x: widthM / 2 - frameDepthM / 2, z: 0 },
      { axis: 'z', length: Math.max(armM - profileM * 2, 0.02), x: -widthM / 2 + frameDepthM / 2, z: -depthM / 2 + armM / 2 },
      { axis: 'x', length: Math.max(armM - profileM * 2, 0.02), x: widthM / 2 - armM / 2, z: depthM / 2 - frameDepthM / 2 },
    ],
    railYs,
    frameHeightM,
    profileM,
  });

  const topMaterial = new THREE.MeshStandardMaterial({ color:0xf8fafc, roughness:0.58, metalness:0 });
  const recipeTops = [];
  if (widthCm === 100 && depthCm === 100) {
    const topA=new THREE.Mesh(new THREE.BoxGeometry(1.10,topThicknessM,0.60),topMaterial.clone()); topA.position.set(0,frameHeightM+topThicknessM/2,-0.25); topA.castShadow=true; topA.receiveShadow=true; group.add(topA);
    const topB=new THREE.Mesh(new THREE.BoxGeometry(0.52,topThicknessM,0.60),topMaterial.clone()); topB.rotation.y=Math.PI/2; topB.position.set(0.25,frameHeightM+topThicknessM/2,0.29); topB.castShadow=true; topB.receiveShadow=true; group.add(topB);
    recipeTops.push(topA, topB);
  } else {
    // 150/200 L bankolar normal düz banko renderer mantığını kullanır: 2 cm tabla taşması.
    const topOverhangM = 0.02;
    const topA = new THREE.Mesh(
      new THREE.BoxGeometry(widthM + topOverhangM * 2, topThicknessM, armM + topOverhangM * 2),
      topMaterial.clone(),
    );
    topA.position.set(0, frameHeightM + topThicknessM / 2, -depthM / 2 + armM / 2);
    topA.castShadow = true;
    topA.receiveShadow = true;
    group.add(topA);

    const returnExtensionM = Math.max(depthM - armM, 0.02);
    const topB = new THREE.Mesh(
      new THREE.BoxGeometry(returnExtensionM + topOverhangM * 2, topThicknessM, armM + topOverhangM * 2),
      topMaterial.clone(),
    );
    topB.rotation.y = Math.PI / 2;
    topB.position.set(widthM / 2 - armM / 2, frameHeightM + topThicknessM / 2, armM / 2);
    topB.castShadow = true;
    topB.receiveShadow = true;
    group.add(topB);
    recipeTops.push(topA, topB);
  }

  const surfaces=[];
  const backingDepth = resolveBoxPanelBackingDepth(moduleState);
  const panelOpening = panelFrameOpening(0, frameHeightM);
  const lowerPanel = fitPanelToFrameOpening(stripHeightM / 2, panelHeightM, panelOpening);
  const upperPanel = fitPanelToFrameOpening(stripHeightM + stripHeightM / 2, panelHeightM, panelOpening);
  // anchor dış çerçeve düzlemindeki yüz merkezidir; dışa bakan yön yüzün dönüşünden gelir.
  const addFace=(surfaceRole,panelLevel,surfaceState,faceWidthM,anchor,rotationY=0)=>{
    if(!surfaceState)return;
    const faceHeightM = panelLevel === 'lower' ? lowerPanel.panelHeight : upperPanel.panelHeight;
    const outward = new THREE.Vector3(Math.round(Math.sin(rotationY)), 0, Math.round(Math.cos(rotationY)));
    const isGlass=Boolean(surfaceState.isGlass);
    const backing=new THREE.Mesh(new THREE.BoxGeometry(faceWidthM,faceHeightM,backingDepth),panelFaceBackingMaterial(isGlass)); backing.rotation.y=rotationY; backing.castShadow=!isGlass; backing.receiveShadow=true; group.add(backing);
    const surface=new THREE.Mesh(new THREE.PlaneGeometry(faceWidthM,faceHeightM),panelFaceSurfaceMaterial(surfaceState)); surface.rotation.y=rotationY;
    placeBoxPanelFace(backing, surface, anchor, outward, backingDepth);
    const selectionFrame=createSelectionFrame(faceWidthM,faceHeightM); selectionFrame.visible=false; surface.add(selectionFrame);
    surface.userData={kind:'surface',moduleType:'counter',counterShape:'L',selectionMode:'module',...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey),moduleIndex,moduleId:moduleState.id,widthCm,depthCm,stripIndex:panelLevel==='lower'?0:1,stripNumber:panelLevel==='lower'?1:2,surfaceRole,panelLevel,surfaceId:surfaceState.id,...bindRendererSurfaceState(surfaceState),selectionFrame,backing}; group.add(surface); surfaces.push(surface); onSurfaceReady?.(surface);
  };
  const lowerY=lowerPanel.centerY, upperY=upperPanel.centerY;
  addFace('front','lower',moduleState.faces?.frontLower,frontPanelM,new THREE.Vector3(0,lowerY,-depthM/2),Math.PI); addFace('front','upper',moduleState.faces?.frontUpper,frontPanelM,new THREE.Vector3(0,upperY,-depthM/2),Math.PI);
  addFace('right','lower',moduleState.faces?.rightLower,rightPanelM,new THREE.Vector3(widthM/2,lowerY,0),Math.PI/2); addFace('right','upper',moduleState.faces?.rightUpper,rightPanelM,new THREE.Vector3(widthM/2,upperY,0),Math.PI/2);
  addFace('left','lower',moduleState.faces?.leftLower,shortPanelM,new THREE.Vector3(-widthM/2,lowerY,-depthM/2+armM/2),-Math.PI/2); addFace('left','upper',moduleState.faces?.leftUpper,shortPanelM,new THREE.Vector3(-widthM/2,upperY,-depthM/2+armM/2),-Math.PI/2);
  addFace('return','lower',moduleState.faces?.returnLower,shortPanelM,new THREE.Vector3(widthM/2-armM/2,lowerY,depthM/2),0); addFace('return','upper',moduleState.faces?.returnUpper,shortPanelM,new THREE.Vector3(widthM/2-armM/2,upperY,depthM/2),0);
  (moduleState.renderParts?.tops ?? []).forEach((part, index) => {
    mountRecipeTopSurface(recipeTops[index], part, moduleState, 'counter', moduleIndex, surfaces, onSurfaceReady);
  });
  return {group,surfaces};
}

export function createShelfModule(moduleState, moduleIndex) {
  const item = getItem(moduleState.itemKey);
  if (!item || item.type !== 'shelf') {
    throw new TypeError(`Missing canonical shelf Item for ${moduleState.itemKey}.`);
  }

  const widthM = Number(moduleState.widthCm) / 100;
  const { count, rowItem } = resolveShelfRows(item);
  const rowDimensions = resolveSceneDimensions(rowItem);
  const itemDimensions = resolveSceneDimensions(item);
  const depthM = Number(rowDimensions.depthCm) / 100;
  const thicknessM = Number(rowDimensions.heightCm) / 100;
  const heightM = count === 1 ? thicknessM : Number(itemDimensions.heightCm) / 100;
  // Toplam yükseklik ve tek raf kalınlığı kanonik Item ölçüleridir.
  const rowPitchM = count > 1 ? (heightM - thicknessM) / (count - 1) : 0;
  if (![widthM, depthM, thicknessM].every(Number.isFinite) || widthM <= 0 || depthM <= 0 || thicknessM <= 0) {
    throw new TypeError(`Missing canonical shelf dimensions for ${item.itemKey}.`);
  }
  if (!Number.isFinite(heightM) || heightM < thicknessM
    || (count > 1 && rowPitchM <= thicknessM)) {
    throw new TypeError(`Missing canonical shelf row spacing for ${item.itemKey}.`);
  }

  const centerYM = WALL_OVERLAY_DEFAULT_CENTER_CM / 100;
  const wallFrontM = STAND_DIMENSIONS.depth / 2 + PANEL_FACE_OFFSET_M;
  const centerZM = wallFrontM + depthM / 2;
  const shelfLightingOn = Boolean(moduleState.shelfLightingOn);

  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: 'shelf',
    moduleType: 'shelf',
    widthCm: Number(moduleState.widthCm),
    depthCm: depthM * 100,
    heightCm: heightM * 100,
    shelfLightingOn,
  };

  const surfaces = [];
  for (let rowIndex = 0; rowIndex < count; rowIndex += 1) {
    const rowCenterYM = centerYM - (heightM - thicknessM) / 2 + rowIndex * rowPitchM;
    const shelf = new THREE.Mesh(
      new THREE.BoxGeometry(widthM, thicknessM, depthM),
      new THREE.MeshStandardMaterial({
        color: item.defaultColor,
        roughness: 0.78,
        metalness: 0,
      }),
    );
    shelf.position.set(0, rowCenterYM, centerZM);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    shelf.userData = {
      kind: 'surface',
      moduleType: 'shelf',
      moduleIndex,
      moduleId: moduleState.id,
      selectionMode: 'module',
      ...surfaceCapabilityUserData(moduleState.itemKey),
    };
    group.add(shelf);
    surfaces.push(shelf);

    const shelfBottomY = rowCenterYM - thicknessM / 2;
    const ledStripWidthM = Math.max(widthM - 0.04, 0.08);
    const ledStripDepthM = 0.016;
    const ledStripThicknessM = 0.006;
    const ledCenterZM = wallFrontM + depthM * 0.78;

    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(ledStripWidthM, ledStripThicknessM, ledStripDepthM),
      new THREE.MeshStandardMaterial({
        color: 0xfff4df,
        emissive: 0xffe3bd,
        emissiveIntensity: 3.2,
        roughness: 0.28,
        metalness: 0,
      }),
    );
    ledStrip.position.set(
      0,
      shelfBottomY - ledStripThicknessM / 2 - 0.001,
      ledCenterZM,
    );
    ledStrip.visible = shelfLightingOn;
    ledStrip.userData.kind = 'decoration';
    ledStrip.userData.role = 'shelf-under-led-strip';
    group.add(ledStrip);

    const spotOffsets = [-widthM * 0.25, widthM * 0.25];
    spotOffsets.forEach((spotX) => {
      const spot = new THREE.SpotLight(
        0xfff2dc,
        14,
        1.0,
        0.68,
        0.82,
        1.6,
      );
      spot.position.set(
        spotX,
        shelfBottomY - 0.018,
        wallFrontM + depthM * 0.76,
      );
      spot.target.position.set(
        spotX,
        Math.max(0.04, shelfBottomY - 0.58),
        wallFrontM + depthM * 1.02,
      );
      spot.visible = shelfLightingOn;
      spot.castShadow = false;
      spot.layers.set(RENDER_ONLY_LIGHT_LAYER);
      spot.userData.kind = 'decoration';
      spot.userData.role = 'shelf-under-light';
      group.add(spot, spot.target);
    });
  }

  group.userData.selectionBounds = Object.freeze({
    widthM,
    heightM,
    depthM,
    centerX: 0,
    centerY: centerYM,
    centerZ: centerZM,
  });

  return { group, surfaces };
}

function createItemAssemblyModule(moduleState, moduleIndex, catalogItem) {
  // Hedef dış kutu: sceneDimensions ?? dimensions (+ moduleState override) — eksik alan uydurulmaz.
  const sceneBox = resolveModuleSceneBoxCm(moduleState);
  const targetBoxCm = {
    widthCm: sceneBox.widthCm,
    depthCm: sceneBox.depthCm,
    heightCm: sceneBox.heightCm,
  };
  const widthCm = Number(moduleState.widthCm)
    || positiveSceneCm(targetBoxCm.widthCm)
    || readItemBoxCm(catalogItem).widthCm;

  const group = new THREE.Group();
  const content = new THREE.Group();
  group.add(content);
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    widthCm,
    depthCm: positiveSceneCm(targetBoxCm.depthCm) ?? undefined,
    heightCm: positiveSceneCm(targetBoxCm.heightCm) ?? undefined,
    assembly: true,
  };

  const posed = buildLiveAssemblyParts(catalogItem, catalogItem.assembly?.parts || [], getItem);
  const surfaces = [];
  const drawnSpecs = [];

  let frameColorCss = null;
  try {
    frameColorCss = frameColorForModule(moduleState);
  } catch {
    frameColorCss = null;
  }

  const faceStates = listModuleFaceStates(moduleState);
  let faceCursor = 0;
  const topStates = Array.isArray(moduleState.renderParts?.tops)
    ? [...moduleState.renderParts.tops]
    : [];
  let topCursor = 0;

  for (const part of posed) {
    const child = getItem(part.childItemKey);
    // Savunma: kayıtlı pose / race — canlı katalogda çizilmeyen child asla mesh olmaz.
    if (!isAssemblyRenderableChild(child)) continue;

    // Ölçü / tip / yetenek her zaman canlı katalogdan (pose yalnız konum/rotasyon/kilit).
    const box = readItemBoxCm(child);
    const widthM = Math.max(box.widthCm / 100, 0.01);
    const depthM = Math.max(box.depthCm / 100, 0.01);
    const heightM = Math.max(box.heightCm / 100, 0.01);

    let panelColorCss = null;
    let boundSurface = null;
    let topColorCss = null;

    if (child && isAssemblyPanelPartType(child.type) && faceCursor < faceStates.length) {
      boundSurface = faceStates[faceCursor];
      faceCursor += 1;
      if (typeof boundSurface.color === 'string' && boundSurface.color) {
        panelColorCss = boundSurface.color;
      }
    } else if (child && isAssemblyTopPartType(child.type) && topCursor < topStates.length) {
      boundSurface = topStates[topCursor];
      topCursor += 1;
      if (typeof boundSurface.color === 'string' && boundSurface.color) {
        topColorCss = boundSurface.color;
      }
    }

    const visual = resolveAssemblyPartVisual(child, {
      frameColorCss: isAssemblyFramePartType(child?.type) ? frameColorCss : null,
      panelColorCss,
      topColorCss,
    });

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(widthM, heightM, depthM),
      new THREE.MeshStandardMaterial({
        color: visual.colorCss,
        roughness: visual.roughness,
        metalness: visual.metalness,
      }),
    );
    mesh.position.set(
      Number(part.xCm) / 100,
      Number(part.zCm) / 100 + heightM / 2,
      Number(part.yCm) / 100,
    );
    mesh.rotation.set(
      THREE.MathUtils.degToRad(Number(part.rotationXDeg) || 0),
      THREE.MathUtils.degToRad(Number(part.rotationZDeg) || 0),
      THREE.MathUtils.degToRad(Number(part.rotationYDeg) || 0),
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const capabilityKey = boundSurface?.itemKey ?? child ?? part.childItemKey;
    mesh.userData = {
      kind: 'assembly-part',
      assemblyRole: visual.role,
      moduleId: moduleState.id,
      moduleIndex,
      moduleType: moduleState.type,
      itemKey: part.childItemKey,
      instanceIndex: part.instanceIndex,
      selectionMode: boundSurface ? 'surface' : 'module',
      ...surfaceCapabilityUserData(capabilityKey),
      ...(boundSurface ? bindRendererSurfaceState(boundSurface) : {}),
    };
    if (boundSurface?.id) mesh.userData.surfaceId = boundSurface.id;

    content.add(mesh);
    surfaces.push(mesh);
    drawnSpecs.push({
      xCm: Number(part.xCm) || 0,
      yCm: Number(part.yCm) || 0,
      zCm: Number(part.zCm) || 0,
      widthCm: box.widthCm,
      depthCm: box.depthCm,
      heightCm: box.heightCm,
      rotationXDeg: Number(part.rotationXDeg) || 0,
      rotationYDeg: Number(part.rotationYDeg) || 0,
      rotationZDeg: Number(part.rotationZDeg) || 0,
    });
  }

  const fit = computeAssemblySceneFitTransform(
    computeAssemblyPartsAabbCm(drawnSpecs),
    targetBoxCm,
  );
  if (fit) {
    // Ürün: scale.x=W, .y=D, .z=H → Three: X=W, Y=H, Z=D — merkez pivot (baza ile aynı).
    content.scale.set(fit.scale.x, fit.scale.z, fit.scale.y);
    content.position.set(fit.positionM.x, fit.positionM.y, fit.positionM.z);
  }

  const frameMeshes = surfaces.filter((mesh) => mesh.userData.assemblyRole === 'frame');
  if (frameMeshes.length > 1) {
    frameMeshes.forEach((mesh) => {
      mesh.userData.colorTargets = frameMeshes;
    });
  }

  return { group, surfaces };
}

function positiveSceneCm(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

// Panel taşıyan duvar modüllerinde (düz panel, bazalı duvar, kapı, vitrin) dört çerçeve kenarı
// da aynı kare profil kesitiyle çizilir (getProceduralFrameCrossSectionM): kapalı alüminyum çerçeve.
// Yalnız 3B görünümdür; modül kutusu, panel state'i, panelRailHeight ve BOM değişmez. Paneller
// çerçevenin önünde durur; sağ/sol kenardan PANEL_FRAME_SIDE_INSET_M, alt/üst kenardan PANEL_FRAME_INSET_M içeri
// girer; çerçeve panel çevresinde görünür.
// Kenar çizgisi profil renginin koyu tonudur; profil rengi değişmez.
const PANEL_FRAME_EDGE_SHADE = 0.55;

function createFrameEdgeMaterial(frameMaterial) {
  return new THREE.LineBasicMaterial({
    color: frameMaterial.color.clone().multiplyScalar(PANEL_FRAME_EDGE_SHADE),
  });
}

// Prosedürel profil: kesit kutusu + koyu ton kenar çizgisi (çizgi seçimi yakalamaz).
function createFrameProfileMesh(geometry, frameMaterial, edgeMaterial) {
  const profile = new THREE.Mesh(geometry, frameMaterial.clone());
  profile.castShadow = true;
  profile.receiveShadow = true;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edgeMaterial);
  edges.raycast = () => {};
  profile.add(edges);
  return profile;
}

function addPanelModuleFrame(
  group,
  moduleState,
  { widthM, frameBottomY, frameTopY, uprightTopY = frameTopY, uprightGap = null, frameMaterial },
) {
  const { frameWidth, frameDepth } = getProceduralFrameCrossSectionM(moduleState);
  const frameHeight = Math.max(frameTopY - frameBottomY, 0.02);
  const uprightHeight = Math.max(uprightTopY - frameBottomY, 0.02);
  const railLength = Math.max(widthM - frameWidth * 2, 0.02);
  const railHeight = Math.min(frameWidth, frameHeight / 2);
  const edgeMaterial = createFrameEdgeMaterial(frameMaterial);

  const addProfile = (geometry, x, y) => {
    const profile = createFrameProfileMesh(geometry, frameMaterial, edgeMaterial);
    profile.position.set(x, y, 0);
    group.add(profile);
  };

  // uprightGap: dikmenin çizilmediği aralık (vitrin gövdesi orada kendi yan tahtasıyla kenar olur).
  const uprightSegments = uprightGap
    ? [[frameBottomY, uprightGap.bottomY], [uprightGap.topY, frameBottomY + uprightHeight]]
    : [[frameBottomY, frameBottomY + uprightHeight]];
  for (const [segmentBottom, segmentTop] of uprightSegments) {
    if (segmentTop - segmentBottom <= 0) continue;
    const uprightGeometry = createSlottedProfileGeometry(frameWidth, segmentTop - segmentBottom, frameDepth);
    for (const side of [-1, 1]) {
      addProfile(uprightGeometry.clone(), side * (widthM / 2 - frameWidth / 2), (segmentBottom + segmentTop) / 2);
    }
  }
  const railGeometry = createSlottedProfileGeometry(railLength, railHeight, frameDepth);
  addProfile(railGeometry.clone(), 0, frameBottomY + railHeight / 2);
  addProfile(railGeometry.clone(), 0, frameTopY - railHeight / 2);
}

// Panel yüzü çerçevenin dış kenarından alt ve üstte 4 cm, sağ ve solda 3 cm içeride biter.
const PANEL_FRAME_INSET_M = 0.04;
const PANEL_FRAME_SIDE_INSET_M = 0.03;

function panelFrameOpening(frameBottomY, frameTopY) {
  return { bottomY: frameBottomY + PANEL_FRAME_INSET_M, topY: frameTopY - PANEL_FRAME_INSET_M };
}

// Panel gövdesi reçetedeki panel Item kalınlığında, yüzün hemen arkasında durur (profil ile arasında
// PANEL_FACE_OFFSET_M boşluk görünür). Reçetede panel yoksa eski iç dolgu kutusu kalır.
function resolvePanelSlab(moduleState, depth) {
  const thicknessCm = resolveRecipePanelThicknessCm(moduleState);
  if (thicknessCm == null) {
    return { panelDepth: Math.max(depth - 0.026, 0.035), backingZ: 0 };
  }
  const panelDepth = Math.min(thicknessCm / 100, PANEL_FACE_OFFSET_M - 0.003);
  // Yüz düzlemiyle gövde ön yüzü arasında 3 mm: uzaktan derinlik titremesi (z-fighting) olmaz.
  return { panelDepth, backingZ: depth / 2 + PANEL_FACE_OFFSET_M - panelDepth / 2 - 0.003 };
}

function createFlatPanelModule(moduleState, moduleIndex, onSurfaceReady) {
  const moduleHeightCm = clampHeightToStandCeilingCm(Number(moduleState.heightCm));
  if (!Number.isFinite(moduleHeightCm) || moduleHeightCm <= 0) {
    throw new TypeError(`Item ${moduleState.itemKey ?? 'unknown'} is missing module heightCm for flat-panel.`);
  }
  const { depthCm } = requireModuleSceneBoxCm(moduleState, ['depthCm'], { clampToStandCeiling: false });
  const depth = depthCm / 100;
  const height = moduleHeightCm / 100;
  const storedCount = Array.isArray(moduleState?.strips) ? moduleState.strips.length : 0;
  const visibleStripCount = storedCount > 0 ? storedCount : 1;
  const stripHeight = resolveModuleBandPitchCm(moduleState) / 100;
  const frameBottomY = 0;
  const frameHeight = height;

  const widthCm = moduleState.widthCm;
  const widthM = widthCm / 100;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    widthCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });

  // Ara yatay profiller yok; panel grubunda yalnız en alt ve en üst profil kalır.
  addPanelModuleFrame(group, moduleState, {
    widthM,
    frameBottomY,
    frameTopY: frameBottomY + frameHeight,
    frameMaterial,
  });

  const railHeight = STAND_DIMENSIONS.panelRailHeight;
  const surfaces = [];
  const innerWidth = Math.max(widthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.02);
  const bandPanelHeight = stripHeight - railHeight - PANEL_VERTICAL_CLEARANCE_M;
  const { panelDepth, backingZ } = resolvePanelSlab(moduleState, depth);
  const panelOpening = panelFrameOpening(frameBottomY, frameBottomY + frameHeight);

  // Ön yüz `strips`, arka yüz `backStrips` (isteğe bağlı): arka paneller ön yüzün aynasıdır,
  // profilin arka yüzünün PANEL_FACE_OFFSET_M gerisinde durur ve dışa (−Z) bakar.
  const addPanel = (surfaceState, stripIndex, panelSide) => {
    const back = panelSide === 'back';
    const { centerY, panelHeight } = fitPanelToFrameOpening(
      stripIndex * stripHeight + stripHeight / 2,
      bandPanelHeight,
      panelOpening,
    );
    // Açıklık = modül sahne genişliği (wall item) − stand dikme kesiti. Yaprak panel ölçüsü mesh’i ezmez.
    const isGlass = Boolean(surfaceState.isGlass);
    const opaqueBackColor = opaquePanelBackColor(moduleState);

    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(innerWidth, panelHeight, panelDepth),
      new THREE.MeshStandardMaterial({
        color: isGlass ? PANEL_GLASS_BACKING_APPEARANCE.color : opaqueBackColor,
        roughness: isGlass ? PANEL_GLASS_BACKING_APPEARANCE.roughness : 0.74,
        transparent: isGlass,
        opacity: isGlass ? PANEL_GLASS_BACKING_APPEARANCE.opacity : 1,
        depthWrite: !isGlass,
      }),
    );
    backing.position.set(0, centerY, back ? -backingZ : backingZ);
    // Cam kaldırılınca geri dönülecek opak gövde rengi.
    backing.userData.opaqueBackColor = opaqueBackColor;
    backing.castShadow = !isGlass;
    backing.receiveShadow = true;
    group.add(backing);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(innerWidth, panelHeight),
      new THREE.MeshStandardMaterial({
        color: surfaceState.imageAssetId
          ? 0xffffff
          : (isGlass ? GLASS_APPEARANCE.color : surfaceState.color),
        roughness: isGlass ? GLASS_APPEARANCE.roughness : 0.72,
        metalness: 0,
        transparent: isGlass,
        opacity: isGlass ? GLASS_APPEARANCE.opacity : 1,
        depthWrite: !isGlass,
        side: THREE.DoubleSide,
        emissive: 0x000000,
        emissiveIntensity: 0,
      }),
    );
    if (surfaceState.isMetalSeparator && !isGlass) {
      paintMetalGrid(surface, innerWidth, panelHeight);
      backing.visible = false;
    }
    surface.position.set(0, centerY, (back ? -1 : 1) * (depth / 2 + PANEL_FACE_OFFSET_M));
    if (back) surface.rotation.y = Math.PI;

    const selectionFrame = createSelectionFrame(innerWidth, panelHeight);
    selectionFrame.visible = false;
    surface.add(selectionFrame);

    surface.userData = {
      kind: 'surface',
      moduleType: 'flat-panel',
      selectionMode: 'panel',
      ...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey),
      moduleIndex,
      moduleId: moduleState.id,
      widthCm,
      stripIndex,
      stripNumber: stripIndex + 1,
      ...(back ? { panelSide: 'back' } : {}),
      surfaceId: surfaceState.id,
      ...bindRendererSurfaceState(surfaceState),
      selectionFrame,
      backing,
    };
    group.add(surface);
    surfaces.push(surface);
    onSurfaceReady?.(surface);
  };

  for (let stripIndex = 0; stripIndex < visibleStripCount; stripIndex += 1) {
    const surfaceState = moduleState.strips?.[stripIndex];
    if (!surfaceState) {
      console.warn('Eksik panel strip state atlandı:', moduleState.type, moduleState.id, stripIndex);
      continue;
    }
    addPanel(surfaceState, stripIndex, 'front');
  }
  if (Array.isArray(moduleState.backStrips)) {
    moduleState.backStrips.forEach((surfaceState, stripIndex) => {
      if (surfaceState && stripIndex < visibleStripCount) addPanel(surfaceState, stripIndex, 'back');
    });
  }

  return { group, surfaces };
}


function createDoorModule(moduleState, moduleIndex, onSurfaceReady) {
  const { widthCm, heightCm, depthCm } = requireModuleSceneBoxCm(
    moduleState,
    ['widthCm', 'heightCm', 'depthCm'],
  );
  const height = heightCm / 100;
  const depth = depthCm / 100;
  const widthM = widthCm / 100;
  const stripHeight = WALL_PANEL_BAND_PITCH_CM / 100;
  const doorHeight = stripHeight * 4;
  // Kapı kanadı 4 bant; üstündeki her bant bir panel (350 → 3, 500 → 6).
  const upperPanelCount = Math.max(0, Math.round(heightCm / WALL_PANEL_BAND_PITCH_CM) - 4);
  const railHeight = STAND_DIMENSIONS.panelRailHeight;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    widthCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });

  // Kapılı panelde de ara yatay profiller yok; yalnız en alt ve en üst profil kalır.
  addPanelModuleFrame(group, moduleState, {
    widthM,
    frameBottomY: 0,
    frameTopY: height,
    frameMaterial,
  });

  const surfaces = [];
  const innerWidth = Math.max(widthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.02);
  const { panelDepth, backingZ } = resolvePanelSlab(moduleState, depth);

  // Alt bölüm: kapalı kapı kanadı. Sahne düzleminden dışarı açılmaz.
  const doorState = moduleState.surface;
  const doorLeafItem = getItem(doorState?.itemKey);
  if (!doorLeafItem) {
    throw new TypeError(`Missing canonical door leaf Item for module ${moduleState.id}.`);
  }
  const panelOpening = panelFrameOpening(0, height);
  const { centerY: doorCenterY, panelHeight: doorPanelHeight } = fitPanelToFrameOpening(
    doorHeight / 2,
    Math.max(doorHeight - railHeight - 0.018, 0.1),
    panelOpening,
  );
  const doorBacking = new THREE.Mesh(
    new THREE.BoxGeometry(innerWidth, doorPanelHeight, panelDepth),
    new THREE.MeshStandardMaterial({
      color: PANEL_BACK_COLOR,
      roughness: 0.74,
    }),
  );
  doorBacking.position.set(0, doorCenterY, backingZ);
  doorBacking.castShadow = true;
  doorBacking.receiveShadow = true;
  group.add(doorBacking);

  const doorSurface = new THREE.Mesh(
    new THREE.PlaneGeometry(innerWidth, doorPanelHeight),
    new THREE.MeshStandardMaterial({
      color: doorState?.imageAssetId ? 0xffffff : (doorState?.color ?? '#ffffff'),
      roughness: 0.72,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: 0x000000,
      emissiveIntensity: 0,
    }),
  );
  doorSurface.position.set(0, doorCenterY, depth / 2 + PANEL_FACE_OFFSET_M);
  const doorSelectionFrame = createSelectionFrame(innerWidth, doorPanelHeight);
  doorSelectionFrame.visible = false;
  doorSurface.add(doorSelectionFrame);
  doorSurface.userData = {
    kind: 'surface',
    itemKey: doorLeafItem.itemKey,
    moduleType: 'door',
    selectionMode: 'module',
    ...surfaceCapabilityUserData(doorLeafItem),
    moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceRole: 'door',
    surfaceId: doorState.id,
    ...bindRendererSurfaceState(doorState),
    selectionFrame: doorSelectionFrame,
    backing: doorBacking,
  };
  group.add(doorSurface);
  surfaces.push(doorSurface);
  onSurfaceReady?.(doorSurface);

  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.13, 0.032, 0.032),
    new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.55, roughness: 0.3 }),
  );
  handle.position.set(innerWidth / 2 - 0.13, doorHeight * 0.52, depth / 2 + PANEL_FACE_OFFSET_M + 0.0235);
  handle.castShadow = true;
  group.add(handle);

  // Üst bölüm: kapı kanadının üstündeki bantlar (4. strip indexinden başlar).
  for (let index = 0; index < upperPanelCount; index += 1) {
    const surfaceState = moduleState.strips[index];
    if (!surfaceState) continue;
    const { centerY, panelHeight } = fitPanelToFrameOpening(
      doorHeight + index * stripHeight + stripHeight / 2,
      stripHeight - railHeight - PANEL_VERTICAL_CLEARANCE_M,
      panelOpening,
    );

    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(innerWidth, panelHeight, panelDepth),
      new THREE.MeshStandardMaterial({
        color: surfaceState.isGlass ? PANEL_GLASS_BACKING_APPEARANCE.color : PANEL_BACK_COLOR,
        roughness: surfaceState.isGlass ? PANEL_GLASS_BACKING_APPEARANCE.roughness : 0.74,
        transparent: Boolean(surfaceState.isGlass),
        opacity: surfaceState.isGlass ? PANEL_GLASS_BACKING_APPEARANCE.opacity : 1,
        depthWrite: !surfaceState.isGlass,
      }),
    );
    backing.position.set(0, centerY, backingZ);
    backing.castShadow = !surfaceState.isGlass;
    backing.receiveShadow = true;
    group.add(backing);

    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(innerWidth, panelHeight),
      new THREE.MeshStandardMaterial({
        color: surfaceState.imageAssetId
          ? 0xffffff
          : (surfaceState.isGlass ? GLASS_APPEARANCE.color : surfaceState.color),
        roughness: surfaceState.isGlass ? GLASS_APPEARANCE.roughness : 0.72,
        metalness: 0,
        transparent: Boolean(surfaceState.isGlass),
        opacity: surfaceState.isGlass ? GLASS_APPEARANCE.opacity : 1,
        depthWrite: !surfaceState.isGlass,
        side: THREE.DoubleSide,
        emissive: 0x000000,
        emissiveIntensity: 0,
      }),
    );
    if (surfaceState.isMetalSeparator && !surfaceState.isGlass) {
      paintMetalGrid(surface, innerWidth, panelHeight);
      backing.visible = false;
    }
    surface.position.set(0, centerY, depth / 2 + PANEL_FACE_OFFSET_M);

    const selectionFrame = createSelectionFrame(innerWidth, panelHeight);
    selectionFrame.visible = false;
    surface.add(selectionFrame);

    surface.userData = {
      kind: 'surface',
      moduleType: 'door',
      selectionMode: 'panel',
      ...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey),
      moduleIndex,
      moduleId: moduleState.id,
      widthCm,
      stripIndex: surfaceState.stripIndex,
      stripNumber: index + 1,
      surfaceRole: 'upper-panel',
      surfaceId: surfaceState.id,
      ...bindRendererSurfaceState(surfaceState),
      selectionFrame,
      backing,
    };
    group.add(surface);
    surfaces.push(surface);
    onSurfaceReady?.(surface);
  }

  return { group, surfaces };
}

function createSeparatorModule(moduleState, moduleIndex) {
  const {
    widthCm,
    heightCm,
    depthCm,
  } = requireModuleSceneBoxCm(moduleState);

  const { frameWidth, frameDepth } = getProceduralFrameCrossSectionM(moduleState);

  const widthM = widthCm / 100;
  const height = heightCm / 100;
  const depth = depthCm / 100;
  const group = new THREE.Group();
  group.userData = {
    kind: 'module',
    moduleIndex,
    moduleId: moduleState.id,
    type: moduleState.type,
    widthCm,
    heightCm,
    depthCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({
    color: frameColorForModule(moduleState),
    metalness: 0.68,
    roughness: 0.28,
  });

  const profileGeometry = createSlottedProfileGeometry(frameWidth, height, frameDepth);
  for (const side of [-1, 1]) {
    const profile = new THREE.Mesh(profileGeometry.clone(), frameMaterial.clone());
    profile.position.set(side * (widthM / 2 - frameWidth / 2), height / 2, 0);
    profile.castShadow = true;
    group.add(profile);
  }

  const crossRailGeometry = createSlottedProfileGeometry(
    Math.max(widthM - frameWidth * 2, 0.02),
    frameWidth,
    frameDepth,
  );
  for (const y of [frameWidth / 2, height - frameWidth / 2]) {
    const rail = new THREE.Mesh(crossRailGeometry.clone(), frameMaterial.clone());
    rail.position.set(0, y, 0);
    rail.castShadow = true;
    group.add(rail);
  }

  const surfaceState = moduleState.surface;
  const innerWidth = Math.max(widthM - frameWidth * 2 - 0.012, 0.02);
  const innerHeight = height - frameWidth * 2;
  // 350 cm’de 36 lata; diğer yüksekliklerde iç yüksekliğe orantılı (duvar yüksekliği kuralı).
  const slatCount = Math.max(1, Math.round(36 * innerHeight / (3.5 - frameWidth * 2)));
  const slatHeight = 0.035;
  const slatGap = 0.06;
  const usedHeight = slatCount * slatHeight + (slatCount - 1) * slatGap;
  const freeHeight = Math.max(innerHeight - usedHeight, 0);
  const firstSlatY = frameWidth + freeHeight / 2 + slatHeight / 2;
  const slatGeometry = new THREE.BoxGeometry(innerWidth, slatHeight, depth);
  const slatMaterial = new THREE.MeshStandardMaterial({
    color: surfaceState.color,
    roughness: 0.62,
    metalness: 0,
  });
  const colorTargets = [];

  for (let index = 0; index < slatCount; index += 1) {
    const slat = new THREE.Mesh(slatGeometry.clone(), slatMaterial.clone());
    slat.position.set(0, firstSlatY + index * (slatHeight + slatGap), 0);
    slat.castShadow = true;
    slat.receiveShadow = true;
    group.add(slat);
    colorTargets.push(slat);
  }

  const selector = new THREE.Mesh(
    new THREE.PlaneGeometry(innerWidth, innerHeight),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  selector.position.set(0, height / 2, depth / 2 + 0.0015);

  const selectionFrame = createSelectionFrame(innerWidth, innerHeight);
  selectionFrame.visible = false;
  selector.add(selectionFrame);

  selector.userData = {
    kind: 'surface',
    moduleType: 'separator',
    selectionMode: 'module',
    ...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey),
    moduleIndex,
    moduleId: moduleState.id,
    widthCm,
    stripIndex: null,
    stripNumber: null,
    surfaceId: surfaceState.id,
    ...bindRendererSurfaceState(surfaceState),
    selectionFrame,
    colorTargets,
  };
  group.add(selector);

  if (moduleState.modelFile) {
    loadItemModel({ modelFile: moduleState.modelFile }).then((template) => {
      if (!group.parent) return;
      const model = template.clone(true);
      let visibleVineCount = 0;
      model.traverse((child) => {
        if (!child.isMesh) return;
        const targetName = [child.name, child.geometry?.name, child.material?.name].filter(Boolean).join(' ');
        const isVine = /Vines_FIXED_/i.test(targetName);
        child.visible = isVine;
        if (!isVine) return;
        visibleVineCount += 1;
        child.castShadow = true;
        child.receiveShadow = true;
        child.raycast = () => {};
      });
      if (!visibleVineCount) {
        console.warn('Sarmaşık separatör GLB içinde Vines_FIXED mesh bulunamadı:', moduleState.modelFile);
        return;
      }
      // Model 350 cm duvar için hazırlandı; başka yükseklikte dikeyde aynı oranda esner.
      model.scale.y *= heightCm / 350;
      group.add(model);
    }).catch((error) => {
      console.warn('Sarmaşık separatör GLB modeli yüklenemedi:', moduleState.modelFile, error);
    });
  }

  return { group, surfaces: [selector] };
}

function createShowcaseModule(moduleState, moduleIndex, onSurfaceReady) {
  const { widthCm, heightCm, depthCm } = requireModuleSceneBoxCm(
    moduleState,
    ['widthCm', 'heightCm', 'depthCm'],
  );
  const height = heightCm / 100;
  const depth = depthCm / 100;
  const widthM = widthCm / 100;

  const stripCount = Array.isArray(moduleState?.strips) ? moduleState.strips.length : 0;
  const stripHeight = resolveModuleBandPitchCm(moduleState) / 100;

  const bodyDefinition = getShowcaseBodyDefinition(moduleState.itemKey);
  if (!bodyDefinition || !moduleState.bodySurface) {
    throw new TypeError(`Canonical showcase body state is required for ${moduleState.itemKey ?? moduleState.type}.`);
  }

  const eyeCount = Number(bodyDefinition.item.eyeCount);
  const openingStartStrip = eyeCount === 3 ? 1 : 2;
  const openingStripCount = eyeCount;
  const sideDimensions = bodyDefinition.sideItem.dimensions;
  const horizontalDimensions = bodyDefinition.horizontalItem.dimensions;
  const showcaseDepth = Number(sideDimensions.depthCm) / 100;
  const bodyHeight = Number(sideDimensions.widthCm) / 100;
  const bodyThickness = Number(sideDimensions.heightCm) / 100;
  const bodyInnerWidth = Number(horizontalDimensions.widthCm) / 100;
  const horizontalThickness = Number(horizontalDimensions.heightCm) / 100;
  const bodyOuterWidth = bodyInnerWidth + bodyThickness * 2;
  const canonicalBodyColor = `#${bodyDefinition.defaultColor.toString(16).padStart(6, '0')}`;
  const bodyColor = moduleState.bodySurface.color || canonicalBodyColor;

  const group = new THREE.Group();
  group.userData = {
    kind: 'module', moduleIndex, moduleId: moduleState.id,
    itemKey: bodyDefinition.item.itemKey, type: moduleState.type, widthCm,
  };

  const frameMaterial = new THREE.MeshStandardMaterial({ color: frameColorForModule(moduleState), metalness: 0.68, roughness: 0.28 });
  const showcaseBodyMaterial = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0, roughness: 0.72 });
  const railHeight = STAND_DIMENSIONS.panelRailHeight;
  const innerWidth = Math.max(widthM - PANEL_FRAME_SIDE_INSET_M * 2, 0.02);

  const surfaces = [];
  const bandPanelHeight = stripHeight - railHeight - PANEL_VERTICAL_CLEARANCE_M;
  const { panelDepth, backingZ } = resolvePanelSlab(moduleState, depth);
  const panelOpening = panelFrameOpening(0, stripCount * stripHeight);
  for (let stripIndex = 0; stripIndex < stripCount; stripIndex += 1) {
    const isOpeningStrip = stripIndex >= openingStartStrip && stripIndex < openingStartStrip + openingStripCount;
    if (isOpeningStrip) continue;
    const { centerY, panelHeight } = fitPanelToFrameOpening(
      stripIndex * stripHeight + stripHeight / 2,
      bandPanelHeight,
      panelOpening,
    );
    const surfaceState = moduleState.strips[stripIndex];
    if (!surfaceState) continue;
    const isGlass = Boolean(surfaceState.isGlass);
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(innerWidth, panelHeight, panelDepth),
      new THREE.MeshStandardMaterial({
        color: isGlass ? PANEL_GLASS_BACKING_APPEARANCE.color : PANEL_BACK_COLOR,
        roughness: isGlass ? PANEL_GLASS_BACKING_APPEARANCE.roughness : 0.74,
        transparent: isGlass, opacity: isGlass ? PANEL_GLASS_BACKING_APPEARANCE.opacity : 1,
        depthWrite: !isGlass,
      }),
    );
    backing.position.set(0, centerY, backingZ);
    backing.castShadow = !isGlass;
    backing.receiveShadow = true;
    group.add(backing);
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(innerWidth, panelHeight),
      new THREE.MeshStandardMaterial({
        color: surfaceState.imageAssetId ? 0xffffff : (isGlass ? GLASS_APPEARANCE.color : surfaceState.color),
        roughness: isGlass ? GLASS_APPEARANCE.roughness : 0.72,
        metalness: 0, transparent: isGlass, opacity: isGlass ? GLASS_APPEARANCE.opacity : 1,
        depthWrite: !isGlass, side: THREE.DoubleSide, emissive: 0x000000, emissiveIntensity: 0,
      }),
    );
    if (surfaceState.isMetalSeparator && !isGlass) {
      paintMetalGrid(surface, innerWidth, panelHeight);
      backing.visible = false;
    }
    surface.position.set(0, centerY, depth / 2 + PANEL_FACE_OFFSET_M);
    const selectionFrame = createSelectionFrame(innerWidth, panelHeight);
    selectionFrame.visible = false;
    surface.add(selectionFrame);
    surface.userData = {
      kind: 'surface', moduleType: moduleState.type, shape: moduleState.shape,
      selectionMode: 'panel', ...surfaceCapabilityUserData(surfaceState?.itemKey ?? moduleState.itemKey), moduleIndex, moduleId: moduleState.id,
      widthCm, stripIndex, stripNumber: stripIndex + 1,       surfaceId: surfaceState.id,
      ...bindRendererSurfaceState(surfaceState), selectionFrame, backing,
    };
    group.add(surface);
    surfaces.push(surface);
    onSurfaceReady?.(surface);
  }

  const openingBottom = openingStartStrip * stripHeight + railHeight / 2;
  const openingTop = (openingStartStrip + openingStripCount) * stripHeight - railHeight / 2;
  const openingCenterY = (openingBottom + openingTop) / 2;
  const bodyBottom = openingCenterY - bodyHeight / 2;
  const bodyTop = openingCenterY + bodyHeight / 2;
  const caseFrontZ = depth / 2;
  const caseCenterZ = caseFrontZ - showcaseDepth / 2;
  const bodyColorTargets = [];

  // Vitrin gövdesi yüksekliğinde dikme çizilmez; profil gövdenin içinden geçiyormuş gibi görünmez.
  addPanelModuleFrame(group, moduleState, {
    widthM,
    frameBottomY: 0,
    frameTopY: stripCount * stripHeight,
    uprightTopY: height,
    uprightGap: { bottomY: bodyBottom, topY: bodyTop },
    frameMaterial,
  });

  const sidePanelGeometry = new THREE.BoxGeometry(bodyThickness, bodyHeight, showcaseDepth);
  for (const side of [-1, 1]) {
    const sidePanel = new THREE.Mesh(sidePanelGeometry.clone(), showcaseBodyMaterial.clone());
    sidePanel.userData.itemKey = bodyDefinition.sideItem.itemKey;
    sidePanel.position.set(side * (bodyInnerWidth / 2 + bodyThickness / 2), openingCenterY, caseCenterZ);
    sidePanel.castShadow = true;
    sidePanel.receiveShadow = true;
    group.add(sidePanel);
    bodyColorTargets.push(sidePanel);
  }

  const capGeometry = new THREE.BoxGeometry(bodyInnerWidth, horizontalThickness, showcaseDepth);
  for (const y of [bodyBottom + horizontalThickness / 2, bodyTop - horizontalThickness / 2]) {
    const cap = new THREE.Mesh(capGeometry.clone(), showcaseBodyMaterial.clone());
    cap.userData.itemKey = bodyDefinition.horizontalItem.itemKey;
    cap.position.set(0, y, caseCenterZ);
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
    bodyColorTargets.push(cap);
  }

  const bodySelector = new THREE.Mesh(
    new THREE.PlaneGeometry(bodyOuterWidth, bodyHeight),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide }),
  );
  bodySelector.position.set(0, openingCenterY, caseFrontZ + 0.002);
  const bodySelectionFrame = createSelectionFrame(bodyOuterWidth, bodyHeight);
  bodySelectionFrame.visible = false;
  bodySelector.add(bodySelectionFrame);
  bodySelector.userData = {
    kind: 'surface', moduleType: moduleState.type, selectionMode: 'module',
    ...surfaceCapabilityUserData(bodyDefinition.sideItem), moduleIndex, moduleId: moduleState.id, widthCm,
    stripIndex: null, stripNumber: null, surfaceRole: 'showcase-body',
    surfaceId: moduleState.bodySurface.id, ...bindRendererSurfaceState(moduleState.bodySurface),
    selectionFrame: bodySelectionFrame, colorTargets: bodyColorTargets,
  };
  group.add(bodySelector);
  surfaces.push(bodySelector);
  onSurfaceReady?.(bodySelector);

  const glassShelfItem = bodyDefinition.glassShelfItem;
  const glassAppearance = getMaterialAppearance(glassShelfItem.material);
  if (!glassShelfItem.dimensions || !glassAppearance) throw new Error('glass_shelf canonical product properties are required by showcase renderer.');
  const glassShelfLengthM = glassShelfItem.dimensions.widthCm / 100;
  const glassShelfDepthM = glassShelfItem.dimensions.depthCm / 100;
  const glassShelfThicknessM = glassShelfItem.dimensions.heightCm / 100;
  const glassMaterial = new THREE.MeshStandardMaterial({ ...glassAppearance, side: THREE.DoubleSide });
  const shelfGeometry = new THREE.BoxGeometry(glassShelfLengthM, glassShelfThicknessM, glassShelfDepthM);
  const shelfAreaBottom = bodyBottom + horizontalThickness;
  const shelfAreaHeight = Math.max(bodyHeight - horizontalThickness * 2, 0.02);
  for (let index = 1; index < eyeCount; index += 1) {
    const shelfY = shelfAreaBottom + (shelfAreaHeight * index) / eyeCount;
    const shelf = new THREE.Mesh(shelfGeometry.clone(), glassMaterial.clone());
    shelf.userData.itemKey = glassShelfItem.itemKey;
    shelf.position.set(0, shelfY, caseCenterZ);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    group.add(shelf);
  }

  return { group, surfaces };
}

function createSelectionFrame(width, height) {
  const group = new THREE.Group();
  group.position.z = 0.006;
  group.renderOrder = 100;

  const material = new THREE.MeshBasicMaterial({
    color: SELECTION_COLOR,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const thickness = 0.022;
  const extra = 0.03;

  const horizontalGeometry = new THREE.BoxGeometry(width + extra, thickness, 0.004);
  const verticalGeometry = new THREE.BoxGeometry(thickness, height + extra, 0.004);

  const top = new THREE.Mesh(horizontalGeometry.clone(), material.clone());
  top.position.y = height / 2 + thickness / 2;
  const bottom = new THREE.Mesh(horizontalGeometry.clone(), material.clone());
  bottom.position.y = -height / 2 - thickness / 2;
  const left = new THREE.Mesh(verticalGeometry.clone(), material.clone());
  left.position.x = -width / 2 - thickness / 2;
  const right = new THREE.Mesh(verticalGeometry.clone(), material.clone());
  right.position.x = width / 2 + thickness / 2;

  [top, bottom, left, right].forEach((part) => {
    part.renderOrder = 100;
    group.add(part);
  });

  return group;
}
