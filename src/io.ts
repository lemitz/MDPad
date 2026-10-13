import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { t } from './i18n';

export { decodeBytes, encodeText } from './encoding';

/** Файл, открытый пользователем. handle — абсолютный путь на диске. */
export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  handle: string;
}

const basename = (p: string) => p.split(/[\\/]/).pop() || p;

async function readOne(path: string): Promise<OpenedFile> {
  const buf = await invoke<ArrayBuffer>('read_file', { path });
  return { name: basename(path), bytes: new Uint8Array(buf), handle: path };
}

/** Открывает файлы по путям (аргументы запуска, drag & drop из проводника) */
export async function readPaths(paths: string[]): Promise<OpenedFile[]> {
  return Promise.all(paths.map(readOne));
}

export async function pickFiles(): Promise<OpenedFile[]> {
  const sel = await openDialog({
    multiple: true,
    filters: [
      { name: t('filterAll'), extensions: ['md', 'markdown', 'txt'] },
      { name: t('filterEverything'), extensions: ['*'] },
    ],
  });
  if (!sel) return [];
  return readPaths(Array.isArray(sel) ? sel : [sel]);
}

/**
 * Атомарно пишет файл. Если pickNew=true или пути нет, показывает диалог «Сохранить как».
 * Возвращает null, если пользователь отменил диалог.
 */
export async function writeFile(
  handle: string | null,
  suggested: string,
  bytes: Uint8Array,
  pickNew: boolean,
): Promise<{ handle: string; name: string } | null> {
  let path = handle && !pickNew ? handle : null;
  if (!path) {
    path = await saveDialog({
      defaultPath: suggested,
      filters: [
        { name: t('filterMd'), extensions: ['md'] },
        { name: t('filterTxt'), extensions: ['txt'] },
      ],
    });
    if (!path) return null;
  }
  await invoke('write_file', bytes, { headers: { 'x-path': encodeURIComponent(path) } });
  return { handle: path, name: basename(path) };
}
