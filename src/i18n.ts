// Локализация интерфейса: только русский и английский.
// Язык берётся из языка системы (WebView2 отдаёт язык Windows). Русский — только если
// система на русском; любой другой язык (включая третьи) показываем на английском.

export type Lang = 'en' | 'ru';

/** Языки системы в порядке предпочтения (в браузерном окружении WebView2) */
export function systemLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  if (navigator.languages?.length) return navigator.languages;
  return navigator.language ? [navigator.language] : [];
}

export function detectLang(languages: readonly string[]): Lang {
  const first = (languages[0] ?? 'en').toLowerCase();
  return first === 'ru' || first.startsWith('ru-') ? 'ru' : 'en';
}

const en = {
  newDoc: 'New document (Ctrl+N)',
  open: 'Open (Ctrl+O)',
  save: 'Save (Ctrl+S)',
  markup: 'Markup / render',
  settings: 'Settings (Ctrl+,)',
  minimize: 'Minimize',
  maximize: 'Maximize',
  close: 'Close',
  closeTab: 'Close (Ctrl+W)',
  splitter: 'Drag to change width. Double-click — 50/50',
  untitled: 'Untitled',
  openError: 'Open error: {msg}',
  saveError: 'Could not save: {msg}',
  saved: 'Saved: {name}',
  previewMdOnly: 'Preview is available for Markdown only',
  statusPos: 'Ln {line}, Col {col}',
  statusChars: '{n} chars',
  kindMarkdown: 'Markdown',
  kindText: 'Text',
  fontSize: 'Font size: {n}',
  askUnsavedTitle: 'Save changes?',
  askUnsavedText: 'File “{name}” has unsaved changes.',
  cancel: 'Cancel',
  discard: "Don't save",
  saveBtn: 'Save',
  settingsTitle: 'Settings',
  done: 'Done',
  restoreTabs: 'Restore tabs on startup',
  lineWrap: 'Wrap long lines',
  lineNumbers: 'Line numbers',
  syncScroll: 'Sync position between editor and preview',
  inlinePlaceholder: 'Markdown…',
  inlineHint: 'Editing in preview: Ctrl+Enter or click outside — done, Esc — cancel',
  filterAll: 'Markdown and text',
  filterEverything: 'All files',
  filterMd: 'Markdown',
  filterTxt: 'Text',
};

const ru: typeof en = {
  newDoc: 'Новый документ (Ctrl+N)',
  open: 'Открыть (Ctrl+O)',
  save: 'Сохранить (Ctrl+S)',
  markup: 'Разметка / рендер',
  settings: 'Настройки (Ctrl+,)',
  minimize: 'Свернуть',
  maximize: 'Развернуть',
  close: 'Закрыть',
  closeTab: 'Закрыть (Ctrl+W)',
  splitter: 'Перетащите, чтобы изменить ширину. Двойной клик — 50/50',
  untitled: 'Без имени',
  openError: 'Ошибка открытия: {msg}',
  saveError: 'Не удалось сохранить: {msg}',
  saved: 'Сохранено: {name}',
  previewMdOnly: 'Превью доступно только для Markdown',
  statusPos: 'Стр {line}, кол {col}',
  statusChars: '{n} симв.',
  kindMarkdown: 'Markdown',
  kindText: 'Текст',
  fontSize: 'Размер шрифта: {n}',
  askUnsavedTitle: 'Сохранить изменения?',
  askUnsavedText: 'В файле «{name}» есть несохранённые изменения.',
  cancel: 'Отмена',
  discard: 'Не сохранять',
  saveBtn: 'Сохранить',
  settingsTitle: 'Настройки',
  done: 'Готово',
  restoreTabs: 'Восстанавливать вкладки при запуске',
  lineWrap: 'Перенос длинных строк',
  lineNumbers: 'Номера строк',
  syncScroll: 'Синхронизировать позицию редактора и превью',
  inlinePlaceholder: 'Markdown…',
  inlineHint: 'Правка в превью: Ctrl+Enter или клик мимо — готово, Esc — отмена',
  filterAll: 'Markdown и текст',
  filterEverything: 'Все файлы',
  filterMd: 'Markdown',
  filterTxt: 'Текст',
};

export type Key = keyof typeof en;

export const LANG: Lang = detectLang(systemLanguages());
const dict: Record<Lang, typeof en> = { en, ru };

/** Строка интерфейса с подстановкой {переменных} */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s: string = dict[LANG][key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Расставляет подписи статических элементов из index.html по data-атрибутам */
export function applyStaticI18n(root: ParentNode = document): void {
  document.documentElement.lang = LANG;
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle as Key);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as Key));
  });
}
