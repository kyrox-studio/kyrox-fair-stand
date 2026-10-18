// Kenar çubuğundaki "Gruplar" kartı: grupları, parça sayısını ve kilidi listeler;
// grup ve parça komutlarını `onAction(action, { groupId, moduleId })` ile main'e iletir.
// Sahne mantığı burada değildir (bkz. moduleGroups.js, main.js).

import { listGroups } from './moduleGroups.js';

export const MODULE_GROUP_PANEL_EMPTY_TEXT = 'Grup yok. Shift+tık ile öğeleri seçip sağ tık > Grup oluştur.';

function createButton(document, label, action, { danger = false, disabled = false, title = '' } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = danger ? 'module-group-action danger ghost' : 'module-group-action ghost';
  button.dataset.groupAction = action;
  button.textContent = label;
  button.disabled = disabled;
  if (title) button.title = title;
  return button;
}

export function createModuleGroupPanel({ list, empty, document = globalThis.document, describeModule, onAction } = {}) {
  if (!list) return { render() {} };
  const openGroupIds = new Set();

  list.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-group-action]');
    if (!button || button.disabled) return;
    const row = button.closest('[data-group-id]');
    onAction?.(button.dataset.groupAction, {
      groupId: row?.dataset.groupId ?? null,
      moduleId: button.dataset.moduleId ?? null,
    });
  });

  list.addEventListener('toggle', (event) => {
    const details = event.target;
    const groupId = details?.closest?.('[data-group-id]')?.dataset.groupId;
    if (!groupId) return;
    if (details.open) openGroupIds.add(groupId);
    else openGroupIds.delete(groupId);
  }, true);

  function render(modules = []) {
    const groups = listGroups(modules);
    const byId = new Map(modules.map((moduleState) => [moduleState.id, moduleState]));
    list.replaceChildren();
    if (empty) {
      empty.hidden = groups.length > 0;
      empty.textContent = MODULE_GROUP_PANEL_EMPTY_TEXT;
    }
    groups.forEach((group) => {
      const row = document.createElement('div');
      row.className = 'module-group-row';
      row.setAttribute('role', 'listitem');
      row.dataset.groupId = group.id;

      const details = document.createElement('details');
      details.open = openGroupIds.has(group.id);
      const summary = document.createElement('summary');
      const name = document.createElement('span');
      name.className = 'module-group-name';
      name.textContent = group.name;
      const meta = document.createElement('span');
      meta.className = 'module-group-meta';
      meta.textContent = `${group.moduleIds.length} parça${group.locked ? ' · Kilitli' : ''}`;
      summary.append(name, meta);

      const lockedTitle = 'Grup kilitli: önce grubun kilidini açın.';
      const actions = document.createElement('div');
      actions.className = 'module-group-actions';
      actions.append(
        createButton(document, 'Seç', 'group-select'),
        createButton(document, group.locked ? 'Kilidi aç' : 'Kilitle', 'group-lock'),
        createButton(document, 'Adlandır', 'group-rename'),
        createButton(document, 'Çoğalt', 'group-duplicate'),
        createButton(document, 'Çöz', 'group-dissolve', { disabled: group.locked, title: group.locked ? lockedTitle : '' }),
        createButton(document, 'Sil', 'group-delete', { danger: true, disabled: group.locked, title: group.locked ? lockedTitle : '' }),
      );

      const members = document.createElement('ul');
      members.className = 'module-group-members';
      group.moduleIds.forEach((moduleId) => {
        const item = document.createElement('li');
        const select = createButton(document, describeModule?.(byId.get(moduleId)) ?? moduleId, 'group-select-member');
        select.classList.add('module-group-member');
        select.dataset.moduleId = moduleId;
        const remove = createButton(document, 'Çıkar', 'group-remove-member', {
          disabled: group.locked,
          title: group.locked ? lockedTitle : 'Bu parçayı gruptan çıkar',
        });
        remove.dataset.moduleId = moduleId;
        item.append(select, remove);
        members.append(item);
      });

      details.append(summary, actions, members);
      row.append(details);
      list.append(row);
    });
  }

  return { render };
}
