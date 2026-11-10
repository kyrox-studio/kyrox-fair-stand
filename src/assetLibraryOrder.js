// Görsel arşivi sırası: önce SVG dosyaları, sonra diğerleri; her grup kendi içinde ada göre
// (Türkçe harf sırası, sayılar doğal sırada: logo2 < logo10).
const nameCollator = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' });

export function isSvgAsset(asset) {
  const type = String(asset?.blob?.type || asset?.type || '').toLowerCase();
  if (type === 'image/svg+xml') return true;
  return /\.svg$/i.test(String(asset?.name || '').trim());
}

export function compareAssetsForLibrary(a, b) {
  const svgOrder = Number(isSvgAsset(b)) - Number(isSvgAsset(a));
  if (svgOrder) return svgOrder;
  const byName = nameCollator.compare(String(a?.name || ''), String(b?.name || ''));
  if (byName) return byName;
  return (Number(a?.createdAt) || 0) - (Number(b?.createdAt) || 0);
}

export function sortAssetsForLibrary(assets) {
  return [...assets].sort(compareAssetsForLibrary);
}

// Arşiv araması: ad içinde geçen her kelime aranır; Türkçe büyük/küçük harf fark etmez.
export function assetMatchesQuery(asset, query) {
  const words = String(query || '').trim().toLocaleLowerCase('tr').split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const name = String(asset?.name || '').toLocaleLowerCase('tr');
  return words.every((word) => name.includes(word));
}
