// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Text } from '@codemirror/state';
import { blockRange, editableBlock, toggleTaskMarker } from './inline-edit';
import { renderPreview } from './preview';

const doc = (s: string) => Text.of(s.split('\n'));

describe('preview source lines', () => {
  it('annotates blocks with their source line range', () => {
    const el = document.createElement('article');
    renderPreview(el, '# Title\n\nPara one\nstill one\n\n- a\n- b\n\n```\ncode\n```');
    expect(el.querySelector('h1')?.dataset.line).toBe('0');
    expect(el.querySelector('p')?.dataset.line).toBe('2');
    expect(el.querySelector('p')?.dataset.lineEnd).toBe('4');
    const items = el.querySelectorAll<HTMLElement>('li');
    expect([...items].map((li) => li.dataset.line)).toEqual(['5', '6']);
    // у fenced-кода markdown-it вешает атрибуты на <code> внутри <pre>
    expect(el.querySelector<HTMLElement>('pre code')?.closest<HTMLElement>('[data-line]')?.dataset.line).toBe('8');
  });

  it('picks list items or top-level blocks for editing', () => {
    const el = document.createElement('article');
    renderPreview(el, '> quote **bold**\n\n| A |\n| - |\n| 1 |\n\n- item *x*');
    expect(editableBlock(el.querySelector('strong')!, el)?.tagName).toBe('BLOCKQUOTE');
    expect(editableBlock(el.querySelector('td')!, el)?.tagName).toBe('TABLE');
    expect(editableBlock(el.querySelector('em')!, el)?.tagName).toBe('LI');
  });

  it('renders clickable task checkboxes', () => {
    const el = document.createElement('article');
    renderPreview(el, '- [ ] todo');
    const box = el.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(box?.disabled).toBe(false);
    expect(box?.closest<HTMLElement>('li')?.dataset.line).toBe('0');
  });
});

describe('blockRange', () => {
  it('covers block lines and drops trailing blank lines', () => {
    const d = doc('a\n\n- x\n- y\n\nz');
    const r = blockRange(d, 2, 5);
    expect(d.sliceString(r.from, r.to)).toBe('- x\n- y');
  });

  it('clamps to document end', () => {
    const d = doc('only');
    const r = blockRange(d, 0, 3);
    expect(d.sliceString(r.from, r.to)).toBe('only');
  });
});

describe('toggleTaskMarker', () => {
  it('toggles task markers in lists and quotes', () => {
    expect(toggleTaskMarker('- [ ] buy milk')).toBe('- [x] buy milk');
    expect(toggleTaskMarker('  * [X] done')).toBe('  * [ ] done');
    expect(toggleTaskMarker('> 1. [ ] quoted')).toBe('> 1. [x] quoted');
  });

  it('ignores non-task lines', () => {
    expect(toggleTaskMarker('- plain item')).toBeNull();
    expect(toggleTaskMarker('[ ] not a list')).toBeNull();
  });
});
