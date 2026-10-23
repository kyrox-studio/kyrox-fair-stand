import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { listCatalogPreviewIds, getCatalogItem, listCatalogItems } from '../src/catalog.js';
import { getItem, listRegisteredItems } from '../src/items.js';
import { createModuleCatalogPreview } from '../src/moduleDragSidebar.js';

const SIDEBAR_SOURCE = readFileSync(new URL('../src/moduleDragSidebar.js', import.meta.url), 'utf8');
const CONTEXT_SOURCE = readFileSync(new URL('../src/moduleContextMenu.js', import.meta.url), 'utf8');
const CATALOG_SOURCE = readFileSync(new URL('../src/catalog.js', import.meta.url), 'utf8');

const PREVIEW_FN = SIDEBAR_SOURCE.slice(
  SIDEBAR_SOURCE.indexOf('export function createModuleCatalogPreview'),
  SIDEBAR_SOURCE.indexOf('export function createModuleDragSidebar'),
);

const ROOT_CLASS_BY_PREVIEW = Object.freeze({
  20: 'module-drag-shelf',
  23: 'module-drag-sofa',
  24: 'module-drag-sofa-single',
  22: 'module-drag-sofa-double',
  6: 'module-drag-coffee-table',
  25: 'module-drag-table-chair',
  4: 'module-drag-eames-chair',
  11: 'module-drag-glass-table',
  1: 'module-drag-bar-stool',
  15: 'module-drag-mini-fridge',
  5: 'module-drag-coat-rack',
  16: 'module-drag-trash-bin',
  14: 'module-drag-long-planter',
  12: 'module-drag-plant module-drag-plant-1',
  13: 'module-drag-kettle',
  26: 'module-drag-tv',
  28: 'module-drag-tv is-video-wall',
  10: 'module-drag-floodlight',
  27: 'module-drag-upright',
  17: 'module-drag-profile',
  3: 'module-drag-base-wall',
  2: 'module-drag-base',
  7: 'module-drag-counter',
  18: 'module-drag-separator',
  19: 'module-drag-separator is-vine',
  8: 'module-drag-door',
  21: 'module-drag-showcase',
  9: 'module-drag-panel',
  29: 'module-drag-floor-showcase',
  30: 'module-drag-brochure-stand',
});

function installDocument() {
  function createElement(tagName) {
    const el = {
      tagName: String(tagName).toUpperCase(),
      className: '',
      style: {},
      dataset: {},
      childNodes: [],
      classList: {
        add(...names) {
          const parts = new Set(String(el.className).split(/\s+/).filter(Boolean));
          for (const name of names) parts.add(name);
          el.className = [...parts].join(' ');
        },
      },
      appendChild(child) {
        el.childNodes.push(child);
        return child;
      },
      append(...nodes) {
        nodes.forEach((node) => el.appendChild(node));
      },
    };
    el.ownerDocument = {
      createElement,
    };
    return el;
  }

  globalThis.document = {
    querySelector() { return {}; },
    createElement,
    head: { appendChild() {} },
  };
}

function serializeNode(node) {
  return {
    tag: node.tagName,
    className: node.className,
    style: { ...node.style },
    dataset: { ...node.dataset },
    children: node.childNodes.map(serializeNode),
  };
}

test('54 görünür Item catalogPreview taşır; gizli Item preview taşımaz', () => {
  const visible = listRegisteredItems().filter((item) => item.catalogVisible === true);
  const hidden = listRegisteredItems().filter((item) => item.catalogVisible !== true);
  assert.equal(visible.length, 54);
  assert.equal(hidden.length, 79);

  for (const item of visible) {
    assert.equal(typeof item.previewId, 'number', item.itemKey);
    assert.ok(listCatalogPreviewIds().includes(item.previewId), `${item.itemKey} ${item.previewId}`);
    assert.equal(getCatalogItem(item.itemKey).previewId, item.previewId, item.itemKey);
  }

  for (const item of hidden) {
    if (item.type === 'shelf') {
      assert.equal(item.previewId, 20, item.itemKey);
      assert.equal(getCatalogItem(item.itemKey), null);
      continue;
    }
    assert.equal(Object.hasOwn(item, 'previewId'), false, item.itemKey);
  }
});

test('Catalog preview renderer yalnız catalogPreview key ile seçilir; type branch yoktur', () => {
  assert.doesNotMatch(PREVIEW_FN, /module\.type/);
  assert.doesNotMatch(PREVIEW_FN, /item\.type/);
  assert.doesNotMatch(PREVIEW_FN, /switch\s*\(\s*type/);
  assert.doesNotMatch(PREVIEW_FN, /type\s*===/);
  assert.doesNotMatch(PREVIEW_FN, /type\.includes/);
  assert.doesNotMatch(PREVIEW_FN, /startsWith/);
  assert.match(PREVIEW_FN, /getCatalogPreview/);
  assert.doesNotMatch(PREVIEW_FN, /CATALOG_PREVIEW_RENDERERS/);
  assert.doesNotMatch(SIDEBAR_SOURCE, /if \(module\.type ===/);
  assert.doesNotMatch(SIDEBAR_SOURCE, /itemKey ===/);
  assert.doesNotMatch(SIDEBAR_SOURCE, /MODULE_CATALOG_GROUPS/);

  const pickerStart = CONTEXT_SOURCE.indexOf('function createPickerCard');
  const pickerEnd = CONTEXT_SOURCE.indexOf('function collapsePickerGroups');
  const picker = CONTEXT_SOURCE.slice(pickerStart, pickerEnd);
  assert.match(picker, /createModuleCatalogPreview\(module\)/);
  assert.doesNotMatch(picker, /module\.type/);
  assert.doesNotMatch(picker, /item\.type/);

  const rendererKeys = listCatalogPreviewIds().sort();
  assert.equal(rendererKeys.length, 30);
  assert.deepEqual(rendererKeys, [...listCatalogPreviewIds()].sort());
  assert.match(CATALOG_SOURCE, /previewId,/);
  assert.match(CATALOG_SOURCE, /is catalogVisible without previewId/);

  const catalogDoc = readFileSync(new URL('../docs/refactor/CATALOG.md', import.meta.url), 'utf8');
  assert.match(catalogDoc, /Catalog görünümü Item\.type üzerinden belirlenmez/);
  assert.match(catalogDoc, /Catalog preview renderer seçimi yalnız Item\.previewId üzerinden yapılır/);
});

test('54 Item catalogPreview dağılımı kilitlidir', () => {
  const counts = {};
  for (const item of listCatalogItems()) {
    counts[item.previewId] = (counts[item.previewId] ?? 0) + 1;
  }
  assert.deepEqual(counts, {
    1: 1,
    2: 3,
    4: 1,
    5: 1,
    6: 1,
    7: 6,
    8: 1,
    9: 8,
    10: 1,
    11: 2,
    12: 1,
    13: 1,
    14: 3,
    15: 1,
    16: 1,
    17: 1,
    18: 2,
    19: 2,
    21: 2,
    20: 3,
    22: 1,
    23: 1,
    24: 1,
    25: 1,
    26: 3,
    27: 1,
    28: 2,
    29: 1,
    30: 1,
  });
});

test('54 Catalog preview kök sınıfı önceki CSS silüetini korur', () => {
  installDocument();
  const projected = listCatalogItems();
  assert.equal(projected.length, 54);

  for (const module of projected) {
    const tree = serializeNode(createModuleCatalogPreview(module));
    assert.equal(tree.className, 'module-drag-preview', module.itemKey);
    const root = tree.children[0];
    assert.ok(root, module.itemKey);
    let expected = ROOT_CLASS_BY_PREVIEW[module.previewId];
    const item = getItem(module.itemKey);
    if (module.previewId === 9 && item.stripOccupancy?.align === 'top') {
      expected = 'module-drag-panel is-hanging-top';
    }
    if (module.previewId === 28 && Number(item.videoWall?.rows) === 3) {
      expected = 'module-drag-tv is-video-wall is-video-wall-3x3';
    }
    assert.equal(root.className, expected, module.itemKey);
  }

  const kettle = serializeNode(createModuleCatalogPreview(getCatalogItem('kettle')));
  assert.deepEqual(kettle.children[0].children.map((child) => child.className), [
    'module-drag-kettle-body',
    'module-drag-kettle-handle',
    'module-drag-kettle-spout',
    'module-drag-kettle-lid',
    'module-drag-kettle-knob',
  ]);

  const trash = serializeNode(createModuleCatalogPreview(getCatalogItem('plastic_trash_bin')));
  assert.deepEqual(trash.children[0].children.map((child) => child.className), [
    'module-drag-trash-bin-handle',
    'module-drag-trash-bin-lid',
    'module-drag-trash-bin-body',
  ]);

  const showcase3 = serializeNode(createModuleCatalogPreview(getCatalogItem('wall_showcase_100_3_350')));
  assert.equal(showcase3.children[0].dataset.eyes, '3');
  const showcase2 = serializeNode(createModuleCatalogPreview(getCatalogItem('wall_showcase_100_2_350')));
  assert.equal(showcase2.children[0].dataset.eyes, '2');

  const vine = serializeNode(createModuleCatalogPreview(getCatalogItem('wall_separator_100_350_sarmasik')));
  assert.match(vine.children[0].className, /is-vine/);
  const plain = serializeNode(createModuleCatalogPreview(getCatalogItem('wall_separator_100_350')));
  assert.doesNotMatch(plain.children[0].className, /is-vine/);

  const hanging = serializeNode(createModuleCatalogPreview(getCatalogItem('wall_100_short_2')));
  assert.match(hanging.children[0].className, /is-hanging-top/);
  assert.equal(hanging.children[0].children[0].className, 'module-drag-hanging-frame');

  const shelfPreview = serializeNode(createModuleCatalogPreview({ previewId: 20, widthCm: 100 }));
  assert.equal(shelfPreview.children[0].className, 'module-drag-shelf');
  assert.equal(shelfPreview.children[0].children.filter((child) => child.tag === 'I').length, 0);
  assert.equal(shelfPreview.children[0].children.filter((child) => child.tag === 'SPAN').length, 0);

  const empty = serializeNode(createModuleCatalogPreview({ itemKey: 'illuminated-foam' }));
  assert.equal(empty.children.length, 0);

  assert.throws(
    () => createModuleCatalogPreview({ itemKey: 'x', previewId: 999999 }),
    /Unknown previewId/,
  );

  assert.equal(getItem('wall_200_350').previewId, 9);
  assert.equal(getItem('kettle').previewId, 13);
  assert.equal(getItem('video_wall_2x2').previewId, 28);
  // Profil kartı tek (profile_289); boy penceresinden gelen profiller gizlidir, önizleme taşımaz.
  assert.equal(getItem('profile_289').previewId, 17);
  assert.equal(getItem('profile_190').previewId, undefined);
});
