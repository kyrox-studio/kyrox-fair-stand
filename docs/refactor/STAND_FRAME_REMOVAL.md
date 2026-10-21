# Stand `frame_width_cm` / `frame_depth_cm`

**Durum (2026-10-21):** Sahne kesiti item-first: `resolveProceduralFrameCrossSectionCm` modül reçetesindeki ilk `profile` Item'ının sahne ölçüsünü (`depthCm` × `heightCm`) okur; panel duvarı, kapı ve vitrin çerçevesinin dört kenarı (dikmeler dahil) bu kesitle çizilir. Reçetesinde profil olmayan modülde kesit stand `frame_depth_cm` ile kare kutudur. Stand `frame_width_cm` sahnede okunmaz; kolon ve CRM alanı şimdilik durur.

**Önceki durum (2026-09-23):** Kolonlar **geri geldi** (`0023_restore_stand_frame_columns`). Prosedürel aluminyum kesiti `STAND_DIMENSIONS.frameWidthCm/DepthCm` ← DB. Seed varsayılan **5,5 × 10 cm**.

Leaf upright/profile BOM kesiti (örn. 8×8) ayrı kalır; sahne çerçevesi şimdilik stand zarfından okunur (`resolveProceduralFrameCrossSectionCm`).

## Neden geçici stand kaynağı

Leaf 8×8 sahnede kalın duruyordu. Kalıcı item-first hedef (leaf kesit = görünüm) ayrı iş; canlı 3D doğrulama oturana kadar stand `frame_*` tek görsel kaynak.

## Kaynak (runtime)

- Bootstrap / admin: `heightCm`, `depthCm`, `frameWidthCm`, `frameDepthCm`
- `src/standDimensions.js` + `getProceduralFrameCrossSectionM` → stand frame
- CRM Temel Ayarlar: çerçeve alanları düzenlenebilir

## Alembic

| Rev | İş |
|-----|-----|
| `0022_drop_stand_frame_columns` | Tarihsel drop |
| `0023_restore_stand_frame_columns` | `frame_width_cm` / `frame_depth_cm` geri (+ default 5.5 / 10) |
