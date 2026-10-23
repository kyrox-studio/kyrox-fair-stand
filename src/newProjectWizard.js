import { metersInputToCm, formatMeters } from './standSizeInput.js';
import { getFairStandHostDocument } from './hostDocument.js';

// Yeni proje sihirbazı: boş sahnenin (#viewport-empty) ortasında 3 adım — stand tipi, ölçü,
// özet + Oluştur. Yeni bir kurulum yolu açmaz: seçimleri sol menüdeki mevcut alanlara yazar ve
// son adımda mevcut "Sahneyi Oluştur" düğmesine basar (proje adı penceresi, doğrulama ve kayıt
// aynı kalır). Yalnız yeni projede gösterilir; ✕ ile kapatılınca bugünkü boş sahne kartı görünür.

const STYLE_ID = 'new-project-wizard-styles';

function ensureStyles(document) {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .new-project-wizard { position: relative; display: flex; width: min(560px, 100%); max-height: 100%; flex-direction: column;
      gap: 14px; padding: 22px; overflow: auto; border: 1px solid #d9dee5; border-radius: 18px; background: #fff;
      box-shadow: 0 16px 42px rgba(15, 23, 42, 0.14); color: #273142; text-align: left; }
    .new-project-wizard[hidden] { display: none; }
    .new-project-wizard h2 { margin: 0; font-size: 18px; }
    .new-project-wizard .wizard-step-label { margin: 0; color: #667085; font-size: 12px; font-weight: 600; }
    .new-project-wizard .wizard-close { position: absolute; top: 12px; right: 12px; width: 32px; height: 32px; min-height: 32px;
      padding: 0; border: 0; border-radius: 8px; background: transparent; color: #667085; font-size: 18px; cursor: pointer; }
    .new-project-wizard .wizard-types { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .new-project-wizard .wizard-type { display: flex; min-height: 96px; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px; padding: 10px; border: 2px solid #d9dee5; border-radius: 12px; background: #f8fafc; color: #273142;
      font: 600 13px/1.2 system-ui, sans-serif; cursor: pointer; }
    .new-project-wizard .wizard-type svg { width: 72px; height: 48px; }
    .new-project-wizard .wizard-type[aria-pressed="true"] { border-color: #f97316; background: #fff3e8; }
    .new-project-wizard .wizard-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .new-project-wizard .wizard-fields label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; }
    .new-project-wizard .wizard-fields input, .new-project-wizard .wizard-fields select { min-height: 42px; padding: 0 10px;
      border: 1px solid #cbd3dc; border-radius: 10px; font-size: 15px; }
    .new-project-wizard .wizard-check { flex-direction: row !important; align-items: center; }
    .new-project-wizard .wizard-check input { min-height: 0; width: 20px; height: 20px; }
    .new-project-wizard .wizard-hint { margin: 0; color: #667085; font-size: 12px; }
    .new-project-wizard .wizard-hint[hidden] { display: none; }
    .new-project-wizard .wizard-error { margin: 0; color: #b42318; font-size: 13px; font-weight: 600; }
    .new-project-wizard .wizard-summary { margin: 0; padding: 12px 14px; border-radius: 12px; background: #f8fafc; font-size: 14px; line-height: 1.6; }
    .new-project-wizard .wizard-actions { display: flex; justify-content: space-between; gap: 10px; }
    .new-project-wizard .wizard-actions button { min-height: 44px; padding: 0 18px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer; }
    .new-project-wizard .wizard-next { border: 0; background: #1e3a5f; color: #fff; }
    .new-project-wizard .wizard-next:hover:not(:disabled) { background: #16304f; color: #fff; }
    .new-project-wizard .wizard-next:disabled { opacity: 0.45; cursor: not-allowed; }
    .new-project-wizard .wizard-type:hover:not(:disabled) { border-color: #f97316; background: #fff8f2; }
    .new-project-wizard .wizard-type[aria-pressed="true"]:hover:not(:disabled) { background: #fff3e8; }
    .viewport-empty-card[hidden] { display: none; }
    .new-project-wizard .wizard-back { border: 1px solid #cbd3dc; background: #fff; color: #273142; }
    .new-project-wizard .wizard-back[hidden] { visibility: hidden; display: block; }
    @media (max-width: 520px) { .new-project-wizard .wizard-fields { grid-template-columns: 1fr; } }
  `;
  document.head.appendChild(style);
}

function setControlValue(control, value) {
  if (!control) return;
  if (control.type === 'checkbox') control.checked = Boolean(value);
  else control.value = String(value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

export function createNewProjectWizard({ container, validateSetup, onCreate } = {}) {
  const document = getFairStandHostDocument();
  if (!container || !document?.body) return { show() {}, dismiss() {}, element: null };
  ensureStyles(document);

  const sidebar = {
    typeButtons: () => [...document.querySelectorAll('[data-stand-type]')],
    sizeX: document.querySelector('#stand-size-x'),
    sizeY: document.querySelector('#stand-size-y'),
    wallHeight: document.querySelector('#wall-height'),
    depotSize: document.querySelector('#auto-depot-size'),
    depotContents: document.querySelector('#auto-depot-contents'),
    fasciaRows: document.querySelector('#auto-fascia-rows'),
    floorType: document.querySelector('#floor-type'),
  };
  const emptyCard = container.querySelector('.viewport-empty-card');

  const wizard = document.createElement('div');
  wizard.className = 'new-project-wizard';
  wizard.setAttribute('role', 'dialog');
  wizard.setAttribute('aria-label', 'Yeni proje sihirbazı');
  wizard.innerHTML = `
    <button type="button" class="wizard-close" aria-label="Sihirbazı kapat" title="Sihirbazı kapat (sol menüden devam)">✕</button>
    <p class="wizard-step-label"></p>
    <h2></h2>
    <div class="wizard-body"></div>
    <p class="wizard-error" hidden></p>
    <div class="wizard-actions">
      <button type="button" class="wizard-back">← Geri</button>
      <button type="button" class="wizard-next">İleri →</button>
    </div>
  `;
  container.appendChild(wizard);

  const stepLabel = wizard.querySelector('.wizard-step-label');
  const title = wizard.querySelector('h2');
  const body = wizard.querySelector('.wizard-body');
  const error = wizard.querySelector('.wizard-error');
  const backButton = wizard.querySelector('.wizard-back');
  const nextButton = wizard.querySelector('.wizard-next');
  let step = 0;

  function selectedTypeButton() {
    return sidebar.typeButtons().find((button) => button.getAttribute('aria-pressed') === 'true') ?? null;
  }

  function showError(message) {
    error.textContent = message ?? '';
    error.hidden = !message;
  }

  function renderTypes() {
    title.textContent = 'Stand tipini seç';
    const grid = document.createElement('div');
    grid.className = 'wizard-types';
    sidebar.typeButtons().forEach((source) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'wizard-type';
      button.dataset.wizardStandType = source.dataset.standType;
      button.setAttribute('aria-pressed', source.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
      const thumb = source.querySelector('svg');
      if (thumb) button.appendChild(thumb.cloneNode(true));
      const label = document.createElement('span');
      label.textContent = source.textContent.trim();
      button.appendChild(label);
      button.addEventListener('click', () => {
        source.click();
        grid.querySelectorAll('.wizard-type').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
        nextButton.disabled = false;
        showError('');
      });
      grid.appendChild(button);
    });
    body.replaceChildren(grid);
    nextButton.disabled = !selectedTypeButton();
  }

  function cloneSelect(source, id) {
    const select = document.createElement('select');
    select.id = id;
    [...(source?.options ?? [])].forEach((option) => select.appendChild(option.cloneNode(true)));
    select.value = source?.value ?? '';
    return select;
  }

  function renderSize() {
    title.textContent = 'Stand ölçüsü';
    const fields = document.createElement('div');
    fields.className = 'wizard-fields';
    const field = (labelText, control) => {
      const label = document.createElement('label');
      label.append(labelText, control);
      return label;
    };
    const x = document.createElement('input');
    x.type = 'text';
    x.required = true;
    x.id = 'wizard-size-x';
    x.inputMode = 'decimal';
    x.value = sidebar.sizeX?.value ?? '';
    x.placeholder = 'ör. 6,5';
    const y = x.cloneNode();
    y.id = 'wizard-size-y';
    y.value = sidebar.sizeY?.value ?? '';
    y.placeholder = 'ör. 4,5';
    const height = cloneSelect(sidebar.wallHeight, 'wizard-wall-height');
    [...height.options].forEach(option => { option.textContent = `${formatMeters(option.value)} m`; });
    const floor = cloneSelect(sidebar.floorType, 'wizard-floor-type');
    // Depo: sol menüdeki gibi tek liste ("Depo yok" + ölçüler); depo seçiliyken içerik kutusu açılır.
    const depotSize = cloneSelect(sidebar.depotSize, 'wizard-depot-size');
    const contents = document.createElement('input');
    contents.type = 'checkbox';
    contents.id = 'wizard-depot-contents';
    contents.checked = Boolean(sidebar.depotContents?.checked);
    const contentsHint = document.createElement('p');
    contentsHint.className = 'wizard-hint';
    contentsHint.textContent = 'Seçilirse Mini Buzdolabı + Kettle + Askılık + Çöp Kutusu otomatik eklenir.';
    const syncDepot = () => {
      const enabled = Boolean(depotSize.value);
      contents.disabled = !enabled;
      if (!enabled) contents.checked = false;
      contentsHint.hidden = !enabled;
    };
    syncDepot();

    x.addEventListener('input', () => setControlValue(sidebar.sizeX, x.value));
    y.addEventListener('input', () => setControlValue(sidebar.sizeY, y.value));
    floor.addEventListener('change', () => setControlValue(sidebar.floorType, floor.value));
    height.addEventListener('change', () => setControlValue(sidebar.wallHeight, height.value));
    depotSize.addEventListener('change', () => {
      setControlValue(sidebar.depotSize, depotSize.value);
      syncDepot();
      setControlValue(sidebar.depotContents, contents.checked);
    });
    contents.addEventListener('change', () => setControlValue(sidebar.depotContents, contents.checked));

    // Alınlık: önce "olsun mu?", olsun denirse tek / çift sıra; sol menüdeki tek listeye yazılır.
    const fascia = document.createElement('input');
    fascia.type = 'checkbox';
    fascia.id = 'wizard-fascia';
    fascia.checked = Boolean(sidebar.fasciaRows?.value);
    const fasciaRows = document.createElement('select');
    fasciaRows.id = 'wizard-fascia-rows';
    [...(sidebar.fasciaRows?.options ?? [])]
      .filter((option) => option.value)
      .forEach((option) => fasciaRows.appendChild(option.cloneNode(true)));
    fasciaRows.value = sidebar.fasciaRows?.value || '1';
    const syncFascia = () => {
      fasciaRows.disabled = !fascia.checked;
      setControlValue(sidebar.fasciaRows, fascia.checked ? fasciaRows.value : '');
    };
    fascia.addEventListener('change', syncFascia);
    fasciaRows.addEventListener('change', syncFascia);
    fasciaRows.disabled = !fascia.checked;

    const contentsLabel = field('Depo ekipmanlarını ekle', contents);
    contentsLabel.classList.add('wizard-check');
    contentsHint.style.gridColumn = '1 / -1';
    const fasciaLabel = field('Üst tabela (alınlık) ekle', fascia);
    fasciaLabel.classList.add('wizard-check');
    fields.append(
      field('Genişlik (m)', x),
      field('Derinlik (m)', y),
      field('Duvar yüksekliği', height),
      field('Depo', depotSize),
      contentsLabel,
      contentsHint,
      fasciaLabel,
      field('Alınlık düzeni', fasciaRows),
      field('Zemin kaplaması', floor),
    );
    const hint = document.createElement('p');
    hint.className = 'wizard-hint';
    hint.textContent = '0,5 m adımlarla gir; örneğin 4,5 m veya 6,5 m. Seçimlerini sonradan sol menüden değiştirebilirsin.';
    body.replaceChildren(fields, hint);
    nextButton.disabled = false;
  }

  function renderSummary() {
    title.textContent = 'Özet';
    const type = selectedTypeButton()?.textContent.trim() ?? '—';
    const depot = sidebar.depotSize?.value
      ? `${sidebar.depotSize.selectedOptions?.[0]?.textContent ?? ''}${sidebar.depotContents?.checked ? ' · içerikli' : ''}`
      : 'Yok';
    const fascia = sidebar.fasciaRows?.value ? sidebar.fasciaRows.selectedOptions?.[0]?.textContent ?? '' : 'Yok';
    const summary = document.createElement('p');
    summary.className = 'wizard-summary';
    summary.innerHTML = `<strong>${type}</strong><br>${formatMeters(metersInputToCm(sidebar.sizeX?.value))} × ${formatMeters(metersInputToCm(sidebar.sizeY?.value))} m · duvar ${formatMeters(sidebar.wallHeight?.value)} m<br>Depo: ${depot}<br>Alınlık: ${fascia}<br>Zemin: ${sidebar.floorType?.selectedOptions?.[0]?.textContent ?? '—'}`;
    const hint = document.createElement('p');
    hint.className = 'wizard-hint';
    hint.textContent = 'Oluştur dediğinde proje adı sorulur, sahne kurulur ve proje kaydedilir.';
    body.replaceChildren(summary, hint);
    nextButton.disabled = false;
  }

  function render() {
    stepLabel.textContent = `Yeni proje · Adım ${step + 1} / 3`;
    backButton.hidden = step === 0;
    nextButton.textContent = step === 2 ? 'Oluştur' : 'İleri →';
    showError('');
    [renderTypes, renderSize, renderSummary][step]();
  }

  backButton.addEventListener('click', () => {
    if (step > 0) step -= 1;
    render();
  });

  nextButton.addEventListener('click', () => {
    if (step === 0) {
      if (!selectedTypeButton()) return;
      step = 1;
      render();
      return;
    }
    if (step === 1) {
      const result = validateSetup?.();
      if (result && !result.ok) {
        showError(result.message ?? 'Ölçüler geçerli değil.');
        return;
      }
      step = 2;
      render();
      return;
    }
    onCreate?.();
  });

  function dismiss() {
    wizard.hidden = true;
    if (emptyCard) emptyCard.hidden = false;
  }

  wizard.querySelector('.wizard-close').addEventListener('click', dismiss);

  function show() {
    step = 0;
    wizard.hidden = false;
    if (emptyCard) emptyCard.hidden = true;
    render();
  }

  dismiss();
  return { show, dismiss, element: wizard };
}
