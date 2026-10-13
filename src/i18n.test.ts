import { describe, it, expect } from 'vitest';
import { detectLang } from './i18n';

describe('detectLang', () => {
  it('русская система -> ru', () => {
    expect(detectLang(['ru-RU', 'en'])).toBe('ru');
    expect(detectLang(['ru'])).toBe('ru');
  });
  it('английская система -> en', () => {
    expect(detectLang(['en-US'])).toBe('en');
  });
  it('третий язык (не ru и не en) -> en', () => {
    expect(detectLang(['de-DE', 'ru'])).toBe('en');
    expect(detectLang(['pl-PL'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
  it('не путает похожие коды: ruby/ruff не русский', () => {
    expect(detectLang(['rum'])).toBe('en');
  });
});
