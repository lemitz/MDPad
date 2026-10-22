import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';

// CommonMark + GFM: таблицы, зачёркивание и автоссылки включены по умолчанию в markdown-it.
// html: false — сырой HTML из файла не выводим.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
// enabled: чекбоксы задач кликабельны — клик переключает [ ] / [x] в исходнике
md.use(taskLists, { enabled: true, label: false });

type Token = ReturnType<typeof md.parse>[number];

/**
 * Проставляет блочным элементам строки исходника (0-based):
 * data-line — первая строка, data-line-end — строка после последней.
 * По ним работают правка прямо в превью и синхронизация позиции.
 */
export function annotateLines(tokens: Token[]): void {
  for (const tok of tokens) {
    if (!tok.map || tok.nesting < 0 || tok.type === 'inline') continue;
    tok.attrSet('data-line', String(tok.map[0]));
    tok.attrSet('data-line-end', String(tok.map[1]));
  }
}

export function renderPreview(el: HTMLElement, src: string): void {
  const env = {};
  const tokens = md.parse(src, env);
  annotateLines(tokens);
  // data-* атрибуты DOMPurify пропускает по умолчанию
  el.innerHTML = DOMPurify.sanitize(md.renderer.render(tokens, md.options, env));
  // Обёртка прокручивается по горизонтали, не ломая нативную раскладку таблицы.
  el.querySelectorAll('table').forEach((table) => {
    const scroll = document.createElement('div');
    scroll.className = 'table-scroll';
    scroll.tabIndex = 0;
    table.replaceWith(scroll);
    scroll.append(table);
  });
  // Ссылки не должны навигировать само приложение
  el.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}
