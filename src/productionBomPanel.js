import { groupBomLines } from './bomLineGroups.js';
import { resolveProjectBom } from './projectBom.js';
import { formatItemLengthParts, getItem } from './items.js';
import { getFairStandHostDocument } from './hostDocument.js';

const PANEL_ID = 'production-bom-panel';
const POPUP_NAME = 'fair-stand-production-bom';
const DEFAULT_WIDTH = 420;
const DEFAULT_HEIGHT = 520;
const POPUP_STYLE = `
  html, body { margin: 0; height: 100%; background: #f8fafc; color: #0f172a; }
  body { box-sizing: border-box; padding: 16px 18px 24px; font: 13px/1.4 system-ui, sans-serif; }
  #production-bom-popup-root { min-height: 100%; }
  .production-bom-panel__hint { margin: 0 0 10px; color: #64748b; font-size: 12px; }
  .production-bom-panel__section-title { margin: 14px 0 6px; font-size: 12px; font-weight: 650; color: #334155; text-transform: uppercase; letter-spacing: 0.03em; }
  .production-bom-panel__section-title:first-child { margin-top: 0; }
  .production-bom-modules { margin: 0 0 8px; padding: 10px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; }
  .production-bom-modules > summary { font-size: 13px; font-weight: 650; cursor: pointer; }
  .production-bom-module { margin: 0 0 8px; padding: 10px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; }
  .production-bom-module > .panel-summary, .production-bom-module > summary { font-size: 13px; font-weight: 650; cursor: pointer; }
  .production-bom-module__key { color: #64748b; font-weight: 500; font-size: 12px; }
  .production-bom-group { margin: 0 0 10px; }
  .production-bom-group__title { margin: 0 0 4px; font-size: 12px; font-weight: 650; color: #1e293b; }
  .production-bom-group__total { margin: 4px 0 0; font-size: 12px; font-weight: 650; color: #334155; }
  .production-bom-module__list { margin: 0; padding-left: 18px; display: grid; gap: 3px; }
  .production-bom-module--unresolved { border-color: #fca5a5; background: #fff1f2; }
  .production-bom-module__error, .production-bom-panel__empty { margin: 0; color: #64748b; }
  .production-bom-module__error { color: #b91c1c; font-size: 12px; }
  .production-bom-panel__download { border: 1px solid #94a3b8; background: #fff; color: #0f172a; font: inherit; font-size: 12px; line-height: 1; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
`;

function formatNumber(value) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(Number(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function lineLabel(line) {
  // Uzun profil/dikmede parça bölünüşü adın yanında: "Dikme 495 cm (346,5 + 8 + 140,5)".
  const parts = formatItemLengthParts(line.itemKey);
  const name = parts ? `${line.name} (${parts})` : line.name;
  return `${formatNumber(line.quantity)} × ${name} · ${line.unit} · ${line.itemKey}`;
}

function moduleCollapseKey(entry) {
  return entry.moduleId || `idx:${entry.index}:${entry.itemKey ?? 'none'}`;
}

function renderModuleHtml(entry, { open = false } = {}) {
  const head = `Modül ${entry.index + 1} · ${escapeHtml(entry.name)}`;
  const keyAttr = escapeHtml(moduleCollapseKey(entry));
  const openAttr = open ? ' open' : '';
  const unresolvedClass = entry.status === 'unresolved' ? ' production-bom-module--unresolved' : '';
  const key = entry.itemKey
    ? `<div class="production-bom-module__key">${escapeHtml(entry.itemKey)}</div>`
    : '';

  let content;
  if (entry.status === 'unresolved') {
    content = `<p class="production-bom-module__error">${escapeHtml(entry.message)}</p>`;
  } else if (entry.lines.length) {
    content = `<ul class="production-bom-module__list">${entry.lines.map((line) => (
      `<li>${escapeHtml(lineLabel(line))}</li>`
    )).join('')}</ul>`;
  } else {
    content = '<p class="production-bom-panel__empty">Alt item yok.</p>';
  }

  return `
    <details class="panel-card compact collapsible-panel production-bom-module${unresolvedClass}" data-bom-collapse-key="${keyAttr}"${openAttr}>
      <summary class="panel-summary">
        <span>${head}</span>
        <span class="panel-chevron" aria-hidden="true"></span>
      </summary>
      <div class="panel-card-content">
        ${key}
        ${content}
      </div>
    </details>
  `;
}

function metalSection(printAreas) {
  return (printAreas || []).find((section) => section.id === 'metal') ?? null;
}

function metalSizeLines(printAreas) {
  return metalSection(printAreas)?.lines ?? [];
}

function groupsForCombinedList(lines, printAreas) {
  const groups = groupBomLines(lines).map((group) => ({
    id: group.id,
    label: group.label,
    lines: [...group.lines],
  }));
  const panel = groups.find((group) => group.id === 'panel');
  const metalLines = panel?.lines.filter((line) => line.itemKey === 'metal_separator') ?? [];
  if (panel && metalLines.length) {
    panel.lines = panel.lines.filter((line) => line.itemKey !== 'metal_separator');
    let production = groups.find((group) => group.id === 'production');
    if (!production) {
      production = { id: 'production', label: 'Üretim', lines: [] };
      const panelIndex = groups.findIndex((group) => group.id === 'panel');
      groups.splice(panelIndex + 1, 0, production);
    }
    production.lines.push(...metalLines);
  }
  return groups.filter((group) => (
    group.lines.length > 0 || (group.id === 'panel' && metalSizeLines(printAreas).length > 0)
  ));
}

function metalSizeLabel(line) {
  const item = getItem('metal_separator');
  const name = item?.name || 'Metal Separatör';
  const unit = item?.unit || 'metre_kare';
  return `${formatNumber(line.quantity)} x ${name} ${formatNumber(line.widthCm)} × ${formatNumber(line.heightCm)} cm - ${unit}`;
}

function visibleGroupLines(group, printAreas) {
  const sizes = group.id === 'panel' ? metalSizeLines(printAreas) : [];
  if (!sizes.length) return { hardware: group.lines, sizes };
  return {
    hardware: group.lines.filter((line) => line.itemKey !== 'metal_separator'),
    sizes,
  };
}

function formatArea(value) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function printLineLabel(line) {
  const size = `${formatNumber(line.widthCm)}×${formatNumber(line.heightCm)} cm`;
  const each = `${formatArea(line.areaM2)} m²`;
  const name = line.name ? `${line.name} · ` : '';
  if (line.quantity > 1) {
    return `${name}${formatNumber(line.quantity)} × ${size} · ${each} · toplam ${formatArea(line.totalAreaM2)} m²`;
  }
  return `${name}1 × ${size} · ${each}`;
}

function printSubjectKey(line) {
  return `${line?.subjectKind ?? ''}\u0000${line?.subjectId ?? ''}\u0000${line?.name ?? ''}`;
}

function printSubjectGroups(lines) {
  const groups = [];
  for (const line of lines) {
    const key = printSubjectKey(line);
    const current = groups.at(-1);
    if (!current || current.key !== key) {
      groups.push({
        key,
        name: line.name || '',
        lines: [line],
        totalAreaM2: line.totalAreaM2,
      });
    } else {
      current.lines.push(line);
      current.totalAreaM2 += line.totalAreaM2;
    }
  }
  return groups;
}

function printSubjectTotalLabel(group) {
  if (group.lines.length < 2 || !group.name) return '';
  return `${group.name} toplam ${formatArea(group.totalAreaM2)} m²`;
}

function renderPrintAreaGroups(printAreas) {
  const sections = (printAreas || []).filter((section) => section.id !== 'metal');
  if (!sections.length) return '';
  return sections.map((section) => (
    `<section class="production-bom-group">
      <h4 class="production-bom-group__title">${escapeHtml(section.label)}</h4>
      <ul class="production-bom-module__list">${printSubjectGroups(section.lines).map((group) => {
        const rows = group.lines.map((line) => `<li>${escapeHtml(printLineLabel(line))}</li>`).join('');
        const total = printSubjectTotalLabel(group);
        return `${rows}${total ? `<li>${escapeHtml(total)}</li>` : ''}`;
      }).join('')}</ul>
      <p class="production-bom-group__total">Toplam ${escapeHtml(formatArea(section.totalAreaM2))} m²</p>
    </section>`
  )).join('');
}

function renderTotalsHtml(lines, printAreas, { open = false } = {}) {
  const openAttr = open ? ' open' : '';
  const groups = groupsForCombinedList(lines, printAreas);
  const printHtml = renderPrintAreaGroups(printAreas);
  const hardware = groups.length
    ? groups.map((group) => {
      const view = visibleGroupLines(group, printAreas);
      const rows = [
        ...view.hardware.map((line) => `<li>${escapeHtml(lineLabel(line))}</li>`),
        ...view.sizes.map((line) => `<li>${escapeHtml(metalSizeLabel(line))}</li>`),
      ];
      if (!rows.length) return '';
      return `<section class="production-bom-group">
        <h4 class="production-bom-group__title">${escapeHtml(group.label)}</h4>
        <ul class="production-bom-module__list">${rows.join('')}</ul>
      </section>`;
    }).join('')
    : (printHtml ? '' : '<p class="production-bom-panel__empty">Birleşik leaf satır yok.</p>');
  const body = `${hardware}${printHtml}`;

  return `
    <details class="panel-card compact collapsible-panel production-bom-module" data-bom-collapse-key="__totals__"${openAttr}>
      <summary class="panel-summary">
        <span>Birleşik leaf toplam</span>
        <span class="panel-chevron" aria-hidden="true"></span>
      </summary>
      <div class="panel-card-content">${body}</div>
    </details>
  `;
}

export function formatProductionBomText(bom) {
  const blocks = ['Üretim Listesi', ''];
  blocks.push('Kaydetme yok · yan yana birleşimde çiftli aparat, iç köşede köşe aparatı, T birleşimde ortak dikme uygulanır. Çiftli aparat T’de yok. Cam şerit panel_cam / panel_corner_cam olur. Baza dizisi ve aynı genişlikteki host sırtı uygulanır. Short-up eklemi yok.');
  if (bom?.appliedEndToEndCount) blocks.push(`${bom.appliedEndToEndCount} yan yana eklem uygulandı.`);
  if (bom?.appliedCornerCount) blocks.push(`${bom.appliedCornerCount} iç köşe eklem uygulandı.`);
  if (bom?.appliedTeeCount) blocks.push(`${bom.appliedTeeCount} T birleşim uygulandı.`);
  for (const note of bom?.relationshipNotes || []) blocks.push(note);
  if (bom?.unresolved?.length) blocks.push(`${bom.unresolved.length} modül çözülemedi.`);

  blocks.push('', 'Modüller');
  if (!bom?.modules?.length) {
    blocks.push('Sahnede modül yok.');
  } else {
    for (const entry of bom.modules) {
      blocks.push('', `Modül ${entry.index + 1} · ${entry.name}`);
      if (entry.itemKey) blocks.push(entry.itemKey);
      if (entry.status === 'unresolved') blocks.push(entry.message || 'Çözülemedi.');
      else if (entry.lines?.length) {
        for (const line of entry.lines) blocks.push(lineLabel(line));
      } else blocks.push('Alt item yok.');
    }
  }

  blocks.push('', 'Birleşik leaf toplam');
  const groups = groupsForCombinedList(bom?.lines || [], bom?.printAreas);
  if (!groups.length && !bom?.printAreas?.length) blocks.push('Birleşik leaf satır yok.');
  for (const group of groups) {
    const view = visibleGroupLines(group, bom?.printAreas);
    if (!view.hardware.length && !view.sizes.length) continue;
    blocks.push('', group.label);
    for (const line of view.hardware) blocks.push(lineLabel(line));
    for (const line of view.sizes) blocks.push(metalSizeLabel(line));
  }
  for (const section of (bom?.printAreas || []).filter((entry) => entry.id !== 'metal')) {
    blocks.push('', section.label);
    for (const group of printSubjectGroups(section.lines)) {
      for (const line of group.lines) blocks.push(printLineLabel(line));
      const total = printSubjectTotalLabel(group);
      if (total) blocks.push(total);
    }
    blocks.push(`Toplam ${formatArea(section.totalAreaM2)} m²`);
  }
  blocks.push('');
  return blocks.join('\n');
}

export function buildProductionBomHtml(bom, openCollapseKeys = new Set()) {
  const moduleHtml = bom.modules.length
    ? bom.modules.map((entry) => renderModuleHtml(entry, {
      open: openCollapseKeys.has(moduleCollapseKey(entry)),
    })).join('')
    : '<p class="production-bom-panel__empty">Sahnede modül yok.</p>';

  const unresolvedNote = bom.unresolved.length
    ? `<p class="production-bom-panel__hint">${bom.unresolved.length} modül çözülemedi (kırmızı).</p>`
    : '';

  return `
      <p class="production-bom-panel__hint"><button type="button" class="production-bom-panel__popout production-bom-panel__download" data-role="bom-download">Metin indir</button></p>
      <p class="production-bom-panel__hint">Kaydetme yok · yan yana birleşimde çiftli aparat, iç köşede köşe aparatı, T birleşimde ortak dikme uygulanır. Çiftli aparat T’de yok. Cam şerit panel_cam / panel_corner_cam olur. Baza dizisi ve aynı genişlikteki host sırtı uygulanır. Short-up eklemi yok.</p>
      ${bom.appliedEndToEndCount
        ? `<p class="production-bom-panel__hint">${bom.appliedEndToEndCount} yan yana eklem uygulandı.</p>`
        : ''}
      ${bom.appliedCornerCount
        ? `<p class="production-bom-panel__hint">${bom.appliedCornerCount} iç köşe eklem uygulandı.</p>`
        : ''}
      ${bom.appliedTeeCount
        ? `<p class="production-bom-panel__hint">${bom.appliedTeeCount} T birleşim uygulandı.</p>`
        : ''}
      ${(bom.relationshipNotes || []).map((note) => (
        `<p class="production-bom-panel__hint">${escapeHtml(note)}</p>`
      )).join('')}
      ${unresolvedNote}
      <details class="panel-card compact collapsible-panel production-bom-modules" data-bom-collapse-key="__modules__"${openCollapseKeys.has('__modules__') ? ' open' : ''}>
        <summary class="panel-summary">
          <span>Modüller</span>
          <span class="panel-chevron" aria-hidden="true"></span>
        </summary>
        <div class="panel-card-content">${moduleHtml}</div>
      </details>
      ${renderTotalsHtml(bom.lines, bom.printAreas, { open: openCollapseKeys.has('__totals__') })}
    `;
}

export function createProductionBomPanel() {
  const host = getFairStandHostDocument() || (typeof document !== 'undefined' ? document : null);
  if (!host?.body) {
    return {
      open() {},
      close() {},
      isOpen() { return false; },
      refresh() {},
      setAssetNamesSource() {},
      destroy() {},
    };
  }

  let panel = host.getElementById(PANEL_ID);
  if (!panel) {
    panel = host.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'production-bom-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Üretim listesi');
    panel.style.width = `${DEFAULT_WIDTH}px`;
    panel.style.height = `${DEFAULT_HEIGHT}px`;
    panel.style.left = '24px';
    panel.style.top = '72px';
    panel.innerHTML = `
      <div class="production-bom-panel__header" data-role="bom-drag">
        <span class="production-bom-panel__title">Üretim Listesi</span>
        <button type="button" class="production-bom-panel__popout" data-role="bom-popout">Ayrı pencere</button>
        <button type="button" class="production-bom-panel__close" data-role="bom-close" aria-label="Kapat">×</button>
      </div>
      <div class="production-bom-panel__body" data-role="bom-body"></div>
      <div class="production-bom-panel__resize" data-role="bom-resize" aria-hidden="true"></div>
    `;
    host.body.appendChild(panel);
  }

  const body = panel.querySelector('[data-role="bom-body"]');
  const dragHandle = panel.querySelector('[data-role="bom-drag"]');
  const closeButton = panel.querySelector('[data-role="bom-close"]');
  const popoutButton = panel.querySelector('[data-role="bom-popout"]');
  const resizeHandle = panel.querySelector('[data-role="bom-resize"]');
  let popup = null;

  let getModules = () => [];
  let getStand = () => null;
  let getAssetNames = () => null;
  let onVisibilityChange = null;
  let dragState = null;
  let resizeState = null;
  const openCollapseKeys = new Set();

  function popupWindow() {
    if (!popup || popup.closed) return null;
    return popup;
  }

  function popupRoot() {
    return popupWindow()?.document?.getElementById('production-bom-popup-root') ?? null;
  }

  function captureOpenCollapseKeys() {
    openCollapseKeys.clear();
    for (const root of [body, popupRoot()]) {
      root?.querySelectorAll('details[data-bom-collapse-key]').forEach((details) => {
        if (details.open) openCollapseKeys.add(details.getAttribute('data-bom-collapse-key'));
      });
    }
  }

  function paint(html) {
    if (body) body.innerHTML = html;
    const root = popupRoot();
    if (root) root.innerHTML = html;
  }

  function refresh() {
    if (!body) return;
    captureOpenCollapseKeys();
    paint(buildProductionBomHtml(resolveProjectBom(getModules(), getStand(), getAssetNames()), openCollapseKeys));
  }

  function downloadProductionBomText(doc) {
    const view = doc?.defaultView;
    if (!view?.URL?.createObjectURL || !doc.body) return;
    const blob = new view.Blob([formatProductionBomText(resolveProjectBom(getModules(), getStand(), getAssetNames()))], {
      type: 'text/plain;charset=utf-8',
    });
    const url = view.URL.createObjectURL(blob);
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = 'uretim-listesi.txt';
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    view.URL.revokeObjectURL(url);
  }

  function onDownloadClick(event) {
    const button = event.target?.closest?.('[data-role="bom-download"]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    downloadProductionBomText(button.ownerDocument);
  }

  function open() {
    panel.hidden = false;
    refresh();
    onVisibilityChange?.(true);
  }

  function close() {
    panel.hidden = true;
    const child = popupWindow();
    popup = null;
    if (child) child.close();
    onVisibilityChange?.(false);
  }

  function isOpen() {
    return !panel.hidden || Boolean(popupWindow());
  }

  function onPopupHide() {
    if (popup && !popup.closed) return;
    popup = null;
    if (panel.hidden) onVisibilityChange?.(false);
  }

  function onPopoutClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const view = host.defaultView;
    if (!view?.open) return;
    let child = popupWindow();
    if (!child) {
      child = view.open('', POPUP_NAME, 'popup=yes,width=560,height=820');
      if (!child) return;
      popup = child;
      child.document.open();
      child.document.write(`<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>Üretim Listesi</title><style>${POPUP_STYLE}</style></head><body><div id="production-bom-popup-root"></div></body></html>`);
      child.document.close();
      child.addEventListener('pagehide', onPopupHide);
      child.document.addEventListener('click', onDownloadClick);
    }
    const root = child.document.getElementById('production-bom-popup-root');
    if (root && body) root.innerHTML = body.innerHTML;
    panel.hidden = true;
    onVisibilityChange?.(true);
    child.focus();
  }

  function onCloseClick(event) {
    event.preventDefault();
    close();
  }

  function onDragStart(event) {
    if (event.button !== 0) return;
    if (event.target?.closest?.('[data-role="bom-close"], [data-role="bom-popout"]')) return;
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      left: panel.offsetLeft,
      top: panel.offsetTop,
    };
    event.preventDefault();
  }

  function onResizeStart(event) {
    if (event.button !== 0) return;
    resizeState = {
      startX: event.clientX,
      startY: event.clientY,
      width: panel.offsetWidth,
      height: panel.offsetHeight,
    };
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerMove(event) {
    if (dragState) {
      const nextLeft = dragState.left + (event.clientX - dragState.startX);
      const nextTop = dragState.top + (event.clientY - dragState.startY);
      panel.style.left = `${Math.max(0, nextLeft)}px`;
      panel.style.top = `${Math.max(0, nextTop)}px`;
    }
    if (resizeState) {
      const nextWidth = resizeState.width + (event.clientX - resizeState.startX);
      const nextHeight = resizeState.height + (event.clientY - resizeState.startY);
      panel.style.width = `${Math.max(280, nextWidth)}px`;
      panel.style.height = `${Math.max(200, nextHeight)}px`;
    }
  }

  function onPointerUp() {
    dragState = null;
    resizeState = null;
  }

  closeButton?.addEventListener('click', onCloseClick);
  popoutButton?.addEventListener('click', onPopoutClick);
  body?.addEventListener('click', onDownloadClick);
  dragHandle?.addEventListener('mousedown', onDragStart);
  resizeHandle?.addEventListener('mousedown', onResizeStart);
  host.defaultView?.addEventListener('mousemove', onPointerMove);
  host.defaultView?.addEventListener('mouseup', onPointerUp);

  return {
    open,
    close,
    isOpen,
    refresh,
    setModulesSource(fn) {
      getModules = typeof fn === 'function' ? fn : () => [];
    },
    setStandSource(fn) {
      getStand = typeof fn === 'function' ? fn : () => null;
    },
    setAssetNamesSource(fn) {
      getAssetNames = typeof fn === 'function' ? fn : () => null;
    },
    setOnVisibilityChange(fn) {
      onVisibilityChange = typeof fn === 'function' ? fn : null;
    },
    destroy() {
      closeButton?.removeEventListener('click', onCloseClick);
      popoutButton?.removeEventListener('click', onPopoutClick);
      body?.removeEventListener('click', onDownloadClick);
      popupWindow()?.document?.removeEventListener('click', onDownloadClick);
      const child = popupWindow();
      popup = null;
      if (child) child.close();
      dragHandle?.removeEventListener('mousedown', onDragStart);
      resizeHandle?.removeEventListener('mousedown', onResizeStart);
      host.defaultView?.removeEventListener('mousemove', onPointerMove);
      host.defaultView?.removeEventListener('mouseup', onPointerUp);
      panel.remove();
    },
  };
}
