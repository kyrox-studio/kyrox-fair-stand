# Arşiv — tarihsel Python yama betikleri

Bu klasör **aktif tooling değildir**. `package.json` ve CI bu dosyaları çalıştırmaz.

## İçerik

| Dosya | Durum |
| --- | --- |
| `add-tv-sizes.py` | F-045 tarihsel kaynak rewriter. Güncel `src/catalog.js` API’sine uymaz. |
| `add-video-wall-2x2.py` | Aynı sınıf. Video wall Item `src/items.js` üzerindedir. |
| `fix-tv-screen-face.py` | Aynı sınıf. |
| `scrub-legacy-dimensions-in-docs.py` | `docs/items/audit/` belgelerini yeniden yazıyordu. Audit klasörü 2026-10-27'de `kyrox-platform/archive/fair-stand/docs-items/` altına taşındı; hedefi artık Stand'de yok. |
| `refresh-item-ozellik-matrix-whd.py` | `docs/items/audit/ITEM_OZELLIK_MATRISI.tsv` dosyasını yeniliyordu. Aynı taşımayla hedefi kalktı. |

Karar: DECISION-07 ARCHIVE. Amaç: aktif `scripts/` bakım aracı gibi görünmesinler; git tree’de kaybolmasınlar; runtime/CI etkilenmesin.

**Çalıştırmayın.** Güncel katalog/Item değişikliği bu betiklerle yapılmaz.
