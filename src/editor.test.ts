import { describe, it, expect } from 'vitest';
import { EditorState, EditorSelection } from '@codemirror/state';
import { toggleWrap, baseKeymap } from './editor';

/** Применяет toggleWrap к состоянию и возвращает новое состояние */
function press(state: EditorState, marker: string): EditorState {
  let next = state;
  const view = {
    get state() {
      return next;
    },
    dispatch(spec: Parameters<EditorState['update']>[0]) {
      next = next.update(spec).state;
    },
  };
  toggleWrap(marker)(view as never);
  return next;
}

const make = (doc: string, from: number, to = from) =>
  EditorState.create({ doc, selection: EditorSelection.range(from, to) });
const sel = (s: EditorState) => [s.selection.main.from, s.selection.main.to];

describe('Ctrl+I (курсив) и Ctrl+B (жирный)', () => {
  it('оборачивает выделение и сохраняет его внутри маркеров', () => {
    const s = press(make('word', 0, 4), '*');
    expect(s.doc.toString()).toBe('*word*');
    expect(sel(s)).toEqual([1, 5]);
  });

  it('повторное нажатие снимает маркер', () => {
    const s = press(make('*word*', 1, 5), '*');
    expect(s.doc.toString()).toBe('word');
    expect(sel(s)).toEqual([0, 4]);
  });

  it('спам на курсоре не раздувает маркеры: вкл/выкл строго чередуются', () => {
    let s = make('', 0);
    s = press(s, '*');
    expect(s.doc.toString()).toBe('**');
    s = press(s, '*');
    expect(s.doc.toString()).toBe('');
    s = press(s, '*');
    expect(s.doc.toString()).toBe('**');
  });

  it('жирный не путается с курсивом: ** не снимается маркером *', () => {
    const s = press(make('**bold**', 2, 6), '**');
    expect(s.doc.toString()).toBe('bold');
  });

  it('штатный Ctrl+I CodeMirror (selectParentSyntax) не участвует в раскладке', () => {
    expect(baseKeymap.some((b) => b.key === 'Mod-i')).toBe(false);
    expect(baseKeymap.some((b) => b.key === 'Mod-b')).toBe(false);
  });
});
