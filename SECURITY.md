# Security

## What MDPad promises, and what it does not

MDPad is often used to open Markdown files written by someone else. It is built so that **a document is only displayed, never run**, and so that MDPad **never talks to the network**:

- Raw HTML in a document is **not rendered** (markdown-it with `html: false`), and the preview is passed through [DOMPurify](https://github.com/cure53/DOMPurify) before it is shown. `<script>`, `<iframe>`, event handlers and `javascript:` links in a `.md` file stay plain text or are dropped.
- The content security policy in `src-tauri/tauri.conf.json` allows scripts only from MDPad's own files (no inline scripts), images only from the app, `data:` and `blob:`, and requests only to Tauri's own IPC. Even if something got past the sanitizer, it could not run inline code or load anything from the internet.
- **Remote images are not loaded**, so opening a document cannot tell anyone that you opened it. `![](https://example.com/x.png)` just stays empty.
- **Links are not followed.** Every link in the preview is marked to open in a new window, MDPad does not allow new windows, and it has no shell or opener plugin, so clicking a link opens neither a browser nor a page inside MDPad.
- There is no updater, telemetry, analytics or crash reporting. The Rust side has no HTTP client.
- MDPad reads a file only when you open it (dialog, drag and drop, command line or double-click) and writes only to the file of the tab you save, or to the path you pick in "Save As". Saves go to a temporary `.<name>.mdpad-tmp` next to the file, which is then renamed over it.
- The window is granted only the core defaults, the open and save dialogs and window controls (`src-tauri/capabilities/default.json`): no shell, opener, HTTP, updater or filesystem plugin.

What MDPad does **not** do:

- The file commands have **no path restrictions**. `read_file` and `write_file` accept any path your Windows account can access; only the frontend decides which paths it passes. The protection against a hostile document is the sanitizer and the content security policy above. Anything that manages to run script in the MDPad window could read and overwrite your files.
- **Session restore** (off by default) keeps the full text of every open tab, including unsaved drafts, unencrypted in the WebView2 storage in your Windows profile (`%LOCALAPPDATA%\ru.mdpad.app`). Anyone who can read your profile can read them.
- Releases are **not code-signed**, so Windows SmartScreen may warn about them. They are built by the [GitHub Actions workflow](.github/workflows/release.yml) from a version tag; check your download against `SHA256SUMS.txt` from the same release. If the WebView2 Runtime is missing, the installer downloads Microsoft's bootstrapper; this is the installer, not MDPad.
- Rendering depends on markdown-it, DOMPurify and Microsoft's WebView2. A bug in one of them could weaken the points above, so keep Windows and WebView2 up to date.

## Reporting a problem

If you find a Markdown or text file that makes MDPad run script, load anything from the network, open a link or a new window, read or write any file other than the one you opened or saved, or do anything its description above does not allow, please report it **privately** through [GitHub security advisories](https://github.com/lemitz/MDPad/security/advisories/new) rather than a public issue. Attach a minimal sample file, not your real documents. The missing path restrictions in the file commands are known; a way to reach them from a document is not.
