import styleCss from './style.css?inline';
import colorEditorCss from './colorEditor.css?inline';
import imageActionsCss from './imageActions.css?inline';
import helpGuideCss from './helpGuide.css?inline';
import productionBomPanelCss from './productionBomPanel.css?inline';
import { FAIR_STAND_MARKUP } from './configuratorMarkup.js';
import { bindLiveTabShare } from './liveTabShare.js';
import { setFairStandHostDocument } from './hostDocument.js';
import { startFairStandConfigurator } from './main.js';
import { startEditorBootTiming } from './projectOpenTiming.js';

const TRASH_BIN_PREVIEW_CSS = `
.module-drag-card[data-module-key="plastic_trash_bin"] .module-drag-panel,
.module-catalog-card[data-module-key="plastic_trash_bin"] .module-drag-panel {
  position: relative;
  display: block;
  width: 34px !important;
  height: 48px;
  border: 3px solid #4b5563;
  border-radius: 5px 5px 8px 8px;
  background: #d7dce2;
  box-sizing: border-box;
  box-shadow: 3px 3px 0 #b8c0c9;
}
.module-drag-card[data-module-key="plastic_trash_bin"] .module-drag-panel span,
.module-catalog-card[data-module-key="plastic_trash_bin"] .module-drag-panel span {
  display: none;
}
.module-drag-card[data-module-key="plastic_trash_bin"] .module-drag-panel::before,
.module-catalog-card[data-module-key="plastic_trash_bin"] .module-drag-panel::before {
  content: '';
  position: absolute;
  left: -5px;
  right: -5px;
  top: -8px;
  height: 7px;
  border: 3px solid #4b5563;
  border-radius: 5px 5px 2px 2px;
  background: #aeb6c0;
  box-sizing: border-box;
}
.module-drag-card[data-module-key="plastic_trash_bin"] .module-drag-panel::after,
.module-catalog-card[data-module-key="plastic_trash_bin"] .module-drag-panel::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  top: 8px;
  bottom: 7px;
  border-left: 2px solid #9aa3ad;
  border-right: 2px solid #9aa3ad;
}
`;

const HOST_CHROME_RESET_CSS = `
#app > .sidebar {
  width: auto !important;
  max-width: none !important;
  min-width: 0 !important;
  flex: initial;
  flex-shrink: initial;
  position: relative !important;
  left: auto !important;
  top: auto !important;
  height: auto !important;
  min-height: 0;
  transform: none !important;
  transition: none;
}
#app > .sidebar-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
`;

const MOUNT_STYLE_CSS = [
  styleCss,
  colorEditorCss,
  imageActionsCss,
  helpGuideCss,
  productionBomPanelCss,
  TRASH_BIN_PREVIEW_CSS,
  HOST_CHROME_RESET_CSS,
].join('\n');

function publishHostValue(hostWindow, key, value) {
  if (value == null) return;
  hostWindow[key] = value;
  globalThis[key] = value;
}

function showInitialProjectLoading(container) {
  const overlay = container.querySelector('#project-loading-overlay');
  if (!overlay) return;
  const title = container.querySelector('#project-loading-title');
  const detail = container.querySelector('#project-loading-detail');
  if (title) title.textContent = 'Proje yükleniyor…';
  if (detail) detail.textContent = 'Editör hazırlanıyor.';
  overlay.hidden = false;
}

export function mountFairStand(container, options = {}) {
  if (!container) {
    throw new Error('Fair Stand mount container is required.');
  }
  startEditorBootTiming();

  const hostDocument = container.ownerDocument;
  const hostWindow = hostDocument?.defaultView;
  if (!hostDocument?.head || !hostWindow) {
    throw new Error('Fair Stand host document could not be created.');
  }

  const style = hostDocument.createElement('style');
  style.setAttribute('data-fair-stand-mount', 'true');
  style.textContent = MOUNT_STYLE_CSS;
  hostDocument.head.appendChild(style);
  container.replaceChildren();
  container.insertAdjacentHTML('beforeend', FAIR_STAND_MARKUP);
  // Proje açarak gelindiyse (Düzenle) editör kodu ve katalog yüklenirken boş editör yerine
  // yükleme ekranı görünür; proje açılışı ekranı devralır ve sahne dolunca kapatır.
  if (options.initialProjectId) showInitialProjectLoading(container);

  setFairStandHostDocument(hostDocument);
  publishHostValue(hostWindow, '__FAIR_STAND_CATALOG_HEADERS__', options.catalogHeaders);
  publishHostValue(hostWindow, '__FAIR_STAND_PROJECT_CAPABILITIES__', options.capabilities);
  publishHostValue(hostWindow, '__FAIR_STAND_INITIAL_PROJECT_ID__', options.initialProjectId);
  publishHostValue(hostWindow, '__FAIR_STAND_CUSTOMER_ID__', options.customerId);

  let stop;
  let stopLiveShare;
  try {
    stop = startFairStandConfigurator({
      initialProjectId: options.initialProjectId,
      customerId: options.customerId,
      capabilities: options.capabilities,
    });
    stopLiveShare = bindLiveTabShare(hostDocument, {
      capabilities: options.capabilities,
      headers: () => hostWindow.__FAIR_STAND_CATALOG_HEADERS__ || options.catalogHeaders || {},
      location: hostWindow.location,
      fetch: hostWindow.fetch.bind(hostWindow),
      WebSocket: hostWindow.WebSocket,
    });
  } catch (error) {
    style.remove();
    container.replaceChildren();
    setFairStandHostDocument(typeof document !== 'undefined' ? document : null);
    throw error;
  }

  return function unmountFairStand() {
    try {
      stopLiveShare?.();
      stop?.();
    } catch (error) {
      console.warn('Fair Stand runtime stop failed:', error);
    }
    setFairStandHostDocument(typeof document !== 'undefined' ? document : null);
    try {
      delete hostWindow.__FAIR_STAND_INITIAL_PROJECT_ID__;
      delete hostWindow.__FAIR_STAND_CUSTOMER_ID__;
      delete hostWindow.__FAIR_STAND_PROJECT_CAPABILITIES__;
      delete globalThis.__FAIR_STAND_INITIAL_PROJECT_ID__;
      delete globalThis.__FAIR_STAND_CUSTOMER_ID__;
      delete globalThis.__FAIR_STAND_PROJECT_CAPABILITIES__;
    } catch {
      /* ignore */
    }
    style.remove();
    container.replaceChildren();
  };
}
