// Stand değişimi önizlemesi (yükseklik, genişlik / derinlik): uygulamanın kendi penceresi.
// Tarayıcının confirm penceresi bazı gömülü tarayıcılarda hiç açılmadan "İptal" döndüğü için
// kullanılmaz. Sonuç: Uygula → true, İptal / Esc / dış tık → false.
import { getFairStandHostDocument } from './hostDocument.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {object} options
 * @param {string} options.title Başlık (ör. "Duvar yüksekliği 3,5 m → 2,5 m").
 * @param {string[]} options.lines Değişiklik satırları; boşsa "değişmeyecek" yazılır.
 * @param {string} [options.confirmLabel]
 * @returns {Promise<boolean>}
 */
export function requestStandChangeConfirmation({ title, lines, confirmLabel = 'Uygula' }) {
  const doc = getFairStandHostDocument();
  return new Promise((resolve) => {
    const overlay = doc.createElement('div');
    overlay.className = 'stand-change-dialog-backdrop';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const dialog = doc.createElement('form');
    dialog.className = 'stand-change-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'stand-change-dialog-title');
    dialog.style.cssText = 'width:min(440px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 14px/1.45 system-ui,sans-serif;color:#0f172a';
    const items = lines.length
      ? lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')
      : '<li>Sahnedeki öğeler değişmeyecek.</li>';
    dialog.innerHTML = [
      `<strong id="stand-change-dialog-title" style="font-size:16px">${escapeHtml(title)}</strong>`,
      `<ul class="stand-change-dialog-lines" style="margin:0;padding-left:18px;display:grid;gap:4px">${items}</ul>`,
      '<p style="margin:0;color:#64748b;font-size:13px">Geri al (Ctrl+Z) ile dönebilirsin.</p>',
      `<div style="display:flex;justify-content:flex-end;gap:8px"><button type="button" data-cancel>İptal</button><button type="submit" class="primary" data-confirm>${escapeHtml(confirmLabel)}</button></div>`,
    ].join('');
    overlay.appendChild(dialog);
    doc.body.appendChild(overlay);

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    };
    const finish = (value) => {
      doc.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(value);
    };
    dialog.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) finish(false);
    });
    dialog.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(true);
    });
    doc.addEventListener('keydown', onKeyDown, true);
    dialog.querySelector('[data-confirm]').focus();
  });
}
