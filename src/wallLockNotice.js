// Yeni sahne açılınca otomatik duvar zinciri kilitli gelir. Kullanıcıya bir kez sorulur:
// koruma kalsın mı, kaldırılsın mı? Karar main.js'te uygulanır (Herşeyi Kilitle).
// Kart sahneyi kilitlemez (ilk ipucu gibi); cevap verilmeden de çalışılabilir.

export const WALL_LOCK_NOTICE_TEXT = Object.freeze({
  title: 'Duvar zinciri hareket korumalı',
  body: 'Tüm duvar zinciri, yanlışlıkla kaymasın diye kilitli geldi. Koruma yalnız duvarların taşınmasını, döndürülmesini ve silinmesini engeller; renk, görsel ve diğer çalışmalarına engel değildir.',
  question: 'Koruma kaldırılsın mı?',
  hint: 'Korumayı sonradan Ayarlar → Herşeyi Kilitle ile açıp kapatabilirsin.',
  keep: 'Koruma kalsın',
  unlock: 'Korumayı kaldır',
});

/** true: kullanıcı korumanın kaldırılmasını seçti; false: koruma kalır (Koruma kalsın / Escape). */
export function requestWallLockDecision({ documentRef = globalThis.document, container = null, topPx = 72 } = {}) {
  if (!documentRef?.createElement || !documentRef?.body) return Promise.resolve(false);
  const host = container ?? documentRef.body;

  return new Promise((resolve) => {
    const card = documentRef.createElement('div');
    card.className = 'wall-lock-notice';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'false');
    card.setAttribute('aria-labelledby', 'wall-lock-notice-title');
    card.setAttribute('aria-describedby', 'wall-lock-notice-body');
    card.style.cssText = `position:${host === documentRef.body ? 'fixed' : 'absolute'};z-index:7;top:${Math.max(16, Math.round(Number(topPx) || 0))}px;left:16px;width:min(360px,calc(100% - 32px));background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;box-shadow:0 16px 40px rgba(15,23,42,.22);display:grid;gap:8px;font:500 13px/1.45 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a`;

    const title = documentRef.createElement('strong');
    title.id = 'wall-lock-notice-title';
    title.style.fontSize = '15px';
    title.textContent = `🔒 ${WALL_LOCK_NOTICE_TEXT.title}`;
    const body = documentRef.createElement('p');
    body.id = 'wall-lock-notice-body';
    body.style.margin = '0';
    body.textContent = WALL_LOCK_NOTICE_TEXT.body;
    const question = documentRef.createElement('strong');
    question.textContent = WALL_LOCK_NOTICE_TEXT.question;
    const hint = documentRef.createElement('span');
    hint.style.color = '#64748b';
    hint.textContent = WALL_LOCK_NOTICE_TEXT.hint;

    const actions = documentRef.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:2px';
    const keepButton = documentRef.createElement('button');
    keepButton.type = 'button';
    keepButton.className = 'primary';
    keepButton.dataset.wallLockChoice = 'keep';
    keepButton.textContent = WALL_LOCK_NOTICE_TEXT.keep;
    const unlockButton = documentRef.createElement('button');
    unlockButton.type = 'button';
    unlockButton.dataset.wallLockChoice = 'unlock';
    unlockButton.textContent = WALL_LOCK_NOTICE_TEXT.unlock;
    actions.append(unlockButton, keepButton);

    card.append(title, body, question, hint, actions);
    host.appendChild(card);

    const finish = (unlock) => {
      documentRef.removeEventListener('keydown', onKeyDown, true);
      card.remove();
      resolve(unlock);
    };
    function onKeyDown(event) {
      if (event.key !== 'Escape') return;
      finish(false);
    }
    // Sahne kartın altındaki öğeyi seçip sürüklemesin.
    card.addEventListener('pointerdown', (event) => event.stopPropagation());
    documentRef.addEventListener('keydown', onKeyDown, true);
    keepButton.addEventListener('click', () => finish(false));
    unlockButton.addEventListener('click', () => finish(true));
  });
}
