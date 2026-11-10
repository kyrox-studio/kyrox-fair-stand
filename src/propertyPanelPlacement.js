// Özellikler paneli her ekranda sağda yüzen karttır. Üst kenarı üst çubuğun (ve sağ üstte duran
// görünüm küpünün) altına oturur; çubuk dar ekranda birkaç sıraya kırılsa da panel üstüne binmez.
// Değer `--property-panel-top` olarak `.viewport-wrap` üstüne yazılır; CSS yedeği 104px'tir.
const GAP_PX = 12;
const PANEL_RESERVE_PX = 312; // panel genişliği (300) + sağ boşluk (12)

export function computePropertyPanelTop(wrapRect, obstacleRects, gap = GAP_PX) {
  let bottom = 0;
  for (const rect of obstacleRects) {
    if (!rect || rect.width <= 0 || rect.height <= 0) continue;
    // Yalnız panelin dikey şeridine (sağdaki 312px) değen ve sahnenin üst yarısındaki engeller sayılır.
    const touchesPanelColumn = rect.right > wrapRect.right - PANEL_RESERVE_PX;
    const inTopHalf = rect.top - wrapRect.top < wrapRect.height / 2;
    if (touchesPanelColumn && inTopHalf) bottom = Math.max(bottom, rect.bottom - wrapRect.top);
  }
  return Math.round(Math.max(bottom, 0) + gap);
}

export function installPropertyPanelPlacement(wrap) {
  if (!wrap || typeof ResizeObserver !== 'function') return () => {};
  let frame = 0;
  const watched = new Set();
  const update = () => {
    frame = 0;
    // Küp sahneyle sonradan kurulur; ilk görüldüğünde gözlemciye eklenir.
    wrap.querySelectorAll(':scope > .viewport-toolbar, .view-cube').forEach((element) => {
      if (watched.has(element)) return;
      watched.add(element);
      observer.observe(element);
    });
    const obstacles = [...wrap.querySelectorAll(':scope > .viewport-toolbar:not([hidden]), .view-cube')]
      .map((element) => element.getBoundingClientRect());
    wrap.style.setProperty('--property-panel-top', `${computePropertyPanelTop(wrap.getBoundingClientRect(), obstacles)}px`);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(wrap);
  // Üst çubuk gizlenip açılınca (hidden) boyut gözlemcisi tetiklenmeyebilir.
  const mutations = new MutationObserver(schedule);
  mutations.observe(wrap, { childList: true, subtree: true });
  wrap.querySelectorAll(':scope > .viewport-toolbar').forEach((element) => (
    mutations.observe(element, { attributes: true, attributeFilter: ['hidden', 'class'] })
  ));
  schedule();
  return () => {
    observer.disconnect();
    mutations.disconnect();
    if (frame) cancelAnimationFrame(frame);
  };
}
