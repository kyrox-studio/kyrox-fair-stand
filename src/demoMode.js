// Oturumsuz demo modu (ADR-0012). Demo, CRM `/stand-demo` sayfasından
// `mountFairStand(el, { demo: true })` ile açılır. Bu dosya yalnız istemci tarafı
// kilitleri tutar; asıl sınır sunucudadır: demo çerezi hiçbir proje, şablon, maliyet,
// paylaşım ya da admin ucunu açmaz ve süre sayacı sunucuda işler.
import { getFairStandHostDocument, getFairStandHostWindow } from './hostDocument.js';

export const DEMO_LOGIN_REQUIRED_MESSAGE = 'Demo sayfasında bu işlem için oturum açmanız gerekiyor.';
export const DEMO_CUSTOMER_LABEL = 'Demo';
export const DEMO_PROJECT_NAME = 'Demo Proje';
export const DEMO_NEW_PROJECT_HINT = 'Oluştur dediğinde sahne kurulur. Demo sayfasında proje kaydedilmez.';
export const DEMO_STAGE_READY_STATUS = 'Demo: sahne kuruldu. Demo sayfasında proje kaydedilmez.';

// Basınca oturum mesajı veren düğmeler. Kullanıcının listesi: Farklı Kaydet, Dışarı Aktar,
// İçe Aktar, Aç, Sil, Kaydet, Render Al. Ek olarak sunucuya yazan ya da veri dışarı veren
// yollar: Ekranı paylaş, Şablon olarak kaydet, proje adını değiştirme.
export const DEMO_LOCKED_ACTIONS = Object.freeze([
  Object.freeze({ selector: '#save-as-project', label: 'Farklı Kaydet' }),
  Object.freeze({ selector: '#export-project', label: 'Dışarı Aktar' }),
  Object.freeze({ selector: '#import-project', label: 'İçe Aktar' }),
  Object.freeze({ selector: '#open-project', label: 'Aç' }),
  Object.freeze({ selector: '#delete-project', label: 'Sil' }),
  Object.freeze({ selector: '#save-project', label: 'Kaydet' }),
  Object.freeze({ selector: '#render-current-view', label: 'Render Al' }),
  Object.freeze({ selector: '#live-share-start', label: 'Ekranı paylaş' }),
  Object.freeze({ selector: '[data-group-action="group-save-template"]', label: 'Şablon olarak kaydet' }),
  Object.freeze({ selector: '#rename-project', label: 'Proje adı Değiştir' }),
]);

const LOCKED_SELECTOR = DEMO_LOCKED_ACTIONS.map((action) => action.selector).join(', ');

export function isFairStandDemo() {
  const hostWindow = getFairStandHostWindow();
  return hostWindow?.__FAIR_STAND_DEMO__ === true || globalThis.__FAIR_STAND_DEMO__ === true;
}

export function findDemoLockedControl(target) {
  return target?.closest?.(LOCKED_SELECTOR) ?? null;
}

/**
 * Kilitli düğmeye basış, düğmenin kendi işleyicisinden ve proje kayıt korumasından önce
 * (document capture, ilk kayıt) yakalanır; işlem çalışmaz, yalnız mesaj çıkar.
 */
export function bindDemoActionLocks(documentRef, { notify }) {
  if (!documentRef?.addEventListener) return () => {};
  function onClick(event) {
    if (!findDemoLockedControl(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    notify(DEMO_LOGIN_REQUIRED_MESSAGE);
  }
  documentRef.addEventListener('click', onClick, true);
  return () => documentRef.removeEventListener('click', onClick, true);
}

/** Demo açılışında sunucuya yazan ayarları kapatır. Runtime başladıktan sonra çağrılır. */
export function applyDemoControls(documentRef = getFairStandHostDocument()) {
  if (!documentRef?.querySelector) return;
  const autosave = documentRef.querySelector('#autosave-interval');
  if (autosave) {
    autosave.value = '0';
    autosave.disabled = true;
    autosave.title = DEMO_LOGIN_REQUIRED_MESSAGE;
  }
  const revisions = documentRef.querySelector('#project-revisions');
  if (revisions) revisions.hidden = true;
  const customer = documentRef.querySelector('#project-customer-display');
  if (customer) customer.textContent = DEMO_CUSTOMER_LABEL;
  documentRef.querySelector('#app')?.setAttribute('data-fair-stand-demo', 'true');
}
