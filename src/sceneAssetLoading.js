// Sahnede bekleyen görsel ve 3D model yüklemeleri. Sahne kurulduktan sonra yüzey görselleri
// ve modeller tek tek gelir; proje açılışı yükleme ekranını hepsi gelene kadar açık tutar,
// ölçüm de "sahne tamamen hazır" anını buradan alır. Yüklenemeyen parça da "geldi" sayılır
// (yerine kendi rengi çizilir), böylece bekleme hiçbir zaman takılı kalmaz.

const state = {
  pending: 0,
  listeners: new Set(),
  idleWaiters: [],
};

function nowMs() {
  return typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();
}

function emit(event) {
  for (const listener of [...state.listeners]) {
    try {
      listener(event);
    } catch {
      // Dinleyici hatası yüklemeyi etkilemez.
    }
  }
}

export function beginSceneAsset(kind) {
  state.pending += 1;
  emit({ type: 'begin', kind });
  let done = false;
  return (workMs = 0) => {
    if (done) return;
    done = true;
    state.pending = Math.max(0, state.pending - 1);
    emit({ type: 'done', kind, workMs });
    if (state.pending === 0) state.idleWaiters.splice(0).forEach((resolve) => resolve());
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
          // Geri çağrı ana iş parçacığında çalışır (tuvale sığdırma + doku); süresi bildirilir.
          const startedAt = nowMs();
          try {
            onLoad?.(texture);
          } finally {
            done(nowMs() - startedAt);
          }
        },
        onProgress,
        (error) => {
          try {
            onError?.(error);
          } finally {
            done();
          }
        },
      );
    },
  };
}

export function trackSceneModel(promise) {
  const done = beginSceneAsset('model');
  Promise.resolve(promise).then(() => done(), () => done());
  return promise;
}

// Editör karesi çizildi. Proje açılışı "sahne çizildi" anını bu sinyalle bekler.
export function noteSceneRender() {
  emit({ type: 'render' });
}

export function getPendingSceneAssetCount() {
  return state.pending;
}

export function subscribeSceneAssets(listener) {
  state.listeners.add(listener);
  return () => state.listeners.delete(listener);
}

function nextTask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Görseller ve modeller gelince sahnenin bir kez gerçekten çizilmesi beklenir: doku yükleme ve
// gölgelendirici işi ilk karede olur; beklenmezse yükleme ekranı kapandıktan sonra donar.
// timeoutMs içinde kare gelmezse (ör. sekme arka planda) beklemeden çözülür.
export function waitForNextRender({ timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (rendered) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(rendered);
    };
    const unsubscribe = subscribeSceneAssets((event) => {
      if (event.type === 'render') finish(true);
    });
    const timer = setTimeout(() => finish(false), timeoutMs);
  });
}

// Bekleyen bütün görsel ve modeller gelince çözülür. Sayaç sıfıra inince bir tur beklenir:
// gelen bir parça hemen yeni bir yükleme başlatabilir. timeoutMs dolarsa beklemeden çözülür.
export function waitForSceneAssets({ timeoutMs = 30000, onProgress } = {}) {
  let doneCount = 0;
  let total = state.pending;
  const report = () => {
    try {
      onProgress?.({ done: doneCount, total });
    } catch {
      // İlerleme yazımı beklemeyi bozmaz.
    }
  };
  const unsubscribe = subscribeSceneAssets((event) => {
    if (event.type === 'begin') total += 1;
    else if (event.type === 'done') doneCount += 1;
    else return;
    report();
  });
  report();

  return new Promise((resolve) => {
    let finished = false;
    const finish = (timedOut) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      unsubscribe();
      resolve({ timedOut, done: doneCount, total });
    };
    const timer = setTimeout(() => finish(true), timeoutMs);
    const waitIdle = async () => {
      while (!finished) {
        if (state.pending > 0) {
          await new Promise((resolveIdle) => state.idleWaiters.push(resolveIdle));
        }
        await nextTask();
        if (state.pending === 0) {
          finish(false);
          return;
        }
      }
    };
    void waitIdle();
  });
}
