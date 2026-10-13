import { describe, it, expect } from 'vitest';
import { decodeBytes, encodeText } from './encoding';

const enc = (s: string) => new TextEncoder().encode(s);

describe('decodeBytes', () => {
  it('UTF-8 без BOM и CRLF', () => {
    const r = decodeBytes(enc('привет\r\nмир'));
    expect(r.encoding).toBe('utf-8');
    expect(r.eol).toBe('\r\n');
    expect(r.text).toBe('привет\r\nмир');
  });

  it('UTF-8 с BOM', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('# hi\n')]);
    const r = decodeBytes(bytes);
    expect(r.encoding).toBe('utf-8-bom');
    expect(r.eol).toBe('\n');
    expect(r.text).toBe('# hi\n');
  });

  it('Windows-1251 (невалидный UTF-8)', () => {
    // «Привет» в cp1251
    const bytes = Uint8Array.from([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2]);
    const r = decodeBytes(bytes);
    expect(r.encoding).toBe('windows-1251');
    expect(r.text).toBe('Привет');
  });

  it('UTF-16 LE с BOM', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x41, 0x00, 0x42, 0x00]);
    const r = decodeBytes(bytes);
    expect(r.encoding).toBe('utf-16le');
    expect(r.text).toBe('AB');
  });
});

describe('encodeText', () => {
  it('сохраняет CRLF', () => {
    expect(new TextDecoder().decode(encodeText('a\nb', '\r\n', 'utf-8'))).toBe('a\r\nb');
  });

  it('добавляет BOM', () => {
    const out = encodeText('x', '\n', 'utf-8-bom');
    expect(Array.from(out.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('round-trip Windows-1251', () => {
    const src = 'Съешь же ещё этих мягких французских булок';
    const out = encodeText(src, '\n', 'windows-1251');
    const back = decodeBytes(out);
    expect(back.encoding).toBe('windows-1251');
    expect(back.text).toBe(src);
  });

  it('round-trip UTF-16 BE', () => {
    const out = encodeText('Тест\nok', '\r\n', 'utf-16be');
    expect(decodeBytes(out).text).toBe('Тест\r\nok');
  });
});
