// Boy seçimi penceresi: katalogda tek kartı olan ölçü ailelerinde (dikme, profil, kısa panel)
// bırakılırken ve sağ tık menüsünden ölçü sorulur. Sonuç: { itemKey, remember } ya da iptalde null.
// remember true: tercih yazılır; false: tercih silinir (yeniden sorulur).
import { getItem } from './items.js';

/**
 * @param {object} options
 * @param {string} options.title Pencere başlığı.
 * @param {string} options.itemType Seçilebilen Item türü; başka tür gönderilmez.
 * @param {Array<object>} options.items Seçenekler (sıralı Item listesi); yalnız bunlardan biri döner.
 * @param {(item: object) => string} options.formatLabel Seçenek metni.
 * @param {string|null} [options.selectedItemKey]
 * @param {boolean} [options.remember]
 * @param {string} [options.fieldLabel] Seçim kutusunun etiketi.
 * @param {boolean} [options.allowRemember] false: "Bir daha sorma" çentiği gösterilmez.
 * @param {{label: string, checked?: boolean, isAvailable?: (itemKey: string) => boolean}|null} [options.option]
 *   Ek çentik (ör. Sarmaşıklı); sonuç `option`. isAvailable seçili ölçüde çentiğin geçerli olup olmadığını
 *   söyler: geçersizse çentik kapanır ve işaretlenemez (desteklenmeyen birleşim seçilemez).
 */
export function requestItemSizeChoice({
  title,
  itemType,
  items,
  formatLabel,
  selectedItemKey = null,
  remember = false,
  fieldLabel = 'Boy',
  allowRemember = true,
  option = null,
}) {
  return new Promise((resolve) => {
    const titleId = `${itemType}-size-title`;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    form.className = `${itemType}-size-dialog item-size-dialog`;
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', titleId);
    form.style.cssText = 'width:min(380px,100%);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a';
    const options = items.map((item) => (
      `<option value="${item.itemKey}"${item.itemKey === selectedItemKey ? ' selected' : ''}>${formatLabel(item)}</option>`
    )).join('');
    form.innerHTML = [
      `<strong id="${titleId}" style="font-size:16px">${title}</strong>`,
      `<label style="display:grid;gap:5px">${fieldLabel}<select name="itemKey" style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px">${options}</select></label>`,
      option
        ? `<label style="display:flex;gap:8px;align-items:center"><input name="option" type="checkbox"${option.checked ? ' checked' : ''}> ${option.label}</label>`
        : '',
      allowRemember
        ? `<label style="display:flex;gap:8px;align-items:center"><input name="remember" type="checkbox"${remember ? ' checked' : ''}> Bir daha sorma, aynı ölçüde getir</label>`
        : '',
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
      const itemKey = String(data.get('itemKey') ?? '');
      if (getItem(itemKey)?.type !== itemType) return;
      if (!items.some((item) => item.itemKey === itemKey)) return;
      const optionOn = data.get('option') === 'on';
      if (optionOn && typeof option?.isAvailable === 'function' && option.isAvailable(itemKey) !== true) return;
      finish({ itemKey, remember: data.get('remember') === 'on', option: optionOn });
    });
    const select = form.querySelector('select');
    const optionInput = form.querySelector('input[name="option"]');
    const syncOptionAvailability = () => {
      if (!optionInput || typeof option?.isAvailable !== 'function') return;
      const available = option.isAvailable(select.value) === true;
      optionInput.disabled = !available;
      if (!available) optionInput.checked = false;
      optionInput.closest('label')?.style.setProperty('opacity', available ? '1' : '0.5');
    };
    select?.addEventListener('change', syncOptionAvailability);
    syncOptionAvailability();
    document.addEventListener('keydown', onKeyDown, true);
    select?.focus();
  });
}

/** Tarayıcı tercihi okunur/yazılır; depolama kapalıysa sessizce atlanır. */
export function readItemSizePreference(preferenceKey, itemType, storage) {
  try {
    const itemKey = resolvePreferenceStorage(storage)?.getItem(preferenceKey) ?? null;
    return itemKey && getItem(itemKey)?.type === itemType ? itemKey : null;
  } catch {
    return null;
  }
}

export function writeItemSizePreference(preferenceKey, itemKey, storage) {
  try {
    const target = resolvePreferenceStorage(storage);
    if (!target) return;
    if (itemKey) target.setItem(preferenceKey, itemKey);
    else target.removeItem(preferenceKey);
  } catch {
    // Tarayıcı depolaması kapalıysa tercih tutulmaz; pencere her seferinde açılır.
  }
}

function resolvePreferenceStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}
