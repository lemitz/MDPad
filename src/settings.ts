export type BoolSetting = 'restoreTabs' | 'lineWrap' | 'lineNumbers' | 'syncScroll';

export interface Settings {
  restoreTabs: boolean;
  lineWrap: boolean;
  lineNumbers: boolean;
  syncScroll: boolean;
  fontSize: number;
  /** Доля ширины редактора в сплите: 0 — редактор свернут, 1 — превью свернуто */
  splitRatio: number;
}

const KEY = 'mdpad.settings';
const DEFAULTS: Settings = {
  restoreTabs: false,
  lineWrap: true,
  lineNumbers: true,
  syncScroll: true,
  fontSize: 15,
  splitRatio: 0.5,
};

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function saveSettings(): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

export const DEFAULT_FONT_SIZE = DEFAULTS.fontSize;
