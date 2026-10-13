import { settings, saveSettings, type BoolSetting } from './settings';
import { t } from './i18n';

export type UnsavedChoice = 'save' | 'discard' | 'cancel';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Диалог «Сохранить изменения?» с тремя вариантами */
export function askUnsaved(name: string): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.innerHTML = `
      <h3>${t('askUnsavedTitle')}</h3>
      <p>${esc(t('askUnsavedText', { name }))}</p>
      <div class="actions">
        <button data-r="cancel">${t('cancel')}</button>
        <button data-r="discard">${t('discard')}</button>
        <button data-r="save" class="primary">${t('saveBtn')}</button>
      </div>`;

    let result: UnsavedChoice = 'cancel';
    dlg.addEventListener('click', (e) => {
      const r = (e.target as HTMLElement).closest<HTMLElement>('[data-r]')?.dataset.r as UnsavedChoice | undefined;
      if (r) {
        result = r;
        dlg.close();
      }
    });
    dlg.addEventListener('close', () => {
      dlg.remove();
      resolve(result);
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

const BOOL_ITEMS: [BoolSetting, Parameters<typeof t>[0]][] = [
  ['restoreTabs', 'restoreTabs'],
  ['lineWrap', 'lineWrap'],
  ['lineNumbers', 'lineNumbers'],
  ['syncScroll', 'syncScroll'],
];

export function openSettingsDialog(onChange: (key: BoolSetting) => void): void {
  const dlg = document.createElement('dialog');
  dlg.className = 'modal';
  dlg.innerHTML =
    `<h3>${t('settingsTitle')}</h3>` +
    BOOL_ITEMS.map(
      ([key, label]) => `<label class="row"><input type="checkbox" data-key="${key}"> ${t(label)}</label>`,
    ).join('') +
    `<div class="actions"><button class="primary" data-close>${t('done')}</button></div>`;

  dlg.querySelectorAll<HTMLInputElement>('input[data-key]').forEach((inp) => {
    const key = inp.dataset.key as BoolSetting;
    inp.checked = settings[key];
    inp.addEventListener('change', () => {
      settings[key] = inp.checked;
      saveSettings();
      onChange(key);
    });
  });

  dlg.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).hasAttribute('data-close')) dlg.close();
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
}
