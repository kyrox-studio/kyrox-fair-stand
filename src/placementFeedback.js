export function formatPlacementFeedbackMessage(message) {
  const text = String(message ?? '').trim();
  if (!text) return '';

  if (/başka (bir )?modülle çakışıyor|bu konumda başka bir modül var/i.test(text)) {
    return 'Başka modülle çakışıyor.';
  }
  if (/stand sınırını aşıyor|aktif stand alanını aşıyor|hedef duvar sınırına sığmıyor/i.test(text)) {
    return 'Stand sınırı dışında.';
  }
  if (/aktif duvar zincirinde.*yeterli alan yok/i.test(text)) {
    return 'Yeterli boşluk yok.';
  }
  if (/duvar modülü .* yönünde olmalı|bu stand tipinde bu konuma modül yerleştirilemez/i.test(text)) {
    return 'Bu konuma bu yönde yerleştirilemez.';
  }

  return text;
}


/**
 * Wall-overlay (TV, Işıklı Strafor …) uyarılarının öznesi: item adı.
 * Sabit ürün adı yazılmaz; ad yoksa genel "Modül" kalıbı kullanılır.
 */
export function resolvePlacementSubjectName(item) {
  const name = typeof item?.name === 'string' ? item.name.trim() : '';
  return name || 'Modül';
}

export function formatWallOverlayFeedback(kind, item) {
  const name = resolvePlacementSubjectName(item);
  switch (kind) {
    case 'drop-on-stand':
      return `${name}: aktif stand alanına bırak.`;
    case 'drag-on-stand':
      return `${name}: aktif stand alanında sürükle.`;
    case 'surface-failed':
      return `${name} bu yüzeye yerleştirilemedi.`;
    case 'wall-place-failed':
      return `${name} bu duvar konumuna yerleştirilemedi.`;
    case 'wall-move-failed':
      return `${name} bu duvar konumuna taşınamadı.`;
    case 'host-unsupported':
      return `${name} bu modüle takılamaz; bir duvara ya da panele tıklayıp Özellikler panelinden Ekle… ile ekle.`;
    case 'stand-limit':
      return `${name} bu yönde stand sınırına ulaştı.`;
    default:
      throw new TypeError(`Unknown wall-overlay feedback kind: ${kind}`);
  }
}
