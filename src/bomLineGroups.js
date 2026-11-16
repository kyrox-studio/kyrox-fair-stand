import { getItem } from './items.js';

/**
 * Coarse production-list buckets. Unknown item types fall through to Extra.
 * Labels are a first pass so the combined leaf total can be reviewed.
 */
const BOM_LINE_GROUPS = Object.freeze([
  Object.freeze({ id: 'upright', label: 'Dikmeler', types: Object.freeze(['upright']) }),
  Object.freeze({ id: 'profile', label: 'Profiller', types: Object.freeze(['profile']) }),
  Object.freeze({ id: 'panel', label: 'Paneller', types: Object.freeze(['panel', 'panel-glass']) }),
  Object.freeze({ id: 'separator-panel', label: 'Separatör panelleri', types: Object.freeze(['separator-panel']) }),
  Object.freeze({ id: 'connector', label: 'Aparatlar', types: Object.freeze(['connector']) }),
  Object.freeze({ id: 'door', label: 'Kapı', types: Object.freeze(['door-leaf', 'door']) }),
  Object.freeze({ id: 'shelf', label: 'Raflar', types: Object.freeze(['shelf', 'shelf-accessory']) }),
  Object.freeze({ id: 'showcase', label: 'Vitrin', types: Object.freeze(['showcase-board', 'showcase-accessory']) }),
  Object.freeze({ id: 'tops', label: 'Üst tablalar', types: Object.freeze(['counter-top', 'base-top']) }),
  Object.freeze({ id: 'floor', label: 'Zemin', types: Object.freeze(['floor', 'floor-piece']) }),
  Object.freeze({ id: 'production', label: 'Üretim', types: Object.freeze(['production', 'illuminated-foam', 'tulle-fabric']) }),
  Object.freeze({ id: 'lamp', label: 'Lamba', types: Object.freeze(['led-floodlight']) }),
  Object.freeze({ id: 'tv', label: 'TV', types: Object.freeze(['tv']) }),
]);

const TYPE_TO_GROUP = new Map(
  BOM_LINE_GROUPS.flatMap((group) => group.types.map((type) => [type, group.id])),
);

export function groupBomLines(lines = []) {
  const buckets = new Map(BOM_LINE_GROUPS.map((group) => [group.id, []]));
  const extra = [];

  for (const line of lines) {
    const type = getItem(line?.itemKey)?.type ?? null;
    const groupId = TYPE_TO_GROUP.get(type);
    if (groupId) buckets.get(groupId).push(line);
    else extra.push(line);
  }

  const groups = BOM_LINE_GROUPS
    .map((group) => ({ id: group.id, label: group.label, lines: buckets.get(group.id) }))
    .filter((group) => group.lines.length);
  if (extra.length) groups.push({ id: 'extra', label: 'Extra', lines: extra });
  return groups;
}
