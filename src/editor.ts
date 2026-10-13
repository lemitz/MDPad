import { EditorState, Compartment, EditorSelection, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
  dropCursor,
  highlightSpecialChars,
  type ViewUpdate,
} from '@codemirror/view';
import { history, historyKeymap, defaultKeymap, indentWithTab } from '@codemirror/commands';
import {
  search,
  searchKeymap,
  highlightSelectionMatches,
  gotoLine,
  openSearchPanel,
} from '@codemirror/search';
import { markdown } from '@codemirror/lang-markdown';
import { syntaxHighlighting, HighlightStyle, indentOnInput, bracketMatching } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { DocKind } from './model';
import { settings } from './settings';

interface Handlers {
  onUpdate(u: ViewUpdate): void;
  onScroll(): void;
}
let handlers: Handlers = { onUpdate() {}, onScroll() {} };
export function setEditorHandlers(h: Handlers): void {
  handlers = h;
}

// Compartments позволяют менять номера строк и перенос на лету без пересоздания состояния
const lineNumComp = new Compartment();
const wrapComp = new Compartment();

const lineNumExt = (): Extension => (settings.lineNumbers ? lineNumbers() : []);
const wrapExt = (): Extension => (settings.lineWrap ? EditorView.lineWrapping : []);

export function applyEditorSettings(view: EditorView): void {
  view.dispatch({
    effects: [lineNumComp.reconfigure(lineNumExt()), wrapComp.reconfigure(wrapExt())],
  });
}

/** Тёмная подсветка Markdown. Светлой темы нет. */
const darkHighlight = HighlightStyle.define([
  { tag: t.heading, color: '#7aa2f7', fontWeight: 'bold' },
  { tag: t.strong, fontWeight: 'bold' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.link, color: '#7dcfff' },
  { tag: t.url, color: '#7dcfff' },
  { tag: t.monospace, color: '#9ece6a' },
  { tag: t.quote, color: '#9aa5ce', fontStyle: 'italic' },
  { tag: t.list, color: '#e0af68' },
  { tag: t.contentSeparator, color: '#565f89' },
  { tag: t.processingInstruction, color: '#565f89' },
  { tag: t.meta, color: '#565f89' },
]);

/**
 * Оборачивает выделение маркером (** или *). Повторное нажатие снимает маркер.
 * Без выделения ставит пару маркеров и курсор между ними.
 */
export function toggleWrap(marker: string) {
  const m = marker.length;
  return (view: EditorView): boolean => {
    const { state } = view;
    view.dispatch(
      state.changeByRange((range) => {
        const before = state.sliceDoc(Math.max(0, range.from - m), range.from);
        const after = state.sliceDoc(range.to, range.to + m);
        if (before === marker && after === marker) {
          return {
            changes: [
              { from: range.from - m, to: range.from },
              { from: range.to, to: range.to + m },
            ],
            range: EditorSelection.range(range.from - m, range.to - m),
          };
        }
        return {
          changes: [
            { from: range.from, insert: marker },
            { from: range.to, insert: marker },
          ],
          range: EditorSelection.range(range.from + m, range.to + m),
        };
      }),
    );
    return true;
  };
}

/**
 * Штатная раскладка CodeMirror без Ctrl+I: там он привязан к selectParentSyntax,
 * который выделяет весь абзац и ломает переключение курсива.
 */
export const baseKeymap = defaultKeymap.filter((b) => b.key !== 'Mod-i');

/** Markdown-сочетания: Ctrl+B — жирный, Ctrl+I — курсив. Высокий приоритет, чтобы перекрыть базовые. */
export function markdownShortcuts() {
  return Prec.highest(
    keymap.of([
      { key: 'Mod-b', run: toggleWrap('**') },
      { key: 'Mod-i', run: toggleWrap('*') },
    ]),
  );
}

/** Создаёт состояние редактора под тип документа. Для .txt Markdown-расширений нет. */
export function createState(kind: DocKind, text: string): EditorState {
  const exts: Extension[] = [
    lineNumComp.of(lineNumExt()),
    wrapComp.of(wrapExt()),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    highlightSpecialChars(),
    search({ top: false }),
    syntaxHighlighting(darkHighlight),
    keymap.of([
      { key: 'Mod-g', run: gotoLine },
      { key: 'Mod-h', run: openSearchPanel },
      indentWithTab,
      ...searchKeymap,
      ...historyKeymap,
      ...baseKeymap,
    ]),
    EditorView.updateListener.of((u) => handlers.onUpdate(u)),
  ];

  if (kind === 'markdown') {
    exts.push(
      markdown(),
      markdownShortcuts(),
    );
  }

  return EditorState.create({ doc: text, extensions: exts });
}

export function createView(parent: HTMLElement, state: EditorState): EditorView {
  const view = new EditorView({ state, parent });
  view.scrollDOM.addEventListener('scroll', () => handlers.onScroll());
  return view;
}
