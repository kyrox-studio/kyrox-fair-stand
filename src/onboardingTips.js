import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';

// İlk kullanım ipuçları: sahne ilk kez kurulduğunda 3 kısa ipucu sırayla gösterilir; "Tamam"
// ile ilerler, "Atla" ile kapanır. Bir kez görüldüğü bu tarayıcıda hatırlanır ve bir daha çıkmaz.

export const ONBOARDING_TIPS_STORAGE_KEY = 'fairStandTipsSeen';
export const ONBOARDING_TIPS = Object.freeze([
  'Katalogdan modülü sahneye sürükle ya da karta dokunup sahnede yere dokun.',
  'Çift tık modülün tamamını seçer; üstteki çubuktan döndür, kopyala, sil.',
  'İşin bitince Kaydet’e bas.',
]);

const STYLE_ID = 'onboarding-tips-styles';

function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .onboarding-tip { position: absolute; z-index: 6; left: 50%; bottom: 16px; display: flex; width: min(380px, calc(100% - 32px));
      flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 14px; background: rgba(17, 24, 39, 0.92);
      color: #fff; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28); transform: translateX(-50%); font: 14px/1.45 system-ui, sans-serif; }
    .onboarding-tip[hidden] { display: none; }
    .onboarding-tip .tip-count { color: #fdba74; font-size: 12px; font-weight: 700; }
    .onboarding-tip .tip-actions { display: flex; justify-content: flex-end; gap: 8px; }
    .onboarding-tip button { min-height: 36px; padding: 0 14px; border-radius: 9px; font-weight: 700; cursor: pointer; }
    .onboarding-tip .tip-skip { border: 1px solid rgba(255, 255, 255, 0.4); background: transparent; color: #fff; }
    .onboarding-tip .tip-next { border: 0; background: #f97316; color: #fff; }
  `;
  document.head.appendChild(style);
}

function readSeen(window) {
  try {
    return window?.localStorage?.getItem(ONBOARDING_TIPS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSeen(window) {
  try {
    window?.localStorage?.setItem(ONBOARDING_TIPS_STORAGE_KEY, '1');
  } catch {
    // Depolama kapalıysa ipucu yalnız bu oturumda kapanır.
  }
}

export function createOnboardingTips({ container } = {}) {
  const document = getFairStandHostDocument();
  const window = getFairStandHostWindow();
  if (!container || !document?.body) return { maybeShow() {}, element: null };
  ensureStyles(document);

  const tip = document.createElement('div');
  tip.className = 'onboarding-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'status');
  tip.setAttribute('aria-label', 'İpucu');
  tip.innerHTML = `
    <span class="tip-count"></span>
    <span class="tip-text"></span>
    <div class="tip-actions">
      <button type="button" class="tip-skip">Atla</button>
      <button type="button" class="tip-next">Tamam</button>
    </div>
  `;
  container.appendChild(tip);
  const count = tip.querySelector('.tip-count');
  const text = tip.querySelector('.tip-text');
  const next = tip.querySelector('.tip-next');
  let index = 0;
  let shownThisSession = false;

  function render() {
    count.textContent = `İpucu ${index + 1} / ${ONBOARDING_TIPS.length}`;
    text.textContent = ONBOARDING_TIPS[index];
    next.textContent = index === ONBOARDING_TIPS.length - 1 ? 'Bitir' : 'Tamam';
  }

  function finish() {
    tip.hidden = true;
    writeSeen(window);
  }

  tip.addEventListener('pointerdown', (event) => event.stopPropagation());
  tip.querySelector('.tip-skip').addEventListener('click', finish);
  next.addEventListener('click', () => {
    if (index >= ONBOARDING_TIPS.length - 1) {
      finish();
      return;
    }
    index += 1;
    render();
  });

  function maybeShow() {
    if (shownThisSession || readSeen(window)) return;
    shownThisSession = true;
    index = 0;
    render();
    tip.hidden = false;
  }

  return { maybeShow, element: tip };
}
