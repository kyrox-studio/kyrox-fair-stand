# Public modeller — köken / atıf envanteri

Kaynak: `public/models/` dizin listesi + DB `fair_stand_item_assets` (`asset_role = 'model'`, `relative_path`; seed `catalog_seed_data.py`). Lisans metni uydurulmaz. Listedeki 13 GLB'nin hepsi bir Item'a bağlıdır.

## Atıf dosyası olanlar

| Dosya | Atıf |
|---|---|
| `coat_rack.glb` | `COAT_RACK_ATTRIBUTION.txt` — martn00, Sketchfab, CC BY 4.0 |
| `kettle.glb` | `KETTLE_ATTRIBUTION.txt` — simalmaili, Sketchfab, CC BY 4.0 |
| `eames_chair.glb` | `EAMES_CHAIR_ATTRIBUTION.txt` — valeduque_portfolio, Sketchfab, CC BY 4.0 |
| `bar_chair.glb` | `BAR_STOOL_ATTRIBUTION.txt` — Ivar Kramer, Sketchfab, CC BY 4.0 |

## Atıf dosyası olmayan aktif GLB

Bu satırlar lisans kararı değildir; depoda bitişik `.txt` yoktur.

- `80s_avanti_mini_fridge.glb`
- `plastic_trash_bin.glb`
- `indoor_plants.glb`
- `saksi_bitkili_100x30x30.glb`
- `saksi_bitkili_150x30x30.glb`
- `saksi_bitkili_200x30x30.glb`
- `wall_separator_50_sarmasik.glb`
- `wall_separator_100_sarmasik.glb`
- `bej_koltuk_1_ciftli_2_tekli.glb`

F-034: envanter bu dosyadır. Yukarıdaki dokuz GLB’nin lisansı unknown kalır. Durum `ACCEPTED_RISK` — `audit/remediation/A13_F034_CLOSURE.md`. Bu tur metadata tamamlamaz. Yeni asset için “lisans metni uydurulmaz” kuralı durur.
