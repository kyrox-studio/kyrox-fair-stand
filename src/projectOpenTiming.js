// Proje açma ölçümü (PERFORMANCE_ROADMAP P0 adım 1). Her adımın süresi performance.mark /
// measure ile kaydedilir ("fs:" önekiyle DevTools Performance panelinde de görünür) ve açılış
// bitince konsola tek satır yazılır. 3D modeller sahne kurulduktan sonra arka planda indiği
// için ikinci satır modeller sessizleşince yazılır. Davranış değişmez; ölçüm hatası açılışı
// asla bozmaz.

const MARK_PREFIX = 'fs:';
const MODEL_PATH = '/models/';
// Son model isteğinden sonra bu kadar sessizlik olunca modeller "bitti" sayılır.
const MODEL_QUIET_MS = 1500;
// Hiç bitmeyen bir indirme ölçümü sonsuza kadar açık tutmasın.
const MODEL_WATCH_LIMIT_MS = 30000;

let current = null;
let lastResult = null;

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

export function startProjectOpenTiming(projectId) {
  current = {
    projectId: projectId ?? null,
    startedAt: nowMs(),
    steps: {},
    assets: null,
    moduleCount: null,
  };
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
});

export function summarizeProjectOpen(result) {
  const parts = [`toplam ${formatMs(result.totalMs)}`];
  for (const [name, ms] of Object.entries(result.steps)) {
    parts.push(`${STEP_LABELS[name] ?? name} ${formatMs(ms)}`);
  }
  if (result.assets) {
    const missing = result.assets.missing ? `, ${result.assets.missing} eksik` : '';
    parts.push(`${result.assets.count} görsel (${formatMb(result.assets.bytes)}${missing})`);
  }
  if (result.moduleCount != null) parts.push(`${result.moduleCount} modül`);
  return `[Fair Stand ölçüm] proje açıldı: ${parts.join(' · ')}`;
}

export function summarizeModelLoads(models) {
  if (!models.count) return '[Fair Stand ölçüm] 3D model: indirme yok (önbellekte veya projede model yok)';
  const cached = models.cachedCount ? `, ${models.cachedCount} önbellekten` : '';
  return `[Fair Stand ölçüm] 3D model: ${models.count} dosya, ${formatMb(models.transferBytes)} indirildi${cached}; son model açılıştan ${formatMs(models.lastEndMs)} sonra hazır`;
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

function watchModelLoads(record, log) {
  const performanceApi = perf();
  if (!performanceApi?.getEntriesByType) return;
  let quietTimer = null;
  let observer = null;
  const finish = () => {
    clearTimeout(quietTimer);
    clearTimeout(limitTimer);
    observer?.disconnect();
    const models = collectModelLoads(performanceApi.getEntriesByType('resource'), record.startedAt);
    if (lastResult?.projectId === record.projectId) lastResult = { ...lastResult, models };
    log(summarizeModelLoads(models));
  };
  const armQuietTimer = () => {
    clearTimeout(quietTimer);
    quietTimer = setTimeout(finish, MODEL_QUIET_MS);
  };
  const limitTimer = setTimeout(finish, MODEL_WATCH_LIMIT_MS);
  if (typeof globalThis.PerformanceObserver === 'function') {
    try {
      observer = new globalThis.PerformanceObserver((list) => {
        if (list.getEntries().some((entry) => entry.name.includes(MODEL_PATH))) armQuietTimer();
      });
      observer.observe({ type: 'resource', buffered: false });
    } catch {
      observer = null;
    }
  }
  armQuietTimer();
}

export function finishProjectOpenTiming({ moduleCount = null, ok = true, log = (line) => console.info(line) } = {}) {
  const record = current;
  current = null;
  if (!record) return null;
  safeMark('project-open:end');
  safeMeasure('project-open', 'project-open:start', 'project-open:end');
  if (!ok) return null;
  const result = {
    projectId: record.projectId,
    totalMs: nowMs() - record.startedAt,
    steps: { ...record.steps },
    assets: record.assets,
    moduleCount,
    models: null,
  };
  lastResult = result;
  try {
    log(summarizeProjectOpen(result));
    watchModelLoads(record, log);
  } catch {
    // Konsol veya zamanlayıcı yoksa ölçüm sessizce atlanır.
  }
  return result;
}

export function getLastProjectOpenTiming() {
  return lastResult;
}
