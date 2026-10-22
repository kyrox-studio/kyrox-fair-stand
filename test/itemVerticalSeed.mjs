// backend item_vertical_seed.py ile aynı kural (migration 0076).
const VERTICAL_MOVE_TYPES = new Set(['tv', 'illuminated-foam', 'tulle-fabric', 'shelf', 'box-block', 'led-floodlight', 'profile']);
const WALL_SHORT_VARIANTS = new Set(['wall-short-1', 'wall-short-2']);

export function verticalFieldsFor(type, variant) {
  const wallShort = type === 'flat-panel' && WALL_SHORT_VARIANTS.has(variant);
  return {
    verticalMove: VERTICAL_MOVE_TYPES.has(type) || wallShort,
    zReference: type === 'profile' || wallShort ? 'wall-top' : 'floor',
  };
}

export function applyItemVerticalFields(item) {
  Object.assign(item, verticalFieldsFor(item.type, item.variant));
  return item;
}
