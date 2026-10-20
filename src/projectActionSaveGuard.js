import { getActiveAutosaveController } from './autosaveController.js';

const GUARDED_BUTTON_IDS = new Set([
  'open-project',
  'export-project',
  'create-stage',
]);

const ACTION_FAILURE_MESSAGES = Object.freeze({
  'open-project': 'Mevcut proje kaydedilemedi. Proje açma iptal edildi.',
  'export-project': 'Mevcut proje kaydedilemedi. Dışarı aktarma iptal edildi.',
  'create-stage': 'Mevcut proje kaydedilemedi. Yeni sahne oluşturma iptal edildi.',
  'import-project': 'Mevcut proje kaydedilemedi. İçe aktarma iptal edildi.',
  'project-select': 'Mevcut proje kaydedilemedi. Proje değişikliği iptal edildi.',
});

export function bindProjectActionSaveGuard({
  documentRef = globalThis.document,
  getController = getActiveAutosaveController,
} = {}) {
  if (!documentRef?.addEventListener) return () => {};

  const bypassTargets = new WeakSet();
  let importPreflightSave = null;

  function getProjectStatus() {
    return documentRef.querySelector?.('#project-status') ?? null;
  }

  function getProjectSelect() {
    return documentRef.querySelector?.('#project-select') ?? null;
  }

  function hasActiveProjectWork(controller) {
    if (!controller) return false;
    const viewportEmpty = documentRef.querySelector?.('#viewport-empty');
    return controller.isEnabled() || Boolean(viewportEmpty?.hidden);
  }

  // Otomatik kayıt kapalıyken kaydedilmez (yalnız Kaydet); kaydedilmemiş değişiklik varsa sorulur.
  function confirmWithoutSave(actionId) {
    const message = actionId === 'export-project'
      ? 'Kaydedilmemiş değişiklikler dışa aktarılmaz; projenin son kaydı aktarılır.\n\nDevam edilsin mi?'
      : 'Kaydedilmemiş değişiklikler kaybolacak.\n\nDevam edilsin mi?';
    const confirmFn = documentRef.defaultView?.confirm ?? globalThis.confirm;
    return typeof confirmFn === 'function' ? Boolean(confirmFn(message)) : true;
  }

  async function saveBeforeAction(failureMessage, actionId = null) {
    const controller = getController();
    if (!hasActiveProjectWork(controller)) return true;
    if (controller.isAutoSaveOff?.()) {
      return controller.hasUnsavedChanges?.() ? confirmWithoutSave(actionId) : true;
    }

    const status = getProjectStatus();
    if (status) status.textContent = 'Mevcut proje kaydediliyor…';

    try {
      await controller.flush({ quiet: true });
      return true;
    } catch (error) {
      console.warn('İşlem öncesi proje kaydedilemedi:', error);
      if (status) status.textContent = failureMessage;
      return false;
    }
  }

  function restoreSelectedProject(projectId) {
    if (!projectId) return;
    const select = getProjectSelect();
    if (!select) return;
    const exists = [...select.options].some((option) => option.value === projectId);
    if (exists) select.value = projectId;
  }

  function resumeButtonClick(button, selectedProjectId = null) {
    restoreSelectedProject(selectedProjectId);
    bypassTargets.add(button);
    button.click();
    bypassTargets.delete(button);
  }

  async function onClick(event) {
    const button = event.target?.closest?.('button');
    if (!button || bypassTargets.has(button)) return;

    if (button.id === 'import-project') {
      importPreflightSave = saveBeforeAction(ACTION_FAILURE_MESSAGES['import-project'], 'import-project');
      return;
    }

    if (!GUARDED_BUTTON_IDS.has(button.id)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const selectedProjectId = button.id === 'open-project' || button.id === 'export-project'
      ? getProjectSelect()?.value ?? null
      : null;
    const saved = await saveBeforeAction(ACTION_FAILURE_MESSAGES[button.id], button.id);
    if (!saved) return;

    resumeButtonClick(button, selectedProjectId);
  }

  async function onChange(event) {
    const target = event.target;
    if (!target || bypassTargets.has(target)) return;

    if (target.id === 'project-select') {
      const selectedProjectId = target.value;
      event.preventDefault();
      event.stopImmediatePropagation();

      const saved = await saveBeforeAction(ACTION_FAILURE_MESSAGES['project-select'], 'project-select');
      if (!saved) return;

      restoreSelectedProject(selectedProjectId);
      bypassTargets.add(target);
      target.dispatchEvent(new Event('change', { bubbles: true }));
      bypassTargets.delete(target);
      return;
    }

    if (target.id !== 'import-project-file') return;
    if (!target.files?.length) {
      importPreflightSave = null;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const saved = await (importPreflightSave
      ?? saveBeforeAction(ACTION_FAILURE_MESSAGES['import-project'], 'import-project'));
    importPreflightSave = null;
    if (!saved) {
      target.value = '';
      return;
    }

    bypassTargets.add(target);
    target.dispatchEvent(new Event('change', { bubbles: true }));
    bypassTargets.delete(target);
  }

  documentRef.addEventListener('click', onClick, true);
  documentRef.addEventListener('change', onChange, true);

  return () => {
    documentRef.removeEventListener('click', onClick, true);
    documentRef.removeEventListener('change', onChange, true);
  };
}
