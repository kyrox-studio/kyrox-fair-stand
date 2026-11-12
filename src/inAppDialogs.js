// Uygulamanın kendi ad sorma ve onay pencereleri. Tarayıcının prompt / confirm pencereleri bazı
// gömülü tarayıcılarda (uygulama içi tarayıcı, gömülü host) hiç açılmadan iptal döndüğü için
// grup ve şablon işlemlerinde kullanılmaz. Sonuç: ad → metin (iptalde null); onay → true / false.
import { getFairStandHostDocument } from './hostDocument.js';

const OVERLAY_STYLE = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
const DIALOG_STYLE = 'width:min(400px,100%);max-height:calc(100vh - 40px);overflow:auto;background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 14px/1.45 system-ui,sans-serif;color:#0f172a';

let dialogSequence = 0;

function openDialog({ title, buildBody, submitLabel, onSubmit, cancelValue }) {
  const doc = getFairStandHostDocument();
  return new Promise((resolve) => {
    dialogSequence += 1;
    const titleId = `in-app-dialog-title-${dialogSequence}`;
    const overlay = doc.createElement('div');
    overlay.className = 'in-app-dialog-backdrop';
    overlay.style.cssText = OVERLAY_STYLE;
    overlay.setAttribute('role', 'presentation');
    const form = doc.createElement('form');
    form.className = 'in-app-dialog';
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', titleId);
    form.style.cssText = DIALOG_STYLE;
    const heading = doc.createElement('strong');
    heading.id = titleId;
    heading.style.fontSize = '16px';
    heading.textContent = title;
    const body = buildBody(doc);
    const actions = doc.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px';
    const cancelButton = doc.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'İptal';
    const submitButton = doc.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'primary';
    submitButton.textContent = submitLabel;
    actions.append(cancelButton, submitButton);
    form.append(heading, ...body.nodes, actions);
    overlay.appendChild(form);
    doc.body.appendChild(overlay);

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      finish(cancelValue);
    };
    const finish = (value) => {
      doc.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(value);
    };
    cancelButton.addEventListener('click', () => finish(cancelValue));
    overlay.addEventListener('pointerdown', (event) => {
      if (event.target === overlay) finish(cancelValue);
    });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = onSubmit();
      if (result.done) finish(result.value);
    });
    doc.addEventListener('keydown', onKeyDown, true);
    (body.focus ?? submitButton).focus();
    body.afterFocus?.();
  });
}

/**
 * Ad sorar. Boş ad kabul edilmez (alan odakta kalır). İptal / Esc / dış tık → null.
 * @returns {Promise<string|null>}
 */
export function requestTextInput({ title, label, defaultValue = '', submitLabel = 'Kaydet', maxLength = 80 }) {
  let input = null;
  return openDialog({
    title,
    submitLabel,
    cancelValue: null,
    buildBody(doc) {
      const field = doc.createElement('label');
      field.style.cssText = 'display:grid;gap:5px';
      field.textContent = label;
      input = doc.createElement('input');
      input.type = 'text';
      input.name = 'inAppDialogText';
      input.maxLength = maxLength;
      input.autocomplete = 'off';
      input.required = true;
      input.value = String(defaultValue ?? '');
      input.style.cssText = 'height:40px;padding:0 10px;border:1px solid #cbd5e1;border-radius:8px';
      field.appendChild(input);
      return { nodes: [field], focus: input, afterFocus: () => input.select() };
    },
    onSubmit() {
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return { done: false };
      }
      return { done: true, value };
    },
  });
}

/**
 * Onay sorar. Onayla → true; İptal / Esc / dış tık → false.
 * @returns {Promise<boolean>}
 */
export function requestConfirmation({ title, message, confirmLabel = 'Devam et' }) {
  return openDialog({
    title,
    submitLabel: confirmLabel,
    cancelValue: false,
    buildBody(doc) {
      const text = doc.createElement('p');
      // Çok satırlı onay metinleri (\n) satır satır görünür.
      text.style.cssText = 'margin:0;color:#334155;white-space:pre-line';
      text.textContent = message;
      return { nodes: [text] };
    },
    onSubmit() {
      return { done: true, value: true };
    },
  });
}
