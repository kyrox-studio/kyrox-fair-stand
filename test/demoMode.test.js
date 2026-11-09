import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  bindDemoActionLocks,
  DEMO_LOCKED_ACTIONS,
  DEMO_LOGIN_REQUIRED_MESSAGE,
  findDemoLockedControl,
} from '../src/demoMode.js';
import {
  buildDemoProductionBomHtml,
  DEMO_PRODUCTION_BOM_GROUPS,
  DEMO_PRODUCTION_BOM_NOTICE,
} from '../src/demoProductionBom.js';
import { createDemoSession, formatDemoRemaining } from '../src/demoSession.js';
import { mapCatalogSeedToBootstrap } from './mapCatalogSeed.mjs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mainSource = read('../src/main.js');
const mountSource = read('../src/mountFairStand.js');
const panelSource = read('../src/productionBomPanel.js');
const catalogSource = read('../src/catalogBootstrap.js');
const markup = read('../src/configuratorMarkup.js');

test('kullanıcının istediği yedi düğme ve ek yazma yolları kilitli', () => {
  const labels = DEMO_LOCKED_ACTIONS.map((action) => action.label);
  for (const label of ['Farklı Kaydet', 'Dışarı Aktar', 'İçe Aktar', 'Aç', 'Sil', 'Kaydet', 'Render Al']) {
    assert.ok(labels.includes(label), label);
  }
  for (const label of ['Ekranı paylaş', 'Şablon olarak kaydet', 'Proje adı Değiştir']) {
    assert.ok(labels.includes(label), label);
  }
  assert.equal(DEMO_LOGIN_REQUIRED_MESSAGE, 'Demo sayfasında bu işlem için oturum açmanız gerekiyor.');
  // Seçicilerin her biri editör işaretlemesinde ya da grup panelinde gerçekten var.
  for (const { selector } of DEMO_LOCKED_ACTIONS) {
    const id = selector.match(/^#([a-z-]+)$/)?.[1];
    if (id) assert.match(markup, new RegExp(`id=\\\\"${id}\\\\"`), selector);
  }
  assert.match(read('../src/moduleGroupPanel.js'), /'group-save-template'/);
});

test('kilitli düğmeye basış işlemi durdurur ve oturum mesajı verir', () => {
  const listeners = [];
  const documentRef = {
    addEventListener(type, handler, capture) { listeners.push({ type, handler, capture }); },
    removeEventListener(type, handler) {
      const index = listeners.findIndex((entry) => entry.handler === handler);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  const messages = [];
  const unbind = bindDemoActionLocks(documentRef, { notify: (message) => messages.push(message) });
  assert.equal(listeners.length, 1);
  assert.equal(listeners[0].type, 'click');
  assert.equal(listeners[0].capture, true);

  const lockedButton = { id: 'render-current-view' };
  const lockedTarget = { closest: (selector) => (selector.includes('#render-current-view') ? lockedButton : null) };
  let prevented = 0;
  let stopped = 0;
  listeners[0].handler({
    target: lockedTarget,
    preventDefault: () => { prevented += 1; },
    stopImmediatePropagation: () => { stopped += 1; },
  });
  assert.deepEqual(messages, [DEMO_LOGIN_REQUIRED_MESSAGE]);
  assert.equal(prevented, 1);
  assert.equal(stopped, 1);

  // Kilitsiz kontrol (ör. Sahne Işığı, Gelişmiş mod) etkilenmez.
  listeners[0].handler({
    target: { closest: () => null },
    preventDefault: () => { prevented += 1; },
    stopImmediatePropagation: () => { stopped += 1; },
  });
  assert.equal(messages.length, 1);
  assert.equal(prevented, 1);

  unbind();
  assert.equal(listeners.length, 0);
  assert.equal(findDemoLockedControl(null), null);
});

test('Gelişmiş mod, Sahne Işığı ve geri/ileri al kilit listesinde değil', () => {
  const selectors = DEMO_LOCKED_ACTIONS.map((action) => action.selector).join(' ');
  for (const id of ['editor-mode-advanced', 'toggle-stage-light', 'design-undo', 'design-redo', 'toggle-production-bom', 'surface-image']) {
    assert.doesNotMatch(selectors, new RegExp(id), id);
  }
});

test('kilitler editörden önce kaydolur, demo canlı paylaşım ve proje kimliği taşımaz', () => {
  const lockIndex = mountSource.indexOf('bindDemoActionLocks(hostDocument');
  const startIndex = mountSource.indexOf('stop = startFairStandConfigurator(');
  assert.ok(lockIndex > 0 && lockIndex < startIndex);
  assert.match(mountSource, /if \(!demo\) stopLiveShare = bindLiveTabShare/);
  assert.match(mountSource, /initialProjectId: demo \? undefined : options\.initialProjectId/);
  assert.match(mountSource, /delete hostWindow\.__FAIR_STAND_CATALOG_HEADERS__/);
  assert.match(mountSource, /beforeCatalog: demoSession \? \(\) => demoSession\.ready : undefined/);
  assert.match(mainSource, /Promise\.resolve\(options\.beforeCatalog\?\.\(\)\)\s*\.then\(\(\) => bootstrapFairStandCatalog\(\)\)/);
});

test('demo katalogu kendi ucundan, Core başlığı olmadan ister', () => {
  assert.match(catalogSource, /'\/api\/v1\/fair-stand\/demo\/catalog\/bootstrap'/);
  assert.match(catalogSource, /if \(isFairStandDemo\(\)\) return DEMO_CATALOG_BOOTSTRAP_URL;/);
  assert.match(catalogSource, /function catalogBootstrapHeaders\(\) \{\n  if \(isFairStandDemo\(\)\) return \{\};/);
});

test('demo otomatik kaydı kapatır, önbellekteki projeleri listelemez, çıkış uyarısı vermez', () => {
  assert.match(mainSource, /applyAutosaveInterval\(isFairStandDemo\(\) \? 0 : readAutosaveMinutes\(\)\)/);
  assert.match(mainSource, /if \(isFairStandDemo\(\)\) applyDemoControls\(document\);\nelse void refreshProjectList\(\)/);
  assert.match(mainSource, /function onBeforeUnloadWarnUnsaved\(event\) \{\n[^\n]*\n  if \(isFairStandDemo\(\)\) return;/);
  assert.match(mainSource, /const initialProjectId = isFairStandDemo\(\)\n    \? null/);
  assert.match(read('../src/demoMode.js'), /autosave\.disabled = true/);
});

test('demo Üretim Listesi notu gösterir, boş değildir, gerçek Item kimliği taşımaz', () => {
  const html = buildDemoProductionBomHtml();
  assert.equal(DEMO_PRODUCTION_BOM_NOTICE, 'Demo görüntülemede gerçek Üretim Listesi görülemez.');
  assert.ok(html.includes(DEMO_PRODUCTION_BOM_NOTICE));
  const lineCount = DEMO_PRODUCTION_BOM_GROUPS.reduce((sum, group) => sum + group.lines.length, 0);
  assert.ok(lineCount >= 6);
  assert.equal((html.match(/<li>/g) || []).length, lineCount);
  assert.doesNotMatch(html, /data-role="bom-download"/);
  const catalog = mapCatalogSeedToBootstrap(JSON.parse(read('./fixtures/itemCatalogSeed.json')));
  for (const item of catalog.items) {
    assert.ok(!html.includes(item.itemKey), item.itemKey);
    if (item.displayName && item.displayName.length > 3) assert.ok(!html.includes(`>${item.displayName} —`), item.displayName);
  }
  for (const group of DEMO_PRODUCTION_BOM_GROUPS) {
    for (const line of group.lines) assert.match(line.label, /^Örnek /);
  }
});

test('panel demo modunda gerçek listeyi hesaplamaz ve metin indirmez', () => {
  assert.match(panelSource, /if \(isFairStandDemo\(\)\) \{\n      paint\(buildDemoProductionBomHtml\(\)\);\n      return;\n    \}/);
  assert.match(panelSource, /function downloadProductionBomText\(doc\) \{\n    if \(isFairStandDemo\(\)\) return;/);
});

test('kalan süre dakika:saniye yazılır', () => {
  assert.equal(formatDemoRemaining(1500), '25:00');
  assert.equal(formatDemoRemaining(61), '1:01');
  assert.equal(formatDemoRemaining(-5), '0:00');
});

function fakeDom() {
  const byId = new Map();
  const docListeners = new Map();
  const timers = [];
  function createElement(tag) {
    const element = {
      tag, children: [], attributes: {}, textContent: '', className: '', _id: '',
      get id() { return this._id; },
      set id(value) { this._id = value; byId.set(value, this); },
      set innerHTML(_value) { this.children = []; },
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...nodes) { this.children.push(...nodes); },
      appendChild(node) { this.children.push(node); return node; },
      querySelector: () => null,
      remove() { byId.delete(this._id); },
      focus() {},
    };
    return element;
  }
  const view = {
    setInterval(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    clearInterval(id) { if (timers[id - 1]) timers[id - 1].cleared = true; },
  };
  const documentRef = {
    visibilityState: 'visible',
    defaultView: view,
    createElement,
    getElementById: (id) => byId.get(id) ?? null,
    addEventListener(type, handler) { docListeners.set(type, handler); },
    removeEventListener(type) { docListeners.delete(type); },
  };
  const container = createElement('div');
  container.ownerDocument = documentRef;
  documentRef.body = createElement('body');
  documentRef.body.ownerDocument = documentRef;
  return { container, documentRef, byId, timers };
}

function jsonResponse(status, body) {
  return { status, ok: status >= 200 && status < 300, json: async () => body };
}

test('süre bitmişse editör başlamaz ve kilit ekranı çıkar', async () => {
  const { container, documentRef, byId } = fakeDom();
  const calls = [];
  const session = createDemoSession({
    container,
    fetchImpl: async (url, init) => {
      calls.push([url, init.method, init.credentials]);
      return jsonResponse(200, { remainingSeconds: 0, limitSeconds: 1500, heartbeatSeconds: 30 });
    },
  });
  let started = false;
  void session.ready.then(() => { started = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [['/api/v1/fair-stand/demo/session', 'POST', 'same-origin']]);
  assert.equal(started, false);
  assert.equal(session.isLocked(), true);
  const overlay = byId.get('fair-stand-demo-expired');
  assert.ok(overlay);
  // Kilit gövdededir; gövdedeki yüzen paneller (Üretim Listesi) üstünde kalamaz.
  assert.ok(documentRef.body.children.includes(overlay));
  const [watermarkLogo, watermarkLabel] = byId.get('fair-stand-demo-watermark').children;
  assert.equal(watermarkLogo.tag, 'img');
  assert.match(watermarkLogo.src, /\/assets\/kyrox-logo-siyah\.svg$/);
  assert.equal(watermarkLogo.alt, 'Kyrox Studio');
  assert.equal(watermarkLabel.textContent, 'DEMO');
});

test('sinyal 403 dönünce editör kilitlenir; gizli sekmede sinyal gitmez', async () => {
  const { container, documentRef, timers } = fakeDom();
  const responses = [
    jsonResponse(200, { remainingSeconds: 40, limitSeconds: 1500, heartbeatSeconds: 30 }),
    jsonResponse(403, { detail: 'demo_expired' }),
  ];
  const calls = [];
  const session = createDemoSession({
    container,
    fetchImpl: async (url) => { calls.push(url); return responses.shift(); },
  });
  await session.ready;
  assert.equal(timers[0].ms, 30000);
  documentRef.visibilityState = 'hidden';
  await timers[0].fn();
  assert.equal(calls.length, 1);
  documentRef.visibilityState = 'visible';
  await timers[0].fn();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['/api/v1/fair-stand/demo/session', '/api/v1/fair-stand/demo/heartbeat']);
  assert.equal(session.isLocked(), true);
  session.destroy();
});

test('demo sahne kurarken ad sormaz, projeyi kaydetmez ve otomatik kaydı açmaz', () => {
  assert.match(mainSource, /const projectName = isFairStandDemo\(\)\n    \? DEMO_PROJECT_NAME\n    : await requestProjectName/);
  const createStage = mainSource.slice(mainSource.indexOf("createStageButton.addEventListener('click'"));
  const demoBranch = createStage.indexOf('if (isFairStandDemo()) {\n    // Demo kaydetmez (ADR-0012); koruma kartı ve ipucu yine sahne kurulunca açılır.\n    projectStatus.textContent = DEMO_STAGE_READY_STATUS;\n  } else {');
  const persist = createStage.indexOf("await persistActiveProject({ quiet: true, reason: 'init' })");
  assert.ok(demoBranch > 0 && demoBranch < persist);
  assert.match(mainSource, /async function persistActiveProject\(\{ quiet = false, reason = 'design' \} = \{\}\) \{\n[^\n]*\n  if \(isFairStandDemo\(\)\) return \{ enableAutosave: false, stored: null \};/);
  assert.match(read('../src/newProjectWizard.js'), /isFairStandDemo\(\)\n      \? DEMO_NEW_PROJECT_HINT/);
});

test('demo Geçmiş kartını sahne kurulduktan sonra da gizli tutar', () => {
  assert.match(mainSource, /if \(isFairStandDemo\(\) \|\| !revisions\.length\) \{\n    projectRevisions\.open = false;\n    projectRevisions\.hidden = true;/);
});

test('gizli Geçmiş kartı display kuralına rağmen görünmez', () => {
  assert.match(read('../src/style.css'), /\.collapsible-panel\[hidden\] \{\r?\n  display: none;\r?\n\}/);
  assert.match(read('../src/demoMode.js'), /setAttribute\('data-fair-stand-demo', 'true'\)/);
});
