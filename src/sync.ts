// Синхронизация позиции между редактором и превью.
// Позиция описывается дробным номером строки исходника (0-based): 12.5 — середина 13-й строки.
// Так её можно перенести в любой режим: markup, render или split.

import { EditorView } from '@codemirror/view';

interface Anchor {
  line: number;
  top: number;
}

/** Соответствие «строка исходника ↔ вертикальная позиция в превью» по атрибутам data-line */
export class PreviewMap {
  private anchors: Anchor[] | null = null;

  constructor(
    private pane: HTMLElement,
    private content: HTMLElement,
    private totalLines: () => number,
  ) {
    // Перенос строк, ширина окна, картинки — всё меняет высоты блоков
    new ResizeObserver(() => this.invalidate()).observe(content);
  }

  invalidate(): void {
    this.anchors = null;
  }

  private get(): Anchor[] {
    if (this.anchors) return this.anchors;
    const base = this.pane.getBoundingClientRect().top - this.pane.scrollTop;
    const pts: Anchor[] = [{ line: 0, top: 0 }];
    this.content.querySelectorAll<HTMLElement>('[data-line]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r.height && !r.width) return; // скрытый элемент
      pts.push({ line: +el.dataset.line!, top: r.top - base }, { line: +el.dataset.lineEnd!, top: r.bottom - base });
    });
    pts.push({ line: Math.max(1, this.totalLines()), top: this.pane.scrollHeight });
    pts.sort((a, b) => a.line - b.line || a.top - b.top);
    // Оставляем монотонную последовательность: вложенные блоки могут давать «откаты»
    const out: Anchor[] = [];
    for (const p of pts) if (!out.length || p.top >= out[out.length - 1].top) out.push(p);
    return (this.anchors = out);
  }

  /** Позиция в превью (scrollTop) для строки исходника */
  lineToTop(line: number): number {
    const a = this.get();
    let i = 0;
    while (i + 1 < a.length && a[i + 1].line <= line) i++;
    const p = a[i];
    const q = a[i + 1];
    if (!q || q.line === p.line) return p.top;
    return p.top + ((q.top - p.top) * (line - p.line)) / (q.line - p.line);
  }

  /** Строка исходника для позиции в превью (scrollTop) */
  topToLine(top: number): number {
    const a = this.get();
    let i = 0;
    while (i + 1 < a.length && a[i + 1].top <= top) i++;
    const p = a[i];
    const q = a[i + 1];
    if (!q || q.top === p.top) return p.line;
    return p.line + ((q.line - p.line) * (top - p.top)) / (q.top - p.top);
  }
}

/** Дробная строка исходника у верхнего края видимой области редактора */
export function editorTopLine(view: EditorView): number {
  const s = view.scrollDOM;
  if (s.scrollTop <= 0) return 0;
  const h = s.getBoundingClientRect().top - view.documentTop;
  if (h <= 0) return 0;
  const block = view.lineBlockAtHeight(h);
  const line = view.state.doc.lineAt(block.from).number - 1;
  return line + Math.min(1, Math.max(0, (h - block.top) / Math.max(1, block.height)));
}

/**
 * Прокручивает редактор к строке.
 * immediate — редактор уже видим и измерен (живая синхронизация в сплите): ставим scrollTop сразу.
 * Иначе (редактор только что показан) отдаём прокрутку CodeMirror — он сам дождётся измерений.
 */
export function scrollEditorToLine(view: EditorView, line: number, immediate: boolean): void {
  const s = view.scrollDOM;
  const doc = view.state.doc;
  if (line <= 0) {
    if (immediate) s.scrollTop = 0;
    else requestAnimationFrame(() => (s.scrollTop = 0));
    return;
  }
  const n = Math.min(doc.lines, Math.floor(line) + 1);
  const frac = Math.min(1, Math.max(0, line - (n - 1)));
  const ln = doc.line(n);

  if (immediate) {
    const block = view.lineBlockAt(ln.from);
    const docOffset = view.documentTop - s.getBoundingClientRect().top + s.scrollTop;
    s.scrollTop = docOffset + block.top + frac * block.height;
  } else {
    // для длинной перенесённой строки берём символ пропорционально дробной части
    const pos = ln.from + Math.round(frac * ln.length);
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'start', yMargin: 0 }) });
  }
}
