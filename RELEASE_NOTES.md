# MDPad v1.0.3

Windows 10/11 x64 release of MDPad, a lightweight Markdown and plain-text editor.

## Changes

- Wide Markdown tables keep native column alignment and scroll inside the preview instead of stretching the window.
- Task-list text, including inline formatting, wraps normally alongside its checkbox.
- Editing in source-only mode no longer rebuilds the hidden preview on every change. Returning to preview renders the latest text.
- Added regression tests for multiple tables, aligned cells and links inside tables.

## Downloads

- `MDPad_1.0.3_x64-setup.exe` — per-user NSIS installer; registers `.md` and `.markdown` as supported file types.
- `MDPad_1.0.3_x64-portable.exe` — portable executable; no installation required.
- `SHA256SUMS.txt` — checksums for both executables.

The binaries are not code-signed, so Windows SmartScreen may show a warning. MDPad requires the Microsoft Edge WebView2 Runtime (included on Windows 11 and most up-to-date Windows 10 systems; the installer can install it if needed).

To verify a download in PowerShell, run `Get-FileHash .\MDPad_1.0.3_x64-setup.exe -Algorithm SHA256` and compare the result with `SHA256SUMS.txt`.
