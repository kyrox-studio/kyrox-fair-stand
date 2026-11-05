# Stand `frame_width_cm` / `frame_depth_cm`

## Sahne kesiti (kod)

`resolveProceduralFrameCrossSectionCm` (`src/items.js`) modül reçetesindeki ilk `profile` Item'ının sahne ölçüsünü okur: kesit = `depthCm` × `heightCm` (`crossSectionCmFromFrameItem`). Panel duvarı, kapı ve vitrin çerçevesinin dört kenarı (dikmeler dahil) bu kesitle çizilir (`getProceduralFrameCrossSectionM`, `src/scene3d.js`).

Reçetesinde profil olmayan modülde kesit kare kutudur: genişlik = derinlik = stand `frame_depth_cm`.

Stand `frame_width_cm` sahne kesitine girmez. Kolon, admin API (`PUT` Temel Ayarlar, `admin_settings.py`) ve bootstrap alanı (`frameWidthCm`) durur.

## Kaynak (runtime)

- Bootstrap / admin: `heightCm`, `depthCm`, `frameWidthCm`, `frameDepthCm`, `panelRailHeightCm`
- Seed varsayılanı (`stand_dimensions_seed.py`): `frame_width_cm` 5,5, `frame_depth_cm` 10
- CRM Temel Ayarlar: çerçeve alanları düzenlenebilir

## Alembic

| Rev | İş |
|-----|-----|
| `0022_drop_stand_frame_columns` | Tarihsel drop |
| `0023_restore_stand_frame_columns` | `frame_width_cm` / `frame_depth_cm` geri (+ default 5.5 / 10) |
