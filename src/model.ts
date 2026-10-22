import type { EditorState, Text } from '@codemirror/state';

export type DocKind = 'markdown' | 'plain';
export type Encoding = 'utf-8' | 'utf-8-bom' | 'utf-16le' | 'utf-16be' | 'windows-1251';
export type Eol = '\n' | '\r\n';

export interface Doc {
  id: number;
  name: string;
  kind: DocKind;
  encoding: Encoding;
  eol: Eol;
  /** FileSystemFileHandle (Chromium) или null, если файла нет или он открыт без хендла */
  handle: any | null;
  /** Актуальное состояние CM6: текст, undo-история, курсор */
  state: EditorState;
  /** Текст на момент последнего сохранения */
  saved: Text;
  /** Позиция просмотра: дробная строка исходника у верхнего края (общая для всех режимов) */
  topLine: number;
}

export const ENCODING_LABEL: Record<Encoding, string> = {
  'utf-8': 'UTF-8',
  'utf-8-bom': 'UTF-8 BOM',
  'utf-16le': 'UTF-16 LE',
  'utf-16be': 'UTF-16 BE',
  'windows-1251': 'Windows-1251',
};

/** Возвращает тип по расширению или null, если расширение неизвестно */
export function kindFromName(name: string): DocKind | null {
  if (/\.(md|markdown)$/i.test(name)) return 'markdown';
  if (/\.txt$/i.test(name)) return 'plain';
  return null;
}

export function isDirty(d: Doc): boolean {
  return !d.state.doc.eq(d.saved);
}
