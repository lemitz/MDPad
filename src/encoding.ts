import type { Encoding, Eol } from './model';

export function decodeBytes(bytes: Uint8Array): { text: string; encoding: Encoding; eol: Eol } {
  let text: string;
  let encoding: Encoding;

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = new TextDecoder('utf-8').decode(bytes.subarray(3));
    encoding = 'utf-8-bom';
  } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder('utf-16le').decode(bytes.subarray(2));
    encoding = 'utf-16le';
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder('utf-16be').decode(bytes.subarray(2));
    encoding = 'utf-16be';
  } else {
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      encoding = 'utf-8';
    } catch {
      text = new TextDecoder('windows-1251').decode(bytes);
      encoding = 'windows-1251';
    }
  }

  const i = text.indexOf('\n');
  const eol: Eol = i > 0 && text.charCodeAt(i - 1) === 13 ? '\r\n' : '\n';
  return { text, encoding, eol };
}

let cp1251Reverse: Map<string, number> | null = null;

function cp1251Map(): Map<string, number> {
  if (!cp1251Reverse) {
    cp1251Reverse = new Map();
    const dec = new TextDecoder('windows-1251');
    for (let b = 0; b < 256; b++) {
      const ch = dec.decode(Uint8Array.of(b));
      if (!cp1251Reverse.has(ch)) cp1251Reverse.set(ch, b);
    }
  }
  return cp1251Reverse;
}

function encodeCp1251(s: string): Uint8Array {
  const map = cp1251Map();
  const out: number[] = [];
  for (const ch of s) out.push(map.get(ch) ?? 0x3f); // '?' для непредставимых символов
  return Uint8Array.from(out);
}

function encodeUtf16(s: string, le: boolean): Uint8Array {
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = le ? 0xff : 0xfe;
  out[1] = le ? 0xfe : 0xff;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[2 + i * 2] = le ? c & 0xff : c >> 8;
    out[3 + i * 2] = le ? c >> 8 : c & 0xff;
  }
  return out;
}

/** Текст в редакторе хранится с \n, при записи возвращаем исходный перевод строки */
export function encodeText(text: string, eol: Eol, enc: Encoding): Uint8Array {
  const s = eol === '\n' ? text : text.replace(/\n/g, '\r\n');

  switch (enc) {
    case 'windows-1251':
      return encodeCp1251(s);
    case 'utf-16le':
      return encodeUtf16(s, true);
    case 'utf-16be':
      return encodeUtf16(s, false);
    case 'utf-8-bom': {
      const body = new TextEncoder().encode(s);
      const out = new Uint8Array(body.length + 3);
      out.set([0xef, 0xbb, 0xbf]);
      out.set(body, 3);
      return out;
    }
    default:
      return new TextEncoder().encode(s);
  }
}
