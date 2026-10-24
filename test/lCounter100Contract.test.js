import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getCatalogItem,
  listCatalogItems,
} from '../src/catalog.js';
import { createCounterModuleState } from '../src/designState.js';
import {
  getExpandedModuleRecipe,
} from './recipeParentItemKey.js';

// Köşe banko kartı tek (desk_banko_100_l, 0083); diğer ölçüler ölçü penceresinden gelir.
test('desk_banko_100_l catalog contract',()=>{const item=getCatalogItem('desk_banko_100_l');assert.equal(item.itemKey,'desk_banko_100_l');assert.equal(item.label,'Köşe Banko');assert.equal(item.previewId,7);assert.equal(Object.hasOwn(item,'type'),false);});
test('L counter editable state',()=>{const state=createCounterModuleState(100,{shape:'L',depthCm:100});assert.equal(state.type,'counter');assert.equal(state.itemKey,'desk_banko_100_l');assert.equal(state.shape,'L');assert.equal(state.depthCm,100);assert.equal(Object.keys(state.faces).length,8);Object.values(state.faces).forEach(face=>assert.ok('imageAssetId' in face));});
test('L counter BOM exact',()=>{const recipe=getExpandedModuleRecipe('counter',100,{shape:'L'});const q=Object.fromEntries(recipe.items.map(item=>[item.itemKey??item.partId,item.quantity]));assert.deepEqual(q,{profile_91:5,profile_41_5:5,upright_99:5,panel_98:4,panel_48_5:4,connector_start:8,connector_single:16,counter_top_110_60:1,counter_top_52_60:1});});
test('L counter renderer routing',()=>{const source=fs.readFileSync(new URL('../src/scene3d.js',import.meta.url),'utf8');assert.match(source,/moduleState\.shape === 'L'/);assert.match(source,/createLCounterModule/);assert.match(source,/counterShape:'L'/);});
