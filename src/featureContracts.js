/**
 * GOVERNANCE katmanı. Otomatik depo/duvar/alınlık/mobilya planner’ları (`autoDepot.js`, `autoFascia.js`,
 * `automaticWall.js`, `autoFurniture.js`) bu registry’yi runtime’da okumaz; testler planner
 * çıktısını sözleşmeyle karşılaştırır.
 */
export const FEATURE_CONTRACTS = Object.freeze({
  automaticDepot: Object.freeze({
    id: 'automatic-depot',
    kind: 'scene-composition',
    owner: 'src/autoDepot.js',
    trigger: Object.freeze({
      mode: 'explicit-stage-option',
      contentToggle: 'includeContents',
    }),
    inputs: Object.freeze([
      'standType',
      'standXCm',
      'standYCm',
      'sizeKey',
      'includeContents',
    ]),
    creates: Object.freeze({
      structuralKinds: Object.freeze(['wall', 'door']),
      contentKinds: Object.freeze(['mini-fridge', 'kettle', 'coat-rack', 'plastic-trash-bin']),
      contentCatalogKeys: Object.freeze([
        'mini_fridge_avanti',
        'kettle',
        'coat_rack',
        'plastic_trash_bin',
      ]),
    }),
    placement: Object.freeze({
      owner: 'src/autoDepot.js',
      rule: 'planned-inside-stand-and-depot-footprint-without-floor-fixture-overlap',
    }),
    persistence: Object.freeze({
      mode: 'generated-modules-enter-project-state',
    }),
    tests: Object.freeze({
      contract: 'required',
      regressionFiles: Object.freeze(['test/autoDepot.test.js', 'test/plasticTrashBinModule.test.js']),
      fullSuite: 'required',
      build: 'required',
    }),
  }),
  automaticFascia: Object.freeze({
    id: 'automatic-fascia',
    kind: 'scene-composition',
    owner: 'src/autoFascia.js',
    trigger: Object.freeze({
      mode: 'explicit-stage-option',
      rowsOption: 'rows',
    }),
    inputs: Object.freeze([
      'standType',
      'standXCm',
      'standYCm',
      'rows',
    ]),
    creates: Object.freeze({
      structuralKinds: Object.freeze(['flat-panel', 'upright']),
      panelVariants: Object.freeze(['wall-short-1', 'wall-short-2']),
    }),
    placement: Object.freeze({
      owner: 'src/autoFascia.js',
      rule: 'open-stand-edges-top-strip-with-uprights-at-fully-open-corners',
    }),
    persistence: Object.freeze({
      mode: 'generated-modules-enter-project-state',
    }),
    tests: Object.freeze({
      contract: 'required',
      regressionFiles: Object.freeze(['test/autoFascia.test.js']),
      fullSuite: 'required',
      build: 'required',
    }),
  }),
  automaticFurniture: Object.freeze({
    id: 'automatic-furniture',
    kind: 'scene-composition',
    owner: 'src/autoFurniture.js',
    trigger: Object.freeze({
      mode: 'explicit-stage-option',
      defaultEnabled: true,
    }),
    inputs: Object.freeze([
      'standXCm',
      'standYCm',
      'depot',
    ]),
    creates: Object.freeze({
      furnitureCatalogKeys: Object.freeze([
        'desk_banko_100',
        'furniture_bar_stool_classic',
        'furniture_table_chair_set_eames',
        'brochure_stand',
        'extra_indoor_plant_1',
      ]),
    }),
    placement: Object.freeze({
      owner: 'src/autoFurniture.js',
      rule: 'front-row-facing-aisle-inside-stand-without-depot-or-furniture-overlap-skip-when-no-fit',
    }),
    persistence: Object.freeze({
      mode: 'generated-modules-enter-project-state',
    }),
    tests: Object.freeze({
      contract: 'required',
      regressionFiles: Object.freeze(['test/autoFurniture.test.js']),
      fullSuite: 'required',
      build: 'required',
    }),
  }),
  automaticWall: Object.freeze({
    id: 'automatic-wall',
    kind: 'scene-composition',
    owner: 'src/automaticWall.js',
    trigger: Object.freeze({
      mode: 'non-island-stage-create',
    }),
    inputs: Object.freeze([
      'wallWidthCm',
      'standType',
      'standXCm',
      'standYCm',
    ]),
    creates: Object.freeze({
      structuralKinds: Object.freeze(['flat-panel']),
      lightingKinds: Object.freeze(['led-floodlight']),
    }),
    placement: Object.freeze({
      owner: 'src/wallReflow.js',
      rule: 'planContinuousWallLayout',
    }),
    persistence: Object.freeze({
      mode: 'generated-modules-enter-project-state',
    }),
    tests: Object.freeze({
      contract: 'required',
      regressionFiles: Object.freeze(['test/automaticWall.test.js']),
      fullSuite: 'required',
      build: 'required',
    }),
  }),
  floorArea: Object.freeze({
    id: 'floor-area',
    kind: 'scene-composition',
    owner: 'src/floorArea.js',
    trigger: Object.freeze({
      mode: 'explicit-stand-floor-area',
    }),
    inputs: Object.freeze([
      'stand.itemKey',
      'stand.xCm',
      'stand.yCm',
      'floorArea',
    ]),
    creates: Object.freeze({
      structuralKinds: Object.freeze([]),
    }),
    placement: Object.freeze({
      owner: 'src/floorArea.js',
      rule: 'one-rectangle-inside-stand-on-stand-dimension-step',
    }),
    persistence: Object.freeze({
      mode: 'optional-stand-floor-area-beside-itemKey',
    }),
    tests: Object.freeze({
      contract: 'required',
      regressionFiles: Object.freeze(['test/floorArea.test.js', 'test/projectBom.test.js']),
      fullSuite: 'required',
      build: 'required',
    }),
  }),
  moduleGroup: Object.freeze({
    id: 'module-group',
    kind: 'scene-composition',
    owner: 'src/moduleGroups.js',
    trigger: Object.freeze({
      mode: 'explicit-shift-selection-context-menu',
    }),
    inputs: Object.freeze([
      'moduleIds',
      'group.name',
      'standType',
      'standXCm',
      'standYCm',
    ]),
    // Grup yeni öğe üretmez; mevcut öğeleri isimli bir kümede birleştirir. Grup çoğaltma
    // üyeleri tek öğe çoğaltmasıyla (designState.duplicateModuleState) kopyalar.
    creates: Object.freeze({
      structuralKinds: Object.freeze([]),
    }),
    placement: Object.freeze({
      owner: 'src/moduleGroups.js',
      rule: 'same-offset-for-every-member-inside-active-stand-edge-members-detached-to-free',
    }),
    persistence: Object.freeze({
      mode: 'group-id-name-lock-on-each-member-module',
    }),
    tests: Object.freeze({
      contract: 'required',
      regressionFiles: Object.freeze(['test/moduleGroups.test.js', 'test/moduleGroupPanel.test.js']),
      fullSuite: 'required',
      build: 'required',
    }),
  }),
});

export function getFeatureContract(featureId) {
  return Object.values(FEATURE_CONTRACTS).find((contract) => contract.id === featureId) ?? null;
}
