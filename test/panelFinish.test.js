import test from 'node:test';
import assert from 'node:assert/strict';

import { createModuleStateFromCatalogKey } from '../src/designState.js';
import { classifyPanelSurface } from '../src/panelAssignmentBom.js';
import {
  PANEL_FINISH_DEFAULT,
  effectivePanelFinish,
  isKnownPanelFinish,
  listPanelFinishes,
  normalizePanelFinish,
  panelFinishAppearance,
} from '../src/panelFinish.js';
import { resolveProjectBom } from '../src/projectBom.js';
import { validateImportedStandState } from '../src/projectImportValidation.js';

// Panel tipi (kullanıcı kararı 2026-11-18; 0100_panel_finishes).
test('tipler katalogdaki panel-finish Item\'larıdır; Varsayılan önce, renk ve meşe dokusu Item\'dan', () => {
  assert.deepEqual(listPanelFinishes().map((item) => item.name), ['Varsayılan', 'Antrasit', 'Meşe', 'Siyah']);
  const antrasit = panelFinishAppearance('panel_finish_antrasit');
  assert.equal(antrasit.colorCss, '#383e42'); // RAL 7016
  assert.equal(antrasit.isDefault, false);
  assert.equal(panelFinishAppearance('panel_finish_siyah').colorCss, '#1c1c1e');
  const mese = panelFinishAppearance('panel_finish_mese', '/base/');
  assert.equal(mese.textureUrl, '/base/textures/panel/mese.jpg');
  assert.deepEqual([mese.tileWidthCm, mese.tileHeightCm], [141, 100]);
  const fallback = panelFinishAppearance(PANEL_FINISH_DEFAULT);
  assert.equal(fallback.isDefault, true);
  assert.equal(fallback.colorCss, null);
});

test('bilinmeyen ya da silinmiş tip Varsayılan\'a düşer; içe aktarım yalnız metin olmayanı reddeder', () => {
  assert.equal(normalizePanelFinish(undefined), PANEL_FINISH_DEFAULT);
  assert.equal(normalizePanelFinish('panel_finish_yok'), PANEL_FINISH_DEFAULT);
  assert.equal(normalizePanelFinish('wall_100_350'), PANEL_FINISH_DEFAULT);
  assert.equal(isKnownPanelFinish('panel_finish_mese'), true);
  const stand = { standType: 'back-wall', xCm: 500, yCm: 400, itemKey: 'karolaj' };
  assert.equal(validateImportedStandState({ ...stand, panelFinish: 'panel_finish_yok' }).ok, true);
  assert.equal(validateImportedStandState({ ...stand, panelFinish: 7 }).ok, false);
});

test('panele atanan tip stand tipinin önündedir', () => {
  const stand = { panelFinish: 'panel_finish_antrasit' };
  assert.equal(effectivePanelFinish({}, stand), 'panel_finish_antrasit');
  assert.equal(effectivePanelFinish({ panelFinish: 'panel_finish_mese' }, stand), 'panel_finish_mese');
  assert.equal(effectivePanelFinish({}, null), PANEL_FINISH_DEFAULT);
  // Panele atanan Varsayılan da stand tipinin önündedir: stand meşe olsa da panel beyaz kalır (2026-11-20).
  assert.equal(effectivePanelFinish({ panelFinish: PANEL_FINISH_DEFAULT }, { panelFinish: 'panel_finish_mese' }), PANEL_FINISH_DEFAULT);
  const panel = { id: 's1', itemKey: 'panel_98', color: '#ffffff', panelFinish: PANEL_FINISH_DEFAULT };
  assert.equal(classifyPanelSurface(panel, null, { panelFinish: 'panel_finish_mese' }).group, 'default');
});

test('döküm: varsayılan paneller tip grubuna geçer; görsel, renk, cam ve kaldırılmış panel tipten etkilenmez', () => {
  const stand = { panelFinish: 'panel_finish_antrasit' };
  const panel = { id: 's1', itemKey: 'panel_98', color: '#ffffff' };
  assert.equal(classifyPanelSurface(panel, null, null).group, 'default');
  const finished = classifyPanelSurface(panel, null, stand);
  assert.equal(finished.group, 'finish');
  assert.equal(finished.finishName, 'Antrasit');
  assert.equal(classifyPanelSurface({ ...panel, imageAssetId: 'a1' }, null, stand).group, 'image');
  assert.equal(classifyPanelSurface({ ...panel, color: '#c0392b' }, null, stand).group, 'color');
  assert.equal(classifyPanelSurface({ ...panel, isGlass: true }, null, stand), null);
  assert.equal(classifyPanelSurface({ ...panel, removed: true }, null, stand), null);
  assert.equal(classifyPanelSurface({ ...panel, panelFinish: 'panel_finish_mese' }, null, stand).finishName, 'Meşe');
});

test('ürün değildir: Üretim Listesi kalemleri tipten bağımsız, döküm tip adıyla', () => {
  const wall = createModuleStateFromCatalogKey('wall_100_350');
  wall.id = 'w1';
  wall.placement = { xCm: 0, yCm: 0, zCm: 0, rotationZDeg: 0, wallId: 'free' };
  const stand = { standType: 'back-wall', xCm: 500, yCm: 400, itemKey: 'karolaj' };
  const plain = resolveProjectBom([wall], stand);
  const finished = resolveProjectBom([wall], { ...stand, panelFinish: 'panel_finish_mese' });
  const lines = (bom) => bom.lines.map((line) => `${line.itemKey}:${line.quantity}`).sort();
  assert.deepEqual(lines(finished), lines(plain));
  const group = finished.panelAssignments.groups.find((entry) => entry.id === 'finish');
  assert.equal(group.total, plain.panelAssignments.groups.find((entry) => entry.id === 'default').total);
  assert.ok(group.rows.every((row) => row.finishName === 'Meşe'));
});

test('yüklenen doku Stand API\'sinden, depodaki hazır doku uygulama dosyasından okunur', async () => {
  const { panelTextureUrl } = await import('../src/panelFinish.js');
  assert.equal(panelTextureUrl('uploads/textures/abc.jpg', '/base/'), '/api/v1/fair-stand/textures/abc.jpg');
  assert.equal(panelTextureUrl('textures/panel/mese.jpg', '/base/'), '/base/textures/panel/mese.jpg');
});
