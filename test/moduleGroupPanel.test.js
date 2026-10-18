import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MODULE_GROUP_PANEL_EMPTY_TEXT, createModuleGroupPanel } from '../src/moduleGroupPanel.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mainSource = read('../src/main.js');
const menuSource = read('../src/moduleContextMenu.js');
const sceneSource = read('../src/scene3d.js');
const indexHtml = read('../index.html');
const markupSource = read('../src/configuratorMarkup.js');

// Render için yeterli küçük sahte DOM.
function fakeElement(tagName) {
  return {
    tagName,
    children: [],
    dataset: {},
    classes: new Set(),
    attributes: {},
    textContent: '',
    disabled: false,
    hidden: false,
    open: false,
    title: '',
    type: '',
    get className() { return [...this.classes].join(' '); },
    set className(value) { this.classes = new Set(String(value).split(/\s+/).filter(Boolean)); },
    classList: null,
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener() {},
  };
}

function createFakeDocument() {
  return {
    createElement(tagName) {
      const element = fakeElement(tagName);
      element.classList = { add: (name) => element.classes.add(name) };
      return element;
    },
  };
}

function findAll(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  (node.children ?? []).forEach((child) => findAll(child, predicate, found));
  return found;
}

const document = createFakeDocument();

test('panel shows the empty hint when there are no groups', () => {
  const list = document.createElement('div');
  const empty = document.createElement('p');
  const panel = createModuleGroupPanel({ list, empty, document });
  panel.render([{ id: 'a' }]);
  assert.equal(list.children.length, 0);
  assert.equal(empty.hidden, false);
  assert.equal(empty.textContent, MODULE_GROUP_PANEL_EMPTY_TEXT);
});

test('panel lists each group with member count, lock state and member rows', () => {
  const list = document.createElement('div');
  const empty = document.createElement('p');
  const panel = createModuleGroupPanel({
    list,
    empty,
    document,
    describeModule: (moduleState) => `Parça ${moduleState.id}`,
  });
  panel.render([
    { id: 'a', group: { id: 'g1', name: 'Sağ duvar', locked: true } },
    { id: 'b', group: { id: 'g1', name: 'Sağ duvar', locked: true } },
    { id: 'c' },
    { id: 'd', group: { id: 'g2', name: 'Masa', locked: false } },
    { id: 'e', group: { id: 'g2', name: 'Masa', locked: false } },
  ]);
  assert.equal(empty.hidden, true);
  assert.equal(list.children.length, 2);
  const [first, second] = list.children;
  assert.equal(first.dataset.groupId, 'g1');
  const meta = findAll(first, (node) => node.classes?.has('module-group-meta'))[0];
  assert.equal(meta.textContent, '2 parça · Kilitli');
  const members = findAll(first, (node) => node.dataset?.groupAction === 'group-select-member');
  assert.deepEqual(members.map((node) => node.textContent), ['Parça a', 'Parça b']);
  // Kilitli grupta çöz, sil ve çıkar pasiftir.
  const disabled = findAll(first, (node) => node.disabled).map((node) => node.dataset.groupAction);
  assert.deepEqual(disabled.sort(), ['group-delete', 'group-dissolve', 'group-remove-member', 'group-remove-member']);
  const secondLock = findAll(second, (node) => node.dataset?.groupAction === 'group-lock')[0];
  assert.equal(secondLock.textContent, 'Kilitle');
});

test('Gruplar card exists in both markups', () => {
  for (const source of [indexHtml, markupSource]) {
    assert.match(source, /id=\\?"module-groups-card\\?"/);
    assert.match(source, /id=\\?"module-groups-list\\?"/);
    assert.match(source, /id=\\?"module-groups-empty\\?"/);
  }
});

test('context menu offers group commands and forwards them to main', () => {
  for (const action of ['group-create', 'group-add', 'group-rename', 'group-lock', 'group-duplicate', 'group-remove-member', 'group-dissolve', 'group-delete']) {
    assert.match(menuSource, new RegExp(`data-module-action="${action}"`));
  }
  assert.match(menuSource, /if \(action\.startsWith\('group-'\)\) \{\n {6}close\(\);\n {6}onGroupAction\?\.\(action, context\);/);
  assert.match(menuSource, /setDisabled\(lockButton, group\?\.locked === true && context\.ownLocked !== true, GROUP_LOCKED_HINT\);/);
});

test('main wires group actions, confirms delete and moving between groups', () => {
  assert.match(mainSource, /onGroupAction: \(action, context\) => handleGroupAction\(action, \{/);
  assert.match(mainSource, /grubunun tamamı silinecek/);
  assert.match(mainSource, /grubuna eklensin mi\?/);
  assert.match(mainSource, /planGroupDuplicate\(currentModules, group\.id, stand, \{ duplicateModule: duplicateModuleState \}\)/);
  assert.match(mainSource, /pruneGroups\(currentModules, getGroupStand\(\)\);\n {2}scene3d\.buildWall\(currentModules, \{ resetView \}\);/);
  // Kilitli grubun üyesi öğe kilidinden açılamaz.
  assert.match(mainSource, /getModuleGroup\(byId\.get\(id\)\)\?\.locked === true/);
});

test('scene moves the whole group on drag and arrows, and refuses Shift+R for members', () => {
  assert.match(sceneSource, /groupId: getModuleGroupId\(moduleState\),/);
  assert.match(sceneSource, /if \(dragSession\.groupId\) \{\n {6}updateGroupDrag\(event\);/);
  assert.match(sceneSource, /if \(dragSession\.groupId\) return finishGroupDrag\(dragSession, event\);/);
  assert.match(sceneSource, /moveGroupByArrow\(moduleGroup, moduleState, arrowScreenDirection\);/);
  // Faz 4: Shift+R on a group member rotates the whole group by 45 degrees.
  assert.match(sceneSource, /const groupDeltaDeg = Number\(deltaDeg\) < 0 \? -GROUP_ROTATE_STEP_DEG : GROUP_ROTATE_STEP_DEG;/);
  assert.match(sceneSource, /const plan = planRenderedGroupRotate\(getModuleGroupId\(moduleState\), groupDeltaDeg\);/);
  assert.doesNotMatch(sceneSource, /GROUP_ROTATE_MESSAGE/);
});

test('multi-selection and group member frames use Kyrox copper; single selection stays blue', () => {
  assert.match(sceneSource, /const SELECTION_COLOR = 0x2563eb;/);
  assert.match(sceneSource, /const GROUP_SELECTION_COLOR = 0xc47a3a;/);
  assert.match(sceneSource, /next\.forEach\(\(moduleId\) => setModuleSelectionVisual\(moduleId, true, GROUP_SELECTION_COLOR\)\);/);
  assert.match(sceneSource, /multiSelectedModuleIds\.forEach\(\(id\) => setModuleSelectionVisual\(id, true, GROUP_SELECTION_COLOR\)\);/);
  assert.match(sceneSource, /selectedModuleId = moduleId \?\? null;\n {4}setModuleSelectionVisual\(selectedModuleId, true\);/);
  // Modül seçim çerçevesi panel seçimi gibi hemen yeniden çizilmeli.
  assert.match(sceneSource, /frame\.visible = Boolean\(selected\);\n {4}\/\/ Shift\+tık yalnız bunu günceller[\s\S]*?requestEditorRender\(\);/);
});

test('multi-selection context menu survives a right-click that misses a selected module', () => {
  // ≥2 toplu seçimde sağ tık selectOnly çağırmaz; menü seçimdeki bütün öğelere açılır.
  assert.match(sceneSource, /if \(multiSelectedModuleIds\.size < 2\n {6}&& context\.surfaceId\n {6}&& !multiSelectedModuleIds\.has\(context\.moduleId\)\) \{/);
  assert.match(mainSource, /\/\/ Toplu seçim varken menü her zaman bütün seçime uygulanır/);
  assert.match(mainSource, /if \(selectedIds\.length > 1\) \{\n {4}moduleContextMenu\.open\(\{/);
  assert.doesNotMatch(mainSource, /selectedIds\.length > 1 && selectedIds\.includes\(context\.moduleId\)/);
});
