// Dikme boyu seçimi: katalogdaki tek dikme kartı bırakılırken boy sorulur. Varsayılan seçili
// duvar yüksekliğinin dikmesidir (gerçek boy = duvar × 0,99). "Bir daha sorma" işaretlenirse
// seçilen boy bu tarayıcıda hatırlanır ve sonraki dikmeler sormadan o boyda gelir; sağ tık
// "Dikme yüksekliği…" aynı pencereyi açar, çentik oradan kaldırılınca yeniden sorulur.
import { getItem, listRegisteredItems } from './items.js';

export const UPRIGHT_HEIGHT_PREFERENCE_KEY = 'fairStand.uprightHeightItemKey';
const UPRIGHT_REAL_HEIGHT_RATIO = 0.99;

export function listUprightHeightItems() {
  return listRegisteredItems()
    .filter((item) => item.type === 'upright' && Number(item.dimensions?.heightCm) > 0)
    .sort((a, b) => Number(a.dimensions.heightCm) - Number(b.dimensions.heightCm));
}

export function defaultUprightItemKeyForWallHeight(wallLineHeightCm) {
  const items = listUprightHeightItems();
  const match = items.find((item) => (
    Math.abs(Number(item.dimensions.heightCm) - Number(wallLineHeightCm) * UPRIGHT_REAL_HEIGHT_RATIO) < 0.01
  ));
  return match?.itemKey ?? items.at(-1)?.itemKey ?? null;
}

function preferenceStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readUprightHeightPreference(storage) {
  try {
    const itemKey = preferenceStorage(storage)?.getItem(UPRIGHT_HEIGHT_PREFERENCE_KEY) ?? null;
    return itemKey && getItem(itemKey)?.type === 'upright' ? itemKey : null;
  } catch {
    return null;
  }
}

export function writeUprightHeightPreference(itemKey, storage) {
  try {
    const target = preferenceStorage(storage);
    if (!target) return;
    if (itemKey) target.setItem(UPRIGHT_HEIGHT_PREFERENCE_KEY, itemKey);
    else target.removeItem(UPRIGHT_HEIGHT_PREFERENCE_KEY);
  } catch {
    // Tarayıcı depolaması kapalıysa tercih tutulmaz; pencere her seferinde açılır.
  }
}

function formatUprightLabel(item) {
  const heightCm = Number(item.dimensions.heightCm);
  const wallCm = Math.round(heightCm / UPRIGHT_REAL_HEIGHT_RATIO);
  return `${String(heightCm).replace('.', ',')} cm (${wallCm} cm duvar)`;
}

/**
 * Dikme boyu penceresi. Sonuç: { itemKey, remember } ya da iptalde null.
 * remember true: tercih yazılır; false: tercih silinir (yeniden sorulur).
 */
export function requestUprightHeight({ selectedItemKey, remember = false } = {}) {
  return new Promise((resolve) => {
    const items = listUprightHeightItems();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:12000;background:rgba(15,23,42,.48);display:grid;place-items:center;padding:20px';
    overlay.setAttribute('role', 'presentation');
    const form = document.createElement('form');
    form.className = 'upright-height-dialog';
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.setAttribute('aria-labelledby', 'upright-height-title');
    form.style.cssText = 'width:min(380px,100%);background:#fff;border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(15,23,42,.28);display:grid;gap:12px;font:500 13px/1.35 Inter,ui-sans-serif,system-ui,sans-serif;color:#16161a';
    const options = items.map((item) => (
      `<option value="${item.itemKey}"${item.itemKey === selectedItemKey ? ' selected' : ''}>${formatUprightLabel(item)}</option>`
    )).join('');
    form.innerHTML = [
      '<strong id="upright-height-title" style="font-size:16px">Dikme yüksekliği</strong>',
      `<label style="display:grid;gap:5px">Boy<select name="itemKey" style="height:38px;padding:0 9px;border:1px solid #cbd5e1;border-radius:8px">${options}</select></label>`,
      `<label style="display:flex;gap:8px;align-items:center"><input name="remember" type="checkbox"${remember ? ' checked' : ''}> Bir daha sorma, aynı ölçüde getir</label>`,
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
      if (getItem(itemKey)?.type !== 'upright') return;
      finish({ itemKey, remember: data.get('remember') === 'on' });
    });
    document.addEventListener('keydown', onKeyDown, true);
    form.querySelector('select')?.focus();
  });
}
