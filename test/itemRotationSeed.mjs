const PLACEABLE_ITEM_TYPES = new Set([
  'flat-panel',
  'base',
  'counter',
  'separator',
  'sofa-set-classic',
  'sofa-single-classic',
  'sofa-double-classic',
  'coffee-table-classic',
  'table-chair-set-eames',
  'chair',
  'table-glass',
  'bar-stool',
  'mini-fridge',
  'kettle',
  'coat-rack',
  'floor-showcase',
  'brochure-stand',
  'upright',
  'profile',
  'plastic-trash-bin',
  'box-block',
  'indoor-plant-1',
  'tv',
  'shelf',
  'led-floodlight',
  'door',
  'showcase-2',
  'showcase-3',
  'illuminated-foam',
  'tulle-fabric',
]);

const SPECIAL = Object.freeze({
  box_block: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 0, sideInsertRotation: 'inherit' }),
  desk_banko_100: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 0, sideInsertRotation: 'inherit' }),
  desk_banko_150: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 0, sideInsertRotation: 'inherit' }),
  desk_banko_200: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 0, sideInsertRotation: 'inherit' }),
  desk_banko_100_l: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 270, sideInsertRotation: 'inherit' }),
  desk_banko_150_l: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 270, sideInsertRotation: 'inherit' }),
  desk_banko_200_l: Object.freeze({ rotationStepDeg: 15, defaultRotationDeg: 270, sideInsertRotation: 'inherit' }),
  furniture_sofa_single_classic: Object.freeze({
    rotationStepDeg: 15,
    defaultRotationDeg: 0,
    sideInsertRotation: 'inherit',
  }),
  furniture_bar_stool_classic: Object.freeze({
    rotationStepDeg: 15,
    defaultRotationDeg: 270,
    sideInsertRotation: 'default',
  }),
});

const DEFAULT_PLACEABLE = Object.freeze({
  rotationStepDeg: 15,
  defaultRotationDeg: 0,
  sideInsertRotation: 'inherit',
});

export function rotationFieldsForItem(itemKey, itemType) {
  if (Object.hasOwn(SPECIAL, itemKey)) return SPECIAL[itemKey];
  if (PLACEABLE_ITEM_TYPES.has(itemType)) return DEFAULT_PLACEABLE;
  return null;
}

export function applyItemRotationFields(item) {
  const fields = rotationFieldsForItem(item.itemKey, item.type);
  if (!fields) return item;
  item.rotationStepDeg = fields.rotationStepDeg;
  item.defaultRotationDeg = fields.defaultRotationDeg;
  item.sideInsertRotation = fields.sideInsertRotation;
  return item;
}
