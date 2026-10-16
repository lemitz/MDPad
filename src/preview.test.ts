// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderPreview } from './preview';

describe('Markdown preview tables', () => {
  it('keeps a native table with aligned cells inside a scrollable wrapper', () => {
    const el = document.createElement('article');
    renderPreview(el, '| [Item](https://example.com) | Amount |\n| :--- | ---: |\n| Long description | **42** |');

    const table = el.querySelector('table');
    const wrapper = table?.parentElement;
    expect(wrapper?.className).toBe('table-scroll');
    expect(wrapper?.tabIndex).toBe(0);
    expect(table?.querySelectorAll('th')).toHaveLength(2);
    expect(table?.querySelector<HTMLTableCellElement>('th:last-child')?.style.textAlign).toBe('right');
    expect(table?.querySelector('td:last-child strong')?.textContent).toBe('42');
    expect(table?.querySelector('a')?.target).toBe('_blank');
    expect(table?.querySelector('a')?.rel).toBe('noopener noreferrer');
  });

  it('wraps multiple tables separately without disturbing other Markdown', () => {
    const el = document.createElement('article');
    renderPreview(el, '| A |\n| --- |\n| 1 |\n\nBetween tables.\n\n| B |\n| --- |\n| 2 |');

    expect(el.querySelectorAll('.table-scroll')).toHaveLength(2);
    expect(el.querySelectorAll('.table-scroll > table')).toHaveLength(2);
    expect(el.querySelector('p')?.textContent).toBe('Between tables.');
  });
});
