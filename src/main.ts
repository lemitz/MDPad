import './styles.css';
import { Text } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';
import { createState, createView, setEditorHandlers, applyEditorSettings } from './editor';
import { type Doc, type DocKind, type Encoding, type Eol, isDirty, kindFromName, ENCODING_LABEL } from './model';
import { pickFiles, writeFile, decodeBytes, encodeText, readPaths, type OpenedFile } from './io';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { renderPreview } from './preview';
import { settings, saveSettings, DEFAULT_FONT_SIZE } from './settings';
import { askUnsaved, openSettingsDialog } from './ui';
import { t, applyStaticI18n } from './i18n';

type Mode = 'split' | 'markup' | 'render';

interface SessionTab {
  name: string;
  kind: DocKind;
  encoding: Encoding;
  eol: Eol;
  text: string;
}
interface Session {
  active: number;
  tabs: SessionTab[];
}

const SESSION_KEY = 'mdpad.session';
const UNTITLED = t('untitled');

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const app = $<HTMLDivElement>('#app');
const tabsEl = $<HTMLDivElement>('#tabs');
const editorEl = $<HTMLDivElement>('#editor');
const previewEl = $<HTMLElement>('#preview');
const previewPane = $<HTMLDivElement>('#preview-pane');
const statusMsg = $<HTMLSpanElement>('#status-msg');
const statusInfo = $<HTMLSpanElement>('#status-info');
const btnMarkup = $<HTMLButtonElement>('#btn-markup');
const editorPane = $<HTMLElement>('#editor-pane');
const splitter = $<HTMLElement>('#splitter');
const panesEl = $<HTMLElement>('.panes');

let docs: Doc[] = [];
let activeId = 0;
let nextId = 1;
let untitledCount = 1;
let mode: Mode = 'render';
/** Какой из двух видов показываем, когда сплит выключен */
let singleMode: 'markup' | 'render' = 'render';
let view!: EditorView;
let previewTimer = 0;
let sessionTimer = 0;
let msgTimer = 0;

const active = (): Doc | undefined => docs.find((d) => d.id === activeId);

/* ================= Документы ================= */

function makeDoc(p: {
  name?: string;
  kind?: DocKind;
  encoding?: Encoding;
  eol?: Eol;
  handle?: any;
  text?: string;
  savedEmpty?: boolean;
}): Doc {
  const kind = p.kind ?? 'markdown';
  const state = createState(kind, p.text ?? '');
  return {
    id: nextId++,
    name: p.name ?? `${UNTITLED} ${untitledCount++}`,
    kind,
    encoding: p.encoding ?? 'utf-8',
    eol: p.eol ?? '\r\n',
    handle: p.handle ?? null,
    state,
    // savedEmpty: восстановленный черновик считаем несохранённым
    saved: p.savedEmpty ? Text.of(['']) : state.doc,
    scrollTop: 0,
  };
}

/** Меняет тип документа (например, после «Сохранить как» в .md) и пересобирает состояние */
function rekind(d: Doc, kind: DocKind): void {
  if (d.kind === kind) return;
  d.kind = kind;
  d.state = createState(kind, d.state.doc.toString());
  if (d.id === activeId) {
    view.setState(d.state);
    applyEditorSettings(view);
  }
}

function switchTo(id: number): void {
  const next = docs.find((d) => d.id === id);
  if (!next) return;
  const prev = active();
  if (prev) prev.scrollTop = view.scrollDOM.scrollTop;

  activeId = id;
  view.setState(next.state);
  applyEditorSettings(view);
  renderAll();
  requestAnimationFrame(() => {
    view.scrollDOM.scrollTop = next.scrollTop;
  });
  view.focus();
}

function newDoc(): void {
  const d = makeDoc({});
  docs.push(d);
  switchTo(d.id);
}

function cycle(dir: number): void {
  if (docs.length < 2) return;
  const i = docs.findIndex((d) => d.id === activeId);
  const next = docs[(i + dir + docs.length) % docs.length];
  switchTo(next.id);
}

async function closeDoc(id: number): Promise<void> {
  const d = docs.find((x) => x.id === id);
  if (!d) return;

  if (isDirty(d)) {
    const choice = await askUnsaved(d.name);
    if (choice === 'cancel') return;
    if (choice === 'save' && !(await saveDoc(d))) return;
  }

  const idx = docs.indexOf(d);
  docs = docs.filter((x) => x !== d);
  if (docs.length === 0) {
    // Закрыта последняя вкладка: закрываем приложение. Несохранённое уже спрошено выше.
    saveSession(); // пустая сессия, при восстановлении ничего не вернётся
    void getCurrentWindow().close();
    return;
  }

  if (d.id === activeId) {
    activeId = 0;
    switchTo(docs[Math.min(idx, docs.length - 1)].id);
  } else {
    renderAll();
  }
  scheduleSession();
}

/* ================= Открытие / сохранение ================= */

function addOpened(files: OpenedFile[]): void {
  // Пустой нетронутый «Без имени» заменяем открываемым файлом
  const cur = active();
  if (cur && !cur.handle && cur.name.startsWith(UNTITLED) && !isDirty(cur)) {
    docs = docs.filter((x) => x !== cur);
  }

  let last: Doc | undefined;
  for (const f of files) {
    const { text, encoding, eol } = decodeBytes(f.bytes);
    last = makeDoc({
      name: f.name,
      kind: kindFromName(f.name) ?? 'plain',
      encoding,
      eol,
      handle: f.handle,
      text,
    });
    docs.push(last);
  }
  if (last) switchTo(last.id);
}

async function openDialog(): Promise<void> {
  let files: OpenedFile[];
  try {
    files = await pickFiles();
  } catch (e) {
    setMsg(t('openError', { msg: (e as Error).message }));
    return;
  }
  if (files.length) addOpened(files);
}

async function saveDoc(d: Doc, saveAs = false): Promise<boolean> {
  const snapshot = d.state.doc;
  const bytes = encodeText(snapshot.toString(), d.eol, d.encoding);
  const suggested = /\.\w+$/.test(d.name) ? d.name : d.name + (d.kind === 'markdown' ? '.md' : '.txt');

  let res: Awaited<ReturnType<typeof writeFile>>;
  try {
    res = await writeFile(d.handle, suggested, bytes, saveAs || !d.handle);
  } catch (e) {
    setMsg(t('saveError', { msg: (e as Error).message }));
    return false;
  }
  if (!res) return false;

  d.handle = res.handle;
  d.name = res.name;
  d.saved = snapshot;
  rekind(d, kindFromName(res.name) ?? d.kind);
  renderAll();
  scheduleSession();
  return true;
}

async function saveActive(saveAs = false): Promise<void> {
  const d = active();
  if (!d) return;
  if (await saveDoc(d, saveAs)) setMsg(t('saved', { name: d.name }));
}

/* ================= Режимы и превью ================= */

function setSplit(on: boolean): void {
  mode = on ? 'split' : singleMode;
  renderAll();
}

function setSingle(markup: boolean): void {
  singleMode = markup ? 'markup' : 'render';
  mode = singleMode;
  renderAll();
}

function togglePreview(): void {
  if (active()?.kind === 'plain') {
    setMsg(t('previewMdOnly'));
    return;
  }
  setSplit(mode !== 'split');
}

/* ----- Разделитель сплита ----- */

function applySplitRatio(): void {
  const r = settings.splitRatio;
  app.dataset.collapsed = r <= 0 ? 'editor' : r >= 1 ? 'preview' : '';
  // inline flex нужен только в сплите; в остальных режимах управляет CSS
  editorPane.style.flex =
    app.dataset.mode !== 'split' ? '' : r >= 1 ? '1 1 auto' : `0 0 calc(${r * 100}% - 3px)`;
}

function bindSplitter(): void {
  let dragging = false;

  splitter.addEventListener('pointerdown', (e) => {
    dragging = true;
    splitter.setPointerCapture(e.pointerId);
    splitter.classList.add('drag');
    app.classList.add('dragging');
  });
  splitter.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const rect = panesEl.getBoundingClientRect();
    let r = (e.clientX - rect.left) / rect.width;
    r = Math.min(1, Math.max(0, r));
    // магнитные края: тянем до упора — панель схлопывается полностью
    if (r < 0.04) r = 0;
    else if (r > 0.96) r = 1;
    settings.splitRatio = r;
    applySplitRatio();
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    splitter.classList.remove('drag');
    app.classList.remove('dragging');
    saveSettings();
  };
  splitter.addEventListener('pointerup', end);
  splitter.addEventListener('pointercancel', end);
  splitter.addEventListener('dblclick', () => {
    settings.splitRatio = 0.5;
    applySplitRatio();
    saveSettings();
  });
}

/* ----- Открытие файлов из командной строки / ассоциации ----- */

async function openPendingPaths(): Promise<void> {
  try {
    const paths = await invoke<string[]>('take_pending_paths');
    if (paths.length) addOpened(await readPaths(paths));
  } catch (e) {
    setMsg(t('openError', { msg: (e as Error).message }));
  }
}

function schedulePreview(): void {
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(renderPreviewNow, 120);
}

function renderPreviewNow(): void {
  clearTimeout(previewTimer);
  const d = active();
  if (!d || d.kind !== 'markdown') {
    previewEl.innerHTML = '';
    return;
  }
  // При скрытом превью не пересобираем весь Markdown после каждого ввода.
  // renderAll() обновит её при возврате в render/split.
  if (app.dataset.mode === 'markup' || (app.dataset.mode === 'split' && app.dataset.collapsed === 'preview')) return;
  renderPreview(previewEl, view.state.doc.toString());
}

/** Синхронизация прокрутки: по доле прокрутки редактора */
function onScroll(): void {
  if (!settings.syncScroll || app.dataset.mode !== 'split') return;
  const s = view.scrollDOM;
  const max = s.scrollHeight - s.clientHeight;
  const pmax = previewPane.scrollHeight - previewPane.clientHeight;
  if (max > 0 && pmax > 0) previewPane.scrollTop = (s.scrollTop / max) * pmax;
}

/* ================= Обновление UI ================= */

function renderAll(): void {
  const d = active();
  if (!d) return;
  app.dataset.kind = d.kind;
  app.dataset.mode = d.kind === 'plain' ? 'markup' : mode;
  // подсвечена, когда показана разметка
  btnMarkup.classList.toggle('on', mode !== 'split' && singleMode === 'markup');
  applySplitRatio();
  renderTabs();
  updateTitle();
  updateStatus();
  renderPreviewNow();
}

function renderTabs(): void {
  tabsEl.innerHTML = '';
  for (const d of docs) {
    const el = document.createElement('div');
    el.className = 'tab' + (d.id === activeId ? ' active' : '') + (isDirty(d) ? ' dirty' : '');
    el.title = d.name;
    el.innerHTML = `<span class="dot"></span><span class="name"></span><button class="close" title="${t('closeTab')}" aria-label="${t('close')}"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    el.querySelector('.name')!.textContent = d.name;
    el.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        e.preventDefault();
        closeDoc(d.id);
      }
    });
    el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.close')) closeDoc(d.id);
      else switchTo(d.id);
    });
    tabsEl.append(el);
  }
}

function updateTitle(): void {
  const d = active();
  if (!d) return;
  const title = `${isDirty(d) ? '● ' : ''}${d.name} — MDPad`;
  document.title = title;
  void getCurrentWindow().setTitle(title);
}

function updateStatus(): void {
  const d = active();
  if (!d) return;
  const s = view.state;
  const head = s.selection.main.head;
  const line = s.doc.lineAt(head);
  statusInfo.textContent =
    `${t('statusPos', { line: line.number, col: head - line.from + 1 })}   |   ${t('statusChars', { n: s.doc.length })}   |   ` +
    `${ENCODING_LABEL[d.encoding]}   |   ${d.eol === '\r\n' ? 'CRLF' : 'LF'}   |   ` +
    `${d.kind === 'markdown' ? t('kindMarkdown') : t('kindText')}`;
}

function setMsg(text: string): void {
  statusMsg.textContent = text;
  clearTimeout(msgTimer);
  msgTimer = window.setTimeout(() => (statusMsg.textContent = ''), 3500);
}

/* ================= Обработчики редактора ================= */

function onUpdate(u: ViewUpdate): void {
  const d = active();
  if (!d) return;
  d.state = u.state;
  if (u.docChanged) {
    schedulePreview();
    renderTabs();
    updateTitle();
    scheduleSession();
  }
  if (u.docChanged || u.selectionSet) updateStatus();
}

/* ================= Масштаб ================= */

function applyFont(): void {
  document.documentElement.style.setProperty('--fs', `${settings.fontSize}px`);
}

function zoom(delta: number): void {
  settings.fontSize = delta === 0 ? DEFAULT_FONT_SIZE : Math.min(36, Math.max(9, settings.fontSize + delta));
  saveSettings();
  applyFont();
  setMsg(t('fontSize', { n: settings.fontSize }));
}

/* ================= Сессия (восстановление вкладок) ================= */

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(): void {
  if (!settings.restoreTabs) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  const s: Session = {
    active: Math.max(0, docs.findIndex((d) => d.id === activeId)),
    tabs: docs.map((d) => ({
      name: d.name,
      kind: d.kind,
      encoding: d.encoding,
      eol: d.eol,
      text: d.state.doc.toString(),
    })),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

function scheduleSession(): void {
  if (!settings.restoreTabs) return;
  clearTimeout(sessionTimer);
  sessionTimer = window.setTimeout(saveSession, 400);
}

/* ================= Настройки ================= */

function openSettings(): void {
  openSettingsDialog((key) => {
    if (key === 'restoreTabs') saveSession();
    else if (key === 'lineWrap' || key === 'lineNumbers') applyEditorSettings(view);
  });
}

/* ================= Хоткеи ================= */

// Русская раскладка: CodeMirror сопоставляет клавиши по символу (e.key), поэтому
// Ctrl+и (вместо Ctrl+B) не срабатывал. Переотправляем событие с латинской буквой
// физической клавиши (e.code), чтобы работали штатные сочетания редактора.
// KeyA — выделить всё. Копирование/вставку/вырезание не переотправляем: их делает браузерный движок.
const REMAP_CODES = new Set(['KeyA', 'KeyB', 'KeyI', 'KeyF', 'KeyH', 'KeyG', 'KeyZ', 'KeyY']);
window.addEventListener(
  'keydown',
  (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || !REMAP_CODES.has(e.code)) return;
    if (/^[\x00-\x7f]$/.test(e.key)) return; // уже латиница, пропускаем
    e.preventDefault();
    e.stopImmediatePropagation();
    (e.target as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', {
        key: e.code.slice(3).toLowerCase(),
        code: e.code,
        ctrlKey: true,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  },
  { capture: true },
);

window.addEventListener(
  'keydown',
  (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    // Сопоставляем по физической клавише (e.code), а не по символу (e.key):
    // иначе при русской раскладке Ctrl+S (ы) и Ctrl+O (щ) не срабатывают
    const code = e.code;
    let handled = true;

    if (code === 'KeyN' && !e.shiftKey) newDoc();
    else if (code === 'KeyO' && !e.shiftKey) openDialog();
    else if (code === 'KeyS') saveActive(e.shiftKey);
    else if (code === 'KeyW' && !e.shiftKey) {
      const d = active();
      if (d) closeDoc(d.id);
    } else if (code === 'Tab') cycle(e.shiftKey ? -1 : 1);
    else if (code === 'KeyV' && e.shiftKey) togglePreview();
    else if (code === 'Equal' || code === 'NumpadAdd') zoom(1);
    else if (code === 'Minus' || code === 'NumpadSubtract') zoom(-1);
    else if (code === 'Digit0' || code === 'Numpad0') zoom(0);
    else if (code === 'Comma') openSettings();
    else handled = false;

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  { capture: true },
);

// Ctrl + колесо = масштаб
window.addEventListener(
  'wheel',
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoom(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);

// Drag & drop файлов в окно
// Предупреждение при закрытии вкладки браузера с несохранёнными изменениями
window.addEventListener('beforeunload', (e) => {
  if (docs.some(isDirty)) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ================= Старт ================= */

applyStaticI18n();

$<HTMLButtonElement>('#btn-new').onclick = newDoc;
$<HTMLButtonElement>('#btn-open').onclick = openDialog;
$<HTMLButtonElement>('#btn-save').onclick = () => saveActive(false);
$<HTMLButtonElement>('#btn-settings').onclick = openSettings;
btnMarkup.onclick = () => setSingle(singleMode !== 'markup');

/* ================= Tauri: окно и системные события ================= */

function bindWindowControls(): void {
  const win = getCurrentWindow();
  $<HTMLButtonElement>('#win-min').onclick = () => void win.minimize();
  $<HTMLButtonElement>('#win-max').onclick = () => void win.toggleMaximize();
  $<HTMLButtonElement>('#win-close').onclick = () => void win.close();

  // Подтверждение закрытия окна, если есть несохранённые вкладки
  void win.onCloseRequested(async (event) => {
    if (!docs.some(isDirty)) return; // ничего не спрашиваем, закрываем
    event.preventDefault();
    for (const d of docs.filter(isDirty)) {
      switchTo(d.id);
      const choice = await askUnsaved(d.name);
      if (choice === 'cancel') return;
      if (choice === 'save' && !(await saveDoc(d))) return;
    }
    await win.destroy();
  });

  // Файлы, перетащенные из проводника на окно
  void getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type !== 'drop') return;
    try {
      addOpened(await readPaths(event.payload.paths));
    } catch (e) {
      setMsg(t('openError', { msg: (e as Error).message }));
    }
  });
}

function init(): void {
  bindWindowControls();
  const session = settings.restoreTabs ? loadSession() : null;
  if (session && session.tabs.length) {
    docs = session.tabs.map((t) => makeDoc({ ...t, savedEmpty: true }));
    activeId = docs[Math.min(Math.max(session.active, 0), docs.length - 1)].id;
  } else {
    const d = makeDoc({});
    docs = [d];
    activeId = d.id;
  }

  setEditorHandlers({ onUpdate, onScroll });
  view = createView(editorEl, active()!.state);
  applyFont();
  bindSplitter();
  renderAll();
  view.focus();

  void openPendingPaths();
  void listen('open-paths', () => void openPendingPaths());
}

init();
