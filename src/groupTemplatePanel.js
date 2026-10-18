// Kenar çubuğundaki "Şablonlarım" kartı: organizasyonun grup şablonlarını listeler;
// Yerleştir / Adlandır / Sil komutlarını `onAction(action, { templateId })` ile main'e iletir.

export const GROUP_TEMPLATE_PANEL_EMPTY_TEXT = 'Şablon yok. Gruplar kartında bir grubu "Şablon olarak kaydet" ile ekleyin.';

function createButton(document, label, action, { danger = false, disabled = false, title = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = danger ? 'module-group-action danger ghost' : 'module-group-action ghost';
  button.dataset.templateAction = action;
  button.textContent = label;
  button.disabled = disabled;
  if (title) button.title = title;
  return button;
}

export function createGroupTemplatePanel({ list, empty, document = globalThis.document, onAction } = {}) {
  if (!list) return { render() {}, showMessage() {} };

  list.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-template-action]');
    if (!button || button.disabled) return;
    const row = button.closest('[data-template-id]');
    onAction?.(button.dataset.templateAction, { templateId: row?.dataset.templateId ?? null });
  });

  function showMessage(text) {
    list.replaceChildren();
    if (empty) {
      empty.hidden = false;
      empty.textContent = text;
    }
  }

  // `permissions`: { canPlace, canRename, canDelete } — CRM proje yetkilerinden.
  function render(templates = [], permissions = {}) {
    list.replaceChildren();
    if (empty) {
      empty.hidden = templates.length > 0;
      empty.textContent = GROUP_TEMPLATE_PANEL_EMPTY_TEXT;
    }
    const noPermission = 'Bu işlem için yetkiniz yok.';
    templates.forEach((template) => {
      const row = document.createElement('div');
      row.className = 'module-group-row module-template-row';
      row.setAttribute('role', 'listitem');
      row.dataset.templateId = template.id;

      const header = document.createElement('div');
      header.className = 'module-template-header';
      const name = document.createElement('span');
      name.className = 'module-group-name';
      name.textContent = template.name;
      const meta = document.createElement('span');
      meta.className = 'module-group-meta';
      meta.textContent = `${template.memberCount} parça`;
      header.append(name, meta);

      const actions = document.createElement('div');
      actions.className = 'module-group-actions';
      actions.append(
        createButton(document, 'Yerleştir', 'template-place', {
          disabled: permissions.canPlace === false,
          title: permissions.canPlace === false ? 'Önce sahneyi oluşturun.' : '',
        }),
        createButton(document, 'Adlandır', 'template-rename', {
          disabled: permissions.canRename === false,
          title: permissions.canRename === false ? noPermission : '',
        }),
        createButton(document, 'Sil', 'template-delete', {
          danger: true,
          disabled: permissions.canDelete === false,
          title: permissions.canDelete === false ? noPermission : '',
        }),
      );
      row.append(header, actions);
      list.append(row);
    });
  }

  return { render, showMessage };
}
