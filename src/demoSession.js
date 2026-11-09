// Demo süre oturumu (ADR-0012): açılış, canlılık sinyali, kalan süre göstergesi,
// süre dolunca kilit ekranı ve sahne filigranı. Süre sunucuda sayılır; bu dosya yalnız
// sunucunun cevabını gösterir. Sekme gizliyken sinyal gönderilmez, süre işlemez.

export const DEMO_API_BASE = '/api/v1/fair-stand/demo';
export const DEMO_EXPIRED_TITLE = 'Demo süreniz doldu';
export const DEMO_EXPIRED_MESSAGE = 'Bu tarayıcı ve bağlantı için günlük demo süresi bitti. Devam etmek için oturum açın.';
export const DEMO_UNVERIFIED_MESSAGE = 'Demo oturumu doğrulanamadı. Sayfayı yenileyin ya da oturum açın.';
export const DEMO_WATERMARK_TEXT = 'DEMO';
const MAX_FAILED_BEATS = 3;

export function formatDemoRemaining(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, '0');
  return `${minutes}:${rest}`;
}

function ensureElement(container, id, tagName, className) {
  const documentRef = container.ownerDocument;
  let element = documentRef.getElementById(id);
  if (!element) {
    element = documentRef.createElement(tagName);
    element.id = id;
    element.className = className;
    container.appendChild(element);
  }
  return element;
}

export function createDemoSession({ container, fetchImpl, loginPath = '/login' }) {
  const documentRef = container.ownerDocument;
  const viewWindow = documentRef.defaultView;
  let heartbeatMs = 30000;
  let remaining = 0;
  let failed = 0;
  let locked = false;
  let beatTimer = null;
  let tickTimer = null;
  let resolveReady;
  const ready = new Promise((resolve) => { resolveReady = resolve; });

  // Gösterge ve filigran sahne alanının (viewport-wrap) içinde durur; ekran görüntüsüne girer.
  const stage = container.querySelector('.viewport-wrap') || container;
  const chip = ensureElement(stage, 'fair-stand-demo-chip', 'div', 'fair-stand-demo-chip');
  chip.setAttribute('role', 'status');
  chip.setAttribute('aria-live', 'off');
  const watermark = ensureElement(stage, 'fair-stand-demo-watermark', 'div', 'fair-stand-demo-watermark');
  watermark.setAttribute('aria-hidden', 'true');
  watermark.textContent = DEMO_WATERMARK_TEXT;

  function paintChip() {
    chip.textContent = `Demo · kalan süre ${formatDemoRemaining(remaining)}`;
  }

  function lock(title, message) {
    if (locked) return;
    locked = true;
    stopTimers();
    // Gövdeye eklenir: Üretim Listesi gibi gövdedeki yüzen paneller de kilidin altında kalır.
    const overlay = ensureElement(documentRef.body || container, 'fair-stand-demo-expired', 'div', 'fair-stand-demo-expired');
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'fair-stand-demo-expired-title');
    overlay.innerHTML = '';
    const card = documentRef.createElement('div');
    card.className = 'fair-stand-demo-expired__card';
    const heading = documentRef.createElement('strong');
    heading.id = 'fair-stand-demo-expired-title';
    heading.textContent = title;
    const text = documentRef.createElement('p');
    text.textContent = message;
    const link = documentRef.createElement('a');
    link.href = loginPath;
    link.className = 'fair-stand-demo-expired__login';
    link.textContent = 'Oturum aç';
    card.append(heading, text, link);
    overlay.append(card);
    container.querySelector('#app')?.setAttribute('inert', '');
    link.focus?.();
    remaining = 0;
    paintChip();
  }

  async function post(path) {
    const response = await fetchImpl(`${DEMO_API_BASE}${path}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  }

  function apply(body) {
    remaining = Math.max(0, Number(body?.remainingSeconds) || 0);
    const seconds = Number(body?.heartbeatSeconds);
    if (Number.isFinite(seconds) && seconds >= 5) heartbeatMs = seconds * 1000;
    paintChip();
  }

  async function beat() {
    if (locked || documentRef.visibilityState === 'hidden') return;
    try {
      const { response, body } = await post('/heartbeat');
      if (response.status === 403) {
        lock(DEMO_EXPIRED_TITLE, DEMO_EXPIRED_MESSAGE);
        return;
      }
      if (!response.ok) throw new Error(`Demo heartbeat failed (${response.status}).`);
      failed = 0;
      apply(body);
    } catch {
      failed += 1;
      if (failed >= MAX_FAILED_BEATS) lock(DEMO_EXPIRED_TITLE, DEMO_UNVERIFIED_MESSAGE);
    }
  }

  function tick() {
    if (locked || documentRef.visibilityState === 'hidden') return;
    remaining = Math.max(0, remaining - 1);
    paintChip();
  }

  function stopTimers() {
    if (beatTimer) viewWindow.clearInterval(beatTimer);
    if (tickTimer) viewWindow.clearInterval(tickTimer);
    beatTimer = null;
    tickTimer = null;
  }

  function onVisibilityChange() {
    if (documentRef.visibilityState === 'visible') void beat();
  }

  async function start() {
    try {
      const { response, body } = await post('/session');
      if (!response.ok) throw new Error(`Demo session failed (${response.status}).`);
      apply(body);
    } catch {
      lock(DEMO_EXPIRED_TITLE, DEMO_UNVERIFIED_MESSAGE);
      return;
    }
    if (remaining <= 0) {
      lock(DEMO_EXPIRED_TITLE, DEMO_EXPIRED_MESSAGE);
      return;
    }
    beatTimer = viewWindow.setInterval(() => { void beat(); }, heartbeatMs);
    tickTimer = viewWindow.setInterval(tick, 1000);
    documentRef.addEventListener('visibilitychange', onVisibilityChange);
    // Süre doluysa katalog hiç istenmez; editör de başlamaz.
    resolveReady();
  }

  void start();

  return {
    ready,
    isLocked: () => locked,
    destroy() {
      stopTimers();
      documentRef.removeEventListener('visibilitychange', onVisibilityChange);
      chip.remove();
      watermark.remove();
      documentRef.getElementById('fair-stand-demo-expired')?.remove();
    },
  };
}
