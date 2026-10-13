import MarkdownIt from 'markdown-it';
import taskLists from 'markdown-it-task-lists';
import DOMPurify from 'dompurify';

// CommonMark + GFM: таблицы, зачёркивание и автоссылки включены по умолчанию в markdown-it.
// html: false — сырой HTML из файла не выводим.
const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
md.use(taskLists, { enabled: false, label: false });

export function renderPreview(el: HTMLElement, src: string): void {
  el.innerHTML = DOMPurify.sanitize(md.render(src));
  // Ссылки не должны навигировать само приложение
  el.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
}
