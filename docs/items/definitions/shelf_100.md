# shelf_100 — Item sözleşmesi

Kanonik ürün verisi ilişkisel Item store'undadır; bootstrap ile okunur. Bu belge ölçü değerlerinin ikinci kaynağı değildir.

- Kimlik: shelf_100; tip: shelf; birim: adet.
- Katalogda gizlidir. Tekli raf kartı shelf_row_1, hedef duvarın genişliğine göre bu ürüne çözülür.
- Reçete: shelf_100_self × 1 + shelf_leg × 2. Tekli raf artık self BOM değildir; gerçek terminal tahta ve ayaklar yazılır.
- 2/3 sıralı ürünler bu tekli rafı reçetede tekrarlar; duvar/panel üretmez.
- Çizici reçeteyi shelf_100_self tahtasına kadar izler. Tahta kalınlığı ve derinliği alan bazında sceneDimensions ?? dimensions ile okunur. Toplam sıralı yükseklik ayrı parent Item ölçüsüdür.
- Modül state'i gerçek ürün itemKey, type, ölçüler, shelfLightingOn ve overlay placement taşır. Başka duvara taşınırsa aile varyantı yeniden çözülür.
- Sağ tık aydınlatması bütün sıralardaki LED ve spotlara uygulanır.

Regresyon: test/shelfWidthVariantPlacement.test.js, test/shelfRowsRender.test.js, test/shelfRecipeBom.test.js, e2e/shelf-items-contract.spec.mjs.