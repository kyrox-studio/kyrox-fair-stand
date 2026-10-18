// Proje açma ölçümü (PERFORMANCE_ROADMAP P0 adım 1). Her adımın süresi performance.mark /
// measure ile kaydedilir ("fs:" önekiyle DevTools Performance panelinde de görünür) ve açılış
// bitince konsola tek satır yazılır. Görseller ve 3D modeller sahne kurulduktan sonra tek tek
// geldiği için son satır ("sahne tamamen hazır") hepsi bitince yazılır. Davranış değişmez; ölçüm hatası açılışı
// asla bozmaz.

const MARK_PREFIX = 'fs:';
const MODEL_PATH = '/models/';
// Hiç bitmeyen bir yükleme ölçümü sonsuza kadar açık tutmasın.
const SCENE_WATCH_LIMIT_MS = 60000;

// CRM "Düzenle" bu işareti editör kodunu yüklemeden hemen önce koyar (FairStandPage).
export const EDITOR_ROUTE_MARK = `${MARK_PREFIX}editor-route`;

let current = null;
let lastResult = null;
// Editörün açılışı (kod yükleme, katalog, başlatma). İlk proje açılışına eklenir, bir kez.
let editorBoot = null;

function perf() {
  return typeof globalThis.performance?.now === 'function' ? globalThis.performance : null;
}

function nowMs() {
  return perf()?.now() ?? Date.now();
}

function safeMark(name) {
  try {
    perf()?.mark?.(MARK_PREFIX + name);
  } catch {
    // Ölçüm desteklenmiyorsa açılış etkilenmez.
  }
}

function safeMeasure(name, start, end) {
  try {
    perf()?.measure?.(MARK_PREFIX + name, MARK_PREFIX + start, MARK_PREFIX + end);
  } catch {
    // Ölçüm desteklenmiyorsa açılış etkilenmez.
  }
}

function latestRouteMarkTime() {
  try {
    const marks = perf()?.getEntriesByName?.(EDITOR_ROUTE_MARK, 'mark') ?? [];
    return marks.length ? marks[marks.length - 1].startTime : null;
  } catch {
    return null;
  }
}

// mountFairStand başında çağrılır. CRM işareti varsa editör kodunun yükleme süresi de çıkar.
export function startEditorBootTiming() {
  const mountedAt = nowMs();
  const routeAt = latestRouteMarkTime();
  editorBoot = {
    routeAt: routeAt != null && routeAt <= mountedAt ? routeAt : null,
    mountedAt,
    steps: {},
  };
  safeMark('editor-mount');
  return editorBoot;
}

export function beginEditorBootStep(name) {
  const record = editorBoot;
  if (!record) return () => {};
  const startedAt = nowMs();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    record.steps[name] = (record.steps[name] ?? 0) + (nowMs() - startedAt);
  };
}

// Editör başladı ama ilk proje açılışı başlamadıysa (yeni proje) kayıt atılır; sonradan elle
// açılan bir projeye "Düzenle'den toplam" diye eklenmesin.
export function discardEditorBootTiming() {
  editorBoot = null;
}

export function startProjectOpenTiming(projectId) {
  const boot = editorBoot;
  editorBoot = null;
  current = {
    projectId: projectId ?? null,
    startedAt: nowMs(),
    steps: {},
    assets: null,
    moduleCount: null,
    boot,
  };
  sceneAssets.counts = { image: 0, model: 0 };
  safeMark('project-open:start');
  return current;
}

export function isProjectOpenTimingActive() {
  return current !== null;
}

// Adımı başlatır; dönen fonksiyon adımı bitirir. Aynı adım iki kez çalışırsa süreler toplanır.
export function beginProjectOpenStep(name) {
  const record = current;
  if (!record) return () => {};
  const startedAt = nowMs();
  safeMark(`${name}:start`);
  let ended = false;
  return () => {
    if (ended || current !== record) return;
    ended = true;
    record.steps[name] = (record.steps[name] ?? 0) + (nowMs() - startedAt);
    safeMark(`${name}:end`);
    safeMeasure(name, `${name}:start`, `${name}:end`);
  };
}

export async function timeProjectOpenStep(name, run) {
  const end = beginProjectOpenStep(name);
  try {
    return await run();
  } finally {
    end();
  }
}

export function noteProjectOpenAssets({ count = 0, bytes = 0, missing = 0 } = {}) {
  if (!current) return;
  current.assets = {
    count: Number(count) || 0,
    bytes: Number(bytes) || 0,
    missing: Number(missing) || 0,
  };
}

function formatMs(ms) {
  return `${Math.round(ms)} ms`;
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STEP_LABELS = Object.freeze({
  'project-fetch': 'proje verisi',
  'project-read-local': 'proje (yerel)',
  'assets-download': 'görsel indirme',
  'assets-register': 'görsel hazırlama',
  'scene-build': 'sahne kurulumu',
  catalog: 'katalog',
  'editor-start': 'editör başlatma',
});

function formatSteps(steps) {
  return Object.entries(steps).map(([name, ms]) => `${STEP_LABELS[name] ?? name} ${formatMs(ms)}`);
}

// Editör yeni açıldıysa (Düzenle) proje açılışından önceki kısım.
export function summarizeEditorBoot(boot, openFinishedAt) {
  if (!boot) return null;
  const parts = [];
  if (boot.routeAt != null) {
    parts.push(`Düzenle'den itibaren toplam ${formatMs(openFinishedAt - boot.routeAt)}`);
    parts.push(`editör kodu yükleme ${formatMs(boot.mountedAt - boot.routeAt)}`);
  } else {
    parts.push(`editör açılışından itibaren toplam ${formatMs(openFinishedAt - boot.mountedAt)}`);
  }
  parts.push(...formatSteps(boot.steps));
  return `[Fair Stand ölçüm] editör: ${parts.join(' · ')}`;
}

export function summarizeProjectOpen(result) {
  const parts = [`toplam ${formatMs(result.totalMs)}`, ...formatSteps(result.steps)];
  if (result.assets) {
    const missing = result.assets.missing ? `, ${result.assets.missing} eksik` : '';
    parts.push(`${result.assets.count} görsel (${formatMb(result.assets.bytes)}${missing})`);
  }
  if (result.moduleCount != null) parts.push(`${result.moduleCount} modül`);
  return `[Fair Stand ölçüm] proje açıldı: ${parts.join(' · ')}`;
}

export function summarizeSceneReady(scene) {
  const since = scene.sinceRouteMs != null ? ` (Düzenle'den ${formatMs(scene.sinceRouteMs)})` : '';
  const parts = [`açılıştan +${formatMs(scene.sinceOpenMs)}${since}`];
  parts.push(`${scene.imageCount} görsel yüzeyi`);
  const cached = scene.models.cachedCount ? `, ${scene.models.cachedCount} önbellekten` : '';
  parts.push(`${scene.modelCount} model (${scene.models.count} dosya ${formatMb(scene.models.transferBytes)} indirildi${cached})`);
  const label = scene.timedOut ? 'sahne hâlâ yükleniyor' : 'sahne tamamen hazır';
  return `[Fair Stand ölçüm] ${label}: ${parts.join(' · ')}`;
}

// Açılıştan sonra başlayan /models/ isteklerini toplar.
export function collectModelLoads(entries, startedAt) {
  const models = (entries ?? []).filter((entry) => (
    typeof entry?.name === 'string'
    && entry.name.includes(MODEL_PATH)
    && Number(entry.startTime) >= startedAt
  ));
  return {
    count: models.length,
    transferBytes: models.reduce((sum, entry) => sum + (Number(entry.transferSize) || 0), 0),
    // transferSize 0 + decodedBodySize > 0: tarayıcı önbelleğinden geldi.
    cachedCount: models.filter((entry) => !Number(entry.transferSize) && Number(entry.decodedBodySize) > 0).length,
    lastEndMs: models.reduce((max, entry) => Math.max(max, Number(entry.responseEnd) - startedAt), 0),
  };
}

// Sahnede bekleyen görsel ve model yüklemeleri. Sahne kurulunca görseller ve modeller tek tek
// gelir; hepsi bitince "sahne tamamen hazır" yazılır.
const sceneAssets = { pending: 0, waiters: [], counts: null };

function beginSceneAsset(kind) {
  sceneAssets.pending += 1;
  if (sceneAssets.counts) sceneAssets.counts[kind] = (sceneAssets.counts[kind] ?? 0) + 1;
  let done = false;
  return () => {
    if (done) return;
    done = true;
    sceneAssets.pending = Math.max(0, sceneAssets.pending - 1);
    if (sceneAssets.pending === 0) sceneAssets.waiters.splice(0).forEach((resolve) => resolve());
  };
}

// scene3d yüzey görselleri için: TextureLoader.load geri çağrısı (tuvale çizim dahil) bitince sayılır.
export function trackSceneTextureLoader(loader) {
  return {
    load(url, onLoad, onProgress, onError) {
      const done = beginSceneAsset('image');
      return loader.load(
        url,
        (texture) => {
          try { onLoad?.(texture); } finally { done(); }
        },
        onProgress,
        (error) => {
          try { onError?.(error); } finally { done(); }
        },
      );
    },
  };
}

export function trackSceneModel(promise) {
  const done = beginSceneAsset('model');
  Promise.resolve(promise).then(done, done);
  return promise;
}

export function getPendingSceneAssetCount() {
  return sceneAssets.pending;
}

function watchSceneReady(record, log) {
  const counts = sceneAssets.counts ?? {};
  let reported = false;
  const report = (timedOut) => {
    if (reported) return;
    reported = true;
    clearTimeout(limitTimer);
    if (sceneAssets.counts === counts) sceneAssets.counts = null;
    const readyAt = nowMs();
    const scene = {
      sinceOpenMs: readyAt - record.startedAt,
      sinceRouteMs: record.boot?.routeAt != null ? readyAt - record.boot.routeAt : null,
      imageCount: counts.image ?? 0,
      modelCount: counts.model ?? 0,
      models: collectModelLoads(perf()?.getEntriesByType?.('resource'), record.startedAt),
      timedOut,
    };
    safeMark('scene-ready');
    if (lastResult?.projectId === record.projectId) lastResult = { ...lastResult, scene };
    log(summarizeSceneReady(scene));
  };
  const limitTimer = setTimeout(() => report(true), SCENE_WATCH_LIMIT_MS);
  if (sceneAssets.pending === 0) {
    // Geri çağrılar aynı karede bitmiş olabilir; bir tur bekleyip raporla.
    setTimeout(() => (sceneAssets.pending === 0 ? report(false) : sceneAssets.waiters.push(() => report(false))), 0);
  } else {
    sceneAssets.waiters.push(() => report(false));
  }
}

export function finishProjectOpenTiming({ moduleCount = null, ok = true, log = (line) => console.info(line) } = {}) {
  const record = current;
  current = null;
  if (!record) return null;
  safeMark('project-open:end');
  safeMeasure('project-open', 'project-open:start', 'project-open:end');
  if (!ok) {
    sceneAssets.counts = null;
    return null;
  }
  const finishedAt = nowMs();
  const result = {
    projectId: record.projectId,
    totalMs: finishedAt - record.startedAt,
    steps: { ...record.steps },
    assets: record.assets,
    moduleCount,
    models: null,
    boot: record.boot ? { ...record.boot, steps: { ...record.boot.steps } } : null,
  };
  lastResult = result;
  try {
    const bootLine = summarizeEditorBoot(record.boot, finishedAt);
    if (bootLine) log(bootLine);
    log(summarizeProjectOpen(result));
    watchSceneReady(record, log);
  } catch {
    // Konsol veya zamanlayıcı yoksa ölçüm sessizce atlanır.
  }
  return result;
}

export function getLastProjectOpenTiming() {
  return lastResult;
}
