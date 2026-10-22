// Правка прямо в превью: двойной клик по блоку заменяет его полем с Markdown-исходником.
// Каждое изменение сразу уходит транзакцией в CodeMirror — работают undo, «грязная» вкладка,
// сессия и сплит. Ctrl+Enter или клик вне поля — готово, Esc — откатить правку блока.

import type { Text } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { t } from './i18n';

interface Session {
  view: EditorView;
  ta: HTMLTextAreaElement;
  /** Начало блока в документе */
  from: number;
  /** Длина текста блока, который сейчас лежит в документе */
  len: number;
  /** Разделитель перед новым блоком в конце документа (для правки существующего — пусто) */
  prefix: string;
  /** Текст блока до правки — для Esc */
  original: string;
  onDone: () => void;
}

let cur: Session | null = null;

export const isInlineEditing = (): boolean => cur !== null;

/**
 * Блок превью, который правим: пункт списка целиком или верхнеуровневый блок
 * (абзац, заголовок, таблица, цитата, код…).
 */
export function editableBlock(target: Element, root: HTMLElement): HTMLElement | null {
  const li = target.closest<HTMLElement>('li[data-line]');
  if (li && root.contains(li)) return li;
  let el = target.closest<HTMLElement>('[data-line]');
  if (!el || !root.contains(el)) return null;
  for (let p = el.parentElement?.closest<HTMLElement>('[data-line]'); p && root.contains(p); ) {
    el = p;
    p = p.parentElement?.closest<HTMLElement>('[data-line]');
  }
  return el;
}

/** Диапазон документа для строк [start, end) из data-line, без хвостовых пустых строк */
export function blockRange(doc: Text, start: number, end: number): { from: number; to: number } {
  const first = Math.min(start + 1, doc.lines);
  let last = Math.max(first, Math.min(end, doc.lines));
  while (last > first && doc.line(last).text.trim() === '') last--;
  return { from: doc.line(first).from, to: doc.line(last).to };
}

/** Переключает маркер задачи [ ] ↔ [x] в строке исходника. null — строка не задача. */
export function toggleTaskMarker(line: string): string | null {
  const m = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([ xX])\]/.exec(line);
  if (!m) return null;
  return m[1] + (m[2] === ' ' ? 'x' : ' ') + ']' + line.slice(m[0].length);
}

/** Разделитель, чтобы новый блок в конце документа стал отдельным абзацем */
function appendPrefix(doc: Text): string {
  if (!doc.length) return '';
  const tail = doc.sliceString(Math.max(0, doc.length - 2));
  return tail.endsWith('\n\n') ? '' : tail.endsWith('\n') ? '\n' : '\n\n';
}

function autosize(ta: HTMLTextAreaElement): void {
  // height: auto на миг схлопывает поле — сохраняем прокрутку превью, чтобы не прыгала
  const scroller = ta.closest<HTMLElement>('.preview-pane');
  const top = scroller?.scrollTop ?? 0;
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight + 2}px`;
  if (scroller) scroller.scrollTop = top;
}

function apply(s: Session, text: string): void {
  const insert = text ? s.prefix + text : '';
  s.view.dispatch({ changes: { from: s.from, to: s.from + s.len, insert }, userEvent: 'input.inline' });
  s.len = insert.length;
}

/**
 * Начинает правку блока. block = null — новый блок в конце документа.
 * selected — выделенное двойным кликом слово: ставим на него курсор в поле.
 */
export function startInlineEdit(
  view: EditorView,
  root: HTMLElement,
  block: HTMLElement | null,
  selected: string,
  onDone: () => void,
): void {
  finishInlineEdit();
  const doc = view.state.doc;
  let from = doc.length;
  let to = doc.length;
  let prefix = '';
  if (block) ({ from, to } = blockRange(doc, +block.dataset.line!, +block.dataset.lineEnd!));
  else prefix = appendPrefix(doc);

  const original = doc.sliceString(from, to);
  const ta = document.createElement('textarea');
  ta.className = 'inline-edit';
  ta.spellcheck = false;
  ta.value = original;
  ta.placeholder = t('inlinePlaceholder');

  if (!block) root.append(ta);
  else if (block.tagName === 'LI') {
    block.classList.add('inline-editing');
    block.replaceChildren(ta);
  } else {
    const host = block.parentElement?.classList.contains('table-scroll') ? block.parentElement : block;
    host.replaceWith(ta);
  }

  const s: Session = { view, ta, from, len: original.length, prefix, original, onDone };
  cur = s;

  ta.addEventListener('input', () => {
    if (cur !== s) return;
    apply(s, ta.value);
    autosize(ta);
  });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (ta.value !== original) apply(s, original);
      finishInlineEdit();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      finishInlineEdit();
    }
  });
  ta.addEventListener('blur', () => {
    // Переключение на другое окно (Alt+Tab) правку не завершает
    if (cur === s && document.hasFocus()) finishInlineEdit();
  });

  autosize(ta);
  ta.focus({ preventScroll: true });
  const idx = selected ? original.indexOf(selected) : -1;
  if (idx >= 0) ta.setSelectionRange(idx, idx + selected.length);
  else ta.setSelectionRange(original.length, original.length);
}

/** Завершает правку (изменения уже в документе) и перерисовывает превью */
export function finishInlineEdit(): void {
  if (!cur) return;
  const s = cur;
  cur = null;
  s.onDone();
}
