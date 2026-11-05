# Module Behavior Standard

`src/moduleBehavior.js` resolves editor behavior that differs by module type from catalog `itemTypes` (DB bootstrap). Sahne Z rotation parameters live on Item (`docs/refactor/ROTATION.md`); tip davranışı rotation taşımaz (`rotationStepDeg` / `defaultRotationDeg` / `sideInsertRotation`).

Every new module must use this contract instead of adding scattered type checks for placement behavior.

## Behavior record

The behavior contract currently covers:

- `placement`: `wall`, `free`, `wall-overlay`, or `top`
- `moveSnapCm`: movement/grid step in centimetres
- `allowSideInsert`: whether context left/right insertion is allowed
- `collision`: declared collision contract
- `magneticSnap`: normal module-to-module magnetic snap or an explicit opt-out
- `connectionEndpoint`: standard segment endpoints or a logical fixture endpoint strategy
- `collisionDepth`: physical depth or a declared logical wall-backbone depth
- `endpointContact`: standard contact or a declared thin-wall endpoint exception
- `boundarySnap`: normal stand-edge snap or a declared wall-inner-face boundary strategy
- `overlapWithTypes`: explicit relationship-specific overlap exceptions
- `supportsWallOverlayMount`: whether the module can act as a free-standing wall-overlay support
- `wallCapacity`: whether the module consumes wall-chain capacity
- `ghost`: placement preview strategy

These values are **not global constants**. Different module types may intentionally use different snap distances, placement modes, collision strategies, connection strategies, or support capabilities. Rotation step/default/side-insert are Item columns, not type-table fields.

Policy selection belongs here; the geometric algorithms implementing those strategies remain in the placement/core layer.

## Explicit catalog behavior contract

Every module type in the catalog (`listCatalogItems()` → `getItem(itemKey).type`) must have a scene behavior row (`fair_stand_item_type_scene_behavior`, bootstrap `itemTypes[]`), even when that type intentionally uses the standard wall behavior.

`hasExplicitModuleBehavior()` returns true when the type is in `KNOWN_BEHAVIOR_TYPE_KEYS` or its bootstrap `itemTypes` row carries `placement`. `test/moduleBehaviorContract.test.js` compares all unique catalog module types against this contract, so adding a new catalog type without a behavior row fails CI.

This prevents a newly added catalog type from silently inheriting fallback behavior by accident.

## Defaults

A type that is unknown to the bootstrap and not in `KNOWN_BEHAVIOR_TYPE_KEYS` falls back to the default behavior defined in `src/moduleBehavior.js`. A registered type without a scene behavior row, or a known type whose bootstrap fields are missing, throws (fail-fast).

The current default behavior is wall placement with the default movement/collision/connection contract declared in code. Documentation should not duplicate those numeric defaults as a separate source of truth. Leaf Item rotation columns stay null; placeable rows must carry the trio.

Fallback remains useful as a defensive runtime behavior, but catalog entries must not depend on it implicitly.

## Ghost contract

Every module has a ghost definition. Missing/unknown module types currently receive the central silhouette ghost:

```js
{
  kind: 'silhouette',
  renderer: 'module-silhouette',
  opacity: 0.38,
}
```

For modules that need a specific real-model or custom preview, declare the behavior on the CRM **Item Type** (`fair_stand_item_type_scene_behavior` / bootstrap `itemTypes`) rather than introducing a new module-type decision elsewhere.

`scene3d.js` must route ghost creation through `getModuleGhostBehavior()` and the declared renderer strategy.

Catalog drag ve sahnedeki taşıma sırasında pointer için bir placement pozisyonu varsa ghost görünür. Geçerli konum yeşil, geçersiz konum kırmızıdır. Ghost yalnız pozisyon yokken gizlenir: stand yok, zemin/duvar noktası yok veya sürükleme bitti. `short-up-joint` kaçırılması (ör. `upright_346_5`) bırakmayı reddeder ama kırmızı ghost'u kapatmaz.

## Placement contract

Placement mode expresses editor intent:

- `wall` — normal wall/segment placement
- `free` — free floor/fixture placement inside stand boundaries
- `wall-overlay` — wall-mounted overlay/accessory behavior that does not consume the normal wall chain like a structural wall module
- `top` — top-mounted accessory behavior

Exact geometric validation remains the responsibility of the placement/core layer.

Module-specific selection of special geometry must be represented by a named behavior strategy. For example, logical fixture endpoints, wall-backbone collision depth, wall-inner-face snapping and relationship-specific overlap are declared here; `modulePlacement.js` implements the geometry without owning a second module-type registry.

## Collision contract

Behavior records preserve each module's declared collision value, while placement core consumes the canonical effective strategy through `getModuleCollisionStrategy()`. Compatibility-specific resolution therefore also belongs to `src/moduleBehavior.js`; placement code must not maintain a second module-type collision registry.

Current strategies include contracts such as:

- `segment`
- `footprint`
- `none`

Relationship-specific overlap belongs in `overlapWithTypes`. This keeps exceptions such as raised fixture stacking declarative without moving their geometric implementation out of placement core.

Do not duplicate module-specific collision decisions in unrelated editor/controller code when they can be expressed through this registry.

## Rotation and snap contract

Sahne Z: Item `rotationStepDeg` / `defaultRotationDeg` / `sideInsertRotation` via `getItem(itemKey)`. Canonical: `docs/refactor/ROTATION.md`. Missing `itemKey` or null trio on a placeable module is fail-fast. There is no type fallback and no `STRAIGHT_COUNTER_WIDTHS_CM` / L-shape rotation override.

Do not assume all modules rotate in 90° steps or move on a 50 cm grid.

Call the helpers instead of hard-coding module-specific values:

- `getModuleRotationStepDeg()`
- `getModuleDefaultRotationDeg()`
- `getModuleMoveSnapCm()`
- `getModuleBehavior()` (placement/snap/collision; not rotation fields)

## New module checklist

When adding a new module:

1. Add its catalog entry when applicable.
2. Give its type a scene behavior row on the CRM **Item Type** (`fair_stand_item_type_scene_behavior`), even if it intentionally uses the standard wall behavior.
3. Express special placement/interaction selection with a named strategy/capability in the behavior contract instead of adding a type list to placement, scene, or controller code.
4. Keep the geometric implementation in the placement/core layer.
5. Add a regression test for any non-default placement, snap, rotation, collision, connection, overlap, support, capacity, or ghost behavior.
6. Keep renderer, state, catalog and BOM responsibilities separate from editor behavior.
7. Run `npm test` and `npm run build`.
