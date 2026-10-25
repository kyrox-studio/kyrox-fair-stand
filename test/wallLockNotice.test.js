import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { requestWallLockDecision, WALL_LOCK_NOTICE_TEXT } from '../src/wallLockNotice.js';

const mainSource = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function createFakeDocument() {
  const listeners = new Map();
  function createElement(tag) {
    const element = {
      tag, children: [], style: {}, dataset: {}, attributes: {}, handlers: {}, textContent: '', removed: false,
      setAttribute(name, value) { this.attributes[name] = value; },
      append(...nodes) { this.children.push(...nodes); },
      appendChild(node) { this.children.push(node); return node; },
      addEventListener(type, handler) { this.handlers[type] = handler; },
      remove() { this.removed = true; },
      focus() {},
    };
    return element;
  }
  const body = createElement('body');
  return {
    body,
    createElement,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
    listeners,
  };
}

function findButton(node, choice) {
  if (node?.dataset?.wallLockChoice === choice) return node;
  for (const child of node?.children ?? []) {
    const found = findButton(child, choice);
    if (found) return found;
  }
  return null;
}

test('uyarı korumanın yalnız hareketi engellediğini söyler', () => {
  assert.match(WALL_LOCK_NOTICE_TEXT.body, /taşınmasını, döndürülmesini ve silinmesini engeller/);
  assert.match(WALL_LOCK_NOTICE_TEXT.body, /renk, görsel/);
  assert.match(WALL_LOCK_NOTICE_TEXT.hint, /Herşeyi Kilitle/);
});

test('"Korumayı kaldır" true, "Koruma kalsın" false döner ve kart kapanır', async () => {
  for (const [choice, expected] of [['unlock', true], ['keep', false]]) {
    const documentRef = createFakeDocument();
    const pending = requestWallLockDecision({ documentRef });
    const card = documentRef.body.children[0];
    findButton(card, choice).handlers.click();
    assert.equal(await pending, expected);
    assert.equal(card.removed, true);
    assert.equal(documentRef.listeners.has('keydown'), false);
  }
});

test('kart sahneyi kilitlemez: verilen kapsayıcıya yerleşir, modal değildir, tıklama sahneye geçmez', () => {
  const documentRef = createFakeDocument();
  const container = documentRef.createElement('main');
  requestWallLockDecision({ documentRef, container });
  const card = container.children[0];
  assert.equal(documentRef.body.children.length, 0);
  assert.equal(card.attributes['aria-modal'], 'false');
  assert.match(card.style.cssText, /position:absolute/);
  let stopped = false;
  card.handlers.pointerdown({ stopPropagation() { stopped = true; } });
  assert.equal(stopped, true);
});

test('Escape korumayı bırakır', async () => {
  const documentRef = createFakeDocument();
  const pending = requestWallLockDecision({ documentRef });
  documentRef.listeners.get('keydown')({ key: 'Escape', preventDefault() {} });
  assert.equal(await pending, false);
});

test('yeni sahne kaydından sonra sorulur; kaldır denirse tüm öğelerin kilidi açılır', () => {
  const createStart = mainSource.indexOf("createStageButton.addEventListener('click'");
  const createHandler = mainSource.slice(createStart, mainSource.indexOf('floorTypeSelect.addEventListener', createStart));
  assert.ok(createHandler.indexOf('void offerWallLockRelease()') > createHandler.indexOf('persistActiveProject'));
  const helper = mainSource.slice(mainSource.indexOf('async function offerWallLockRelease'));
  assert.match(helper, /activeProjectId !== askedProjectId/);
  assert.match(helper, /changeModuleLock\(currentModules\.map\(module => module\.id\), false\)/);
  assert.match(helper, /syncAllModulesLockControl\(\)/);
});

test('sahne yeniden kurulunca ya da proje açılınca açık kart kapanır', () => {
  const rebuild = mainSource.slice(mainSource.indexOf('function rebuildSceneFromSetup'));
  assert.match(rebuild.slice(0, 300), /dismissWallLockNotice\(\)/);
  const restore = mainSource.slice(mainSource.indexOf('async function restoreProject'));
  assert.match(restore.slice(0, 300), /dismissWallLockNotice\(\)/);
});
