<p align="center">
  <img src="public/logo.png" width="128" alt="MDPad logo">
</p>

<h1 align="center">MDPad</h1>

<p align="center">
  A lightweight notepad for Windows 10/11 with native Markdown support.<br>
  Opens <code>.md</code>, <code>.markdown</code> and <code>.txt</code>. Dark theme only. No telemetry, no network, no nonsense.
</p>

<p align="center">
  <a href="https://github.com/lemitz/MDPad/releases"><img src="https://img.shields.io/badge/version-1.0.2-8b8cff" alt="Version 1.0.2"></a>
  <img src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078d4" alt="Windows 10 / 11">
  <img src="https://img.shields.io/badge/built%20with-Tauri%202-24c8db" alt="Tauri 2">
  <img src="https://img.shields.io/badge/telemetry-none-2ea043" alt="No telemetry">
</p>

<p align="center">
  <b>English</b> · <a href="README.ru.md">Русский</a>
</p>

---

MDPad sits between Notepad and a full-blown Markdown IDE: it starts instantly, feels like a plain text editor, but understands Markdown — syntax highlighting while you type and a faithful CommonMark + GFM preview next to it. It is built on [Tauri 2](https://tauri.app), so it uses the WebView2 runtime that already ships with Windows instead of bundling a browser engine.

## Features

**Editor**
- [CodeMirror 6](https://codemirror.net) editor with Markdown syntax highlighting, undo/redo history, active line highlight, bracket matching and selection-match highlighting
- Find & replace (`Ctrl+F` / `Ctrl+H`) and go to line (`Ctrl+G`)
- `Ctrl+B` / `Ctrl+I` wrap the selection in `**` / `*` — press again to unwrap (Markdown documents only)
- Line numbers and soft wrap, toggleable on the fly
- Font zoom with `Ctrl` + mouse wheel, `Ctrl+=` / `Ctrl+-`, `Ctrl+0` to reset
- Shortcuts are matched by physical key, so they keep working on non-Latin keyboard layouts (e.g. `Ctrl+S` with a Russian layout)

**Preview**
- CommonMark + GitHub Flavored Markdown: tables, task lists, strikethrough, autolinks
- Rendered with [markdown-it](https://github.com/markdown-it/markdown-it); raw HTML in documents is not rendered and the output is sanitized with [DOMPurify](https://github.com/cure53/DOMPurify)
- Live update as you type (debounced)

**Layout**
- Three views: **markup** (source only), **render** (preview only) and **split** (`Ctrl+Shift+V`)
- Split view with a draggable divider — drag it to the edge to collapse a pane, double-click to reset to 50/50
- Optional scroll sync between editor and preview
- Frameless window with a custom title bar, dark theme only

**Tabs**
- Several documents in one window, `Ctrl+Tab` / `Ctrl+Shift+Tab` to cycle
- Close with `Ctrl+W` or a middle click; a dot marks unsaved tabs
- "Save / Don't save / Cancel" prompt before closing an unsaved tab or the window
- Closing the last tab closes the app
- Optional session restore: reopen your tabs (including unsaved drafts) on next start

**Files & encodings**
- Open files via the dialog (multi-select), drag & drop from Explorer, the command line (`mdpad.exe notes.md`) or by double-clicking a `.md` file
- Single instance: opening another file brings the running window to front and adds a tab
- Encodings: UTF-8, UTF-8 with BOM, UTF-16 LE/BE and Windows-1251 are detected automatically and preserved on save
- `CRLF` / `LF` line endings are preserved too; new files are saved as UTF-8 without BOM with `CRLF`
- Atomic saves: the file is written to a temporary file next to the original, flushed to disk and then renamed over it — a crash mid-save never leaves you with a truncated file
- Any other extension opens as plain text; "Save As" `.md` switches the tab to Markdown mode
- Status bar shows line/column, character count, encoding, line ending and document type

**Everything else**
- UI in English, or in Russian when the Windows display language is Russian
- Settings (`Ctrl+,`): restore tabs on startup, wrap long lines, line numbers, sync scroll
- No telemetry, no auto-updates, no network access at all (the content security policy only allows local resources)

## Keyboard shortcuts

| Action | Keys |
|---|---|
| New / Open / Save / Save As | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| Close tab | `Ctrl+W` (or middle-click the tab) |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`) |
| Find / Replace / Go to line | `Ctrl+F` / `Ctrl+H` / `Ctrl+G` |
| Find next / previous | `F3` / `Shift+F3` |
| Bold / Italic (Markdown only) | `Ctrl+B` / `Ctrl+I` |
| Toggle split view | `Ctrl+Shift+V` |
| Switch markup ↔ render | toolbar button |
| Zoom in / out / reset | `Ctrl` + wheel, `Ctrl+=` / `Ctrl+-`, `Ctrl+0` |
| Settings | `Ctrl+,` |

The standard CodeMirror editing keys are available as well (`Tab` / `Shift+Tab` to indent, `Alt+↑/↓` to move lines, `Ctrl+D` to select the next occurrence, and so on).

## Installation

Two flavours are produced by every build:

- **Installer** — `MDPad_<version>_x64-setup.exe` (NSIS). Installs per-user, no admin rights needed, registers MDPad as an editor for `.md` / `.markdown` files. Available in English and Russian.
- **Portable** — a single `mdpad.exe` that runs from anywhere.

Grab them from the [Releases](https://github.com/lemitz/MDPad/releases) page or [build from source](#building-the-installer). MDPad needs the WebView2 Runtime, which is already present on Windows 11 and up-to-date Windows 10 systems; the installer takes care of it if it's missing.

### Making MDPad the default `.md` editor

The installer registers MDPad as an editor for `.md` and `.markdown`, but Windows 10/11 doesn't let a program make itself the default without the user's consent. Right-click any `.md` file → **Open with** → **Choose another app** → **MDPad** → tick **Always use this app**.

## Development

Requirements:

- [Node.js](https://nodejs.org) 20.19+ or 22.12+
- [Rust](https://rustup.rs) stable (1.77 or newer)
- The usual [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for Windows (MSVC build tools, WebView2)

```bash
npm install
npx tauri dev        # run the desktop app with hot reload
npm run dev          # frontend only (Vite dev server on :5173, no file access)
npm test             # frontend tests (vitest)
cd src-tauri && cargo test   # Rust tests
```

The test suite covers encoding detection and round-tripping (including Windows-1251 and UTF-16), the bold/italic toggle logic, UI language detection, and the Rust path handling (command-line arguments, percent-decoded Cyrillic paths).

## Building the installer

```bash
npx tauri build
```

- Installer: `src-tauri/target/release/bundle/nsis/MDPad_<version>_x64-setup.exe`
- Portable executable: `src-tauri/target/release/mdpad.exe`

The release profile is tuned for size (`opt-level = "s"`, LTO, symbols stripped).

A GitHub Actions workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)) builds on `windows-latest` whenever a `v*` tag is pushed (or on manual dispatch): it runs both test suites, builds the installer and uploads it as the `mdpad-windows` artifact.

## Project structure

```
index.html                 app shell: title bar, tabs, panes, status bar
src/
  main.ts                  documents, tabs, view modes, hotkeys, session restore
  editor.ts                CodeMirror 6 setup, dark highlight style, Ctrl+B / Ctrl+I
  preview.ts               markdown-it → DOMPurify → preview pane
  encoding.ts              encoding / line-ending detection and encoding
  io.ts                    open & save dialogs, IPC calls into Rust
  i18n.ts                  English and Russian UI strings
  settings.ts              persisted settings
  ui.ts                    "Save changes?" and Settings dialogs
  model.ts                 document model
  styles.css               dark theme
src-tauri/
  src/main.rs              Tauri bootstrap, single-instance handling, CLI file paths
  src/fsops.rs             read_file / atomic write_file commands
  tauri.conf.json          window, CSP, bundle and file associations
  capabilities/            permissions granted to the main window
.github/workflows/         Windows release build
ARCHITECTURE.md            design notes (in Russian)
```

The split of responsibilities is deliberate: the Rust side knows nothing about Markdown or editing — it reads and writes bytes, handles window and dialog plumbing, and forwards file paths from the command line. Everything about documents, encodings and the UI lives in the TypeScript frontend.

## Tech stack

[Tauri 2](https://tauri.app) · [TypeScript](https://www.typescriptlang.org) · [Vite](https://vite.dev) · [CodeMirror 6](https://codemirror.net) · [markdown-it](https://github.com/markdown-it/markdown-it) · [DOMPurify](https://github.com/cure53/DOMPurify) · [Vitest](https://vitest.dev)
