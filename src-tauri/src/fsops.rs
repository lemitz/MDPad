//! Файловые операции. Сырые байты передаются без JSON-сериализации.

use std::fs;
use std::io::Write;
use std::path::Path;

use tauri::ipc::{InvokeBody, Request, Response};

/// Читает файл и отдаёт байты во фронтенд как ArrayBuffer.
#[tauri::command]
pub fn read_file(path: String) -> Result<Response, String> {
    let bytes = fs::read(&path).map_err(|e| format!("could not read file: {e}"))?;
    Ok(Response::new(bytes))
}

/// Атомарная запись: пишем во временный файл рядом, затем переименовываем.
/// Путь передаётся в заголовке `x-path` (percent-encoded UTF-8), тело — сырые байты.
#[tauri::command]
pub fn write_file(request: Request<'_>) -> Result<(), String> {
    let raw = request
        .headers()
        .get("x-path")
        .ok_or("file path is missing")?
        .to_str()
        .map_err(|_| "invalid path")?;
    let path_str = percent_decode(raw).ok_or("invalid path encoding")?;

    let data = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        _ => return Err("expected raw bytes".into()),
    };

    atomic_write(Path::new(&path_str), data).map_err(|e| format!("could not save file: {e}"))
}

fn atomic_write(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let dir = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let file_name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "untitled".into());
    let tmp = dir.join(format!(".{file_name}.mdpad-tmp"));

    let result = (|| {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(data)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, path)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Из аргументов командной строки оставляем существующие файлы (первый аргумент — сам exe).
pub fn collect_paths<I: IntoIterator<Item = String>>(args: I) -> Vec<String> {
    args.into_iter()
        .skip(1)
        .filter(|a| !a.starts_with('-') && Path::new(a).is_file())
        .collect()
}

/// Декодирует percent-encoding (%XX) в UTF-8 строку.
fn percent_decode(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            let hex = input.get(i + 1..i + 3)?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

#[cfg(test)]
mod tests {
    use super::percent_decode;

    #[test]
    fn decodes_cyrillic_path() {
        let enc = "C%3A%5C%D0%94%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D1%8B%5C%D0%B7%D0%B0%D0%BC%D0%B5%D1%82%D0%BA%D0%B8.md";
        assert_eq!(percent_decode(enc).unwrap(), "C:\\Документы\\заметки.md");
    }

    #[test]
    fn collect_paths_skips_exe_and_missing() {
        let args = vec!["mdpad.exe".to_string(), "/nonexistent/x.md".to_string(), "Cargo.toml".to_string()];
        assert_eq!(super::collect_paths(args), vec!["Cargo.toml".to_string()]);
    }

    #[test]
    fn rejects_bad_escape() {
        assert!(percent_decode("abc%G1").is_none());
    }
}
