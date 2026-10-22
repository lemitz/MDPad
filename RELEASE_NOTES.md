# MDPad v1.1.0

Windows 10/11 x64 release of MDPad, a lightweight Markdown and plain-text editor.

## Changes

- **Edit right in the preview.** Double-click a block (paragraph, heading, list item, table, quote, code) to edit its Markdown in place; double-click below the text to add a new block. `Ctrl+Enter` or clicking outside finishes, `Esc` reverts the block. Changes go straight into the document: undo, the unsaved marker, session restore and split view stay in sync.
- `Ctrl+Z` / `Ctrl+Y` now work in render view as well, so edits made in the preview can be undone there.
- Task-list checkboxes in the preview are clickable and toggle `[ ]` / `[x]` in the source.
- **Position sync in every view.** Scroll sync now maps by source lines instead of scroll percentage and works both ways in split view. Switching markup ↔ render ↔ split, or expanding a collapsed pane, keeps the same part of the document on screen.
- Each tab remembers its position in every view, not only in the editor.
- Expanding a collapsed preview pane with the divider now shows the latest text.
- The "Sync scroll" setting is renamed to "Sync position between editor and preview" and controls all of the above.

## Downloads

- `MDPad_1.1.0_x64-setup.exe` — per-user NSIS installer; registers `.md` and `.markdown` as supported file types.
- `MDPad_1.1.0_x64-portable.exe` — portable executable; no installation required.
- `SHA256SUMS.txt` — checksums for both executables.

The binaries are not code-signed, so Windows SmartScreen may show a warning. MDPad requires the Microsoft Edge WebView2 Runtime (included on Windows 11 and most up-to-date Windows 10 systems; the installer can install it if needed).

To verify a download in PowerShell, run `Get-FileHash .\MDPad_1.1.0_x64-setup.exe -Algorithm SHA256` and compare the result with `SHA256SUMS.txt`.
