// Demo Üretim Listesi (ADR-0012). Gerçek liste demo modunda hiç hesaplanmaz.
// Satırlar sabittir ve açıkça örnektir: gerçek itemKey, ürün adı ya da oran taşımaz,
// sahneye göre değişmez (değişseydi gerçek reçete oranlarını belli ederdi).

export const DEMO_PRODUCTION_BOM_NOTICE = 'Demo görüntülemede gerçek Üretim Listesi görülemez.';

export const DEMO_PRODUCTION_BOM_GROUPS = Object.freeze([
  Object.freeze({
    label: 'Örnek taşıyıcı',
    lines: Object.freeze([
      Object.freeze({ label: 'Örnek Profil A', quantity: 12, unit: 'Adet' }),
      Object.freeze({ label: 'Örnek Profil B', quantity: 8, unit: 'Adet' }),
      Object.freeze({ label: 'Örnek Bağlantı Aparatı', quantity: 24, unit: 'Adet' }),
    ]),
  }),
  Object.freeze({
    label: 'Örnek yüzey',
    lines: Object.freeze([
      Object.freeze({ label: 'Örnek Panel', quantity: 6, unit: 'Adet' }),
      Object.freeze({ label: 'Örnek Zemin Kaplaması', quantity: 20, unit: 'm²' }),
      Object.freeze({ label: 'Örnek Baskı Alanı', quantity: 10, unit: 'm²' }),
    ]),
  }),
  Object.freeze({
    label: 'Örnek donanım',
    lines: Object.freeze([
      Object.freeze({ label: 'Örnek Aydınlatma', quantity: 4, unit: 'Adet' }),
      Object.freeze({ label: 'Örnek Mobilya Takımı', quantity: 1, unit: 'Takım' }),
    ]),
  }),
]);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildDemoProductionBomHtml() {
  const groups = DEMO_PRODUCTION_BOM_GROUPS.map((group) => `
      <div class="production-bom-group">
        <p class="production-bom-group__title">${escapeHtml(group.label)}</p>
        <ul class="production-bom-module__list">
          ${group.lines.map((line) => `<li>${escapeHtml(line.label)} — ${line.quantity} ${escapeHtml(line.unit)}</li>`).join('')}
        </ul>
      </div>`).join('');
  return `
      <p class="production-bom-panel__demo-notice" data-role="bom-demo-notice" role="note">${escapeHtml(DEMO_PRODUCTION_BOM_NOTICE)}</p>
      <p class="production-bom-panel__hint">Aşağıdaki satırlar örnektir; sahnedeki modüllerle ilgisi yoktur.</p>
      ${groups}
    `;
}
