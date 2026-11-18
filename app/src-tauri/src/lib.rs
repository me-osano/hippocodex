use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::ipc::Response;
use tauri::{Manager, State};

/// Keep accidental folder drops or gigantic binary files from exhausting memory.
const MAX_FILE_BYTES: u64 = 512 * 1024 * 1024;

/// Notes are small, editable text files. Library-wide filename search is also
/// bounded so a huge folder cannot stall the UI with an unbounded walk.
const MAX_NOTE_BYTES: usize = 8 * 1024 * 1024;
const MAX_SEARCH_RESULTS: usize = 200;
const MAX_SEARCH_ENTRIES: usize = 20_000;
const MAX_SEARCH_DEPTH: usize = 12;

/// The vault path is stored beside the app's other local configuration. The
/// webview never picks this location; it only receives the resulting info.
#[derive(serde::Deserialize, serde::Serialize)]
struct StoredVault {
    path: String,
}

/// Runtime state plus a single persisted source of truth for the vault root.
struct VaultState {
    root: Mutex<Option<PathBuf>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultInfo {
    path: String,
    name: String,
    exists: bool,
    writable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultEntry {
    name: String,
    /// Path relative to the vault root, always with `/` separators.
    path: String,
    /// Absolute path, used by the existing file-opening flow.
    absolute_path: String,
    kind: String,
    has_children: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CreatedNote {
    /// Absolute path, used by the existing file-opening flow.
    path: String,
    name: String,
    relative_path: String,
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string())
}

fn absolute_path(value: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Choose a folder first.".into());
    }
    let path = PathBuf::from(trimmed);
    if !path.is_absolute() {
        return Err("The library folder must be an absolute path.".into());
    }
    Ok(path)
}

fn canonical_directory(path: &Path) -> Result<PathBuf, String> {
    let canonical = path
        .canonicalize()
        .map_err(|error| format!("Could not open “{}”: {error}", path.display()))?;
    if !canonical.is_dir() {
        return Err("The selected path is not a folder.".into());
    }
    Ok(canonical)
}

fn is_writable(dir: &Path) -> bool {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let probe = dir.join(format!(".hippocodex-probe-{}-{nanos}", std::process::id()));
    if fs::write(&probe, b"").is_err() {
        return false;
    }
    fs::remove_file(&probe).is_ok()
}

fn vault_info(path: &Path) -> Result<VaultInfo, String> {
    let canonical = canonical_directory(path)?;
    Ok(VaultInfo {
        path: canonical.to_string_lossy().into_owned(),
        name: display_name(&canonical),
        exists: true,
        writable: is_writable(&canonical),
    })
}

/// Resolve a caller-supplied relative path and make sure it cannot escape the
/// configured vault, even with `..` segments, symlinks, or absolute paths.
fn resolve_in_vault(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let root = canonical_directory(root)?;
    let trimmed = relative.trim();
    let candidate = if trimmed.is_empty() {
        root.clone()
    } else {
        let relative_path = Path::new(trimmed);
        if relative_path.is_absolute() {
            return Err("That path is outside the library.".into());
        }
        root.join(relative_path)
    };
    let resolved = candidate
        .canonicalize()
        .map_err(|_| "This path is no longer available in the library.".to_string())?;
    if !resolved.starts_with(&root) {
        return Err("That path is outside the library.".into());
    }
    Ok(resolved)
}

/// Notes are created as plain files in the Library root. Validate the stem
/// before joining it to the root so no `..`, separator, drive letter, device
/// name, or hidden dotfile can redirect the write outside the Library.
fn note_stem(name: &str) -> Result<String, String> {
    let mut stem = name.trim();
    for extension in ["md", "markdown", "txt", "text"] {
        let suffix = format!(".{extension}");
        if stem.to_lowercase().ends_with(&suffix) {
            stem = stem[..stem.len() - suffix.len()].trim();
            break;
        }
    }
    if stem.is_empty() {
        return Err("Give the note a name.".into());
    }
    if stem.chars().any(|character| {
        character.is_control()
            || matches!(
                character,
                '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
            )
    }) {
        return Err(
            "Use letters, numbers, spaces, dashes, or underscores — no path symbols.".into(),
        );
    }
    if stem.starts_with('.') {
        return Err("Note names cannot start with a dot.".into());
    }
    if stem.chars().count() > 80 {
        return Err("Keep the name under 80 characters.".into());
    }
    Ok(stem.to_owned())
}

fn note_file_name(stem: &str, format: &str) -> Result<String, String> {
    let extension = match format {
        "md" => "md",
        "txt" => "txt",
        _ => return Err("Choose Markdown or plain text.".into()),
    };
    Ok(format!("{stem}.{extension}"))
}

fn note_contents(stem: &str, format: &str) -> String {
    if format == "md" {
        format!("# {stem}\n\n")
    } else {
        format!("{stem}\n\n")
    }
}

fn is_note_extension(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .map(|extension| extension.to_ascii_lowercase())
            .as_deref(),
        Some("md") | Some("txt")
    )
}

/// Resolve an existing note for writing. The target must be a real file inside
/// the configured Library; symlinks and paths outside the root are rejected so
/// the editor cannot be tricked into overwriting unrelated files.
fn resolve_note_for_write(root: &Path, path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("Only absolute note paths can be saved.".into());
    }
    let root = canonical_directory(root)?;
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not open “{}”: {error}", display_name(path)))?;
    if metadata.file_type().is_symlink() {
        return Err("Symlinked notes cannot be edited.".into());
    }
    if !metadata.is_file() {
        return Err("That path is not a note file.".into());
    }
    if !is_note_extension(path) {
        return Err("Only Markdown and text notes can be edited.".into());
    }
    let resolved = path
        .canonicalize()
        .map_err(|_| "This note is no longer available.".to_string())?;
    let parent = resolved
        .parent()
        .ok_or_else(|| "This note has no parent folder.".to_string())?;
    if !resolved.starts_with(&root) || !parent.starts_with(&root) {
        return Err("That note is outside the Library.".into());
    }
    Ok(resolved)
}

/// Write a note through a temporary file in the same folder. A failed rename
/// leaves the original note untouched, and the temp file is removed on error.
fn update_note_in(root: &Path, path: &str, contents: &str) -> Result<(), String> {
    let target = resolve_note_for_write(root, &Path::new(path))?;
    let bytes = contents.as_bytes();
    if bytes.len() > MAX_NOTE_BYTES {
        return Err("Notes must be smaller than 8 MB.".into());
    }
    let parent = target
        .parent()
        .ok_or_else(|| "This note has no parent folder.".to_string())?;
    if !is_writable(parent) {
        return Err("Hippocodex needs write access to this note's folder.".into());
    }

    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let temp = parent.join(format!(
        ".{}.hippocodex-{}-{nanos}.tmp",
        display_name(&target),
        std::process::id()
    ));
    fs::write(&temp, bytes)
        .map_err(|error| format!("Could not save “{}”: {error}", display_name(&target)))?;
    if let Err(error) = fs::rename(&temp, &target) {
        let _ = fs::remove_file(&temp);
        return Err(format!(
            "Could not save “{}”: {error}",
            display_name(&target)
        ));
    }
    Ok(())
}

fn relative_vault_path(root: &Path, path: &Path) -> String {
    match path.strip_prefix(root) {
        Ok(relative) => relative
            .components()
            .map(|component| component.as_os_str().to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("/"),
        Err(_) => display_name(path),
    }
}

/// Search every file in the Library by name or relative path. Hidden entries
/// and symlinked directories are skipped, and the walk is bounded in depth,
/// entries, and results.
fn search_vault_files_in(root: &Path, query: &str) -> Result<Vec<VaultEntry>, String> {
    let root = canonical_directory(root)?;
    let terms: Vec<String> = query
        .split_whitespace()
        .map(|term| term.to_lowercase())
        .collect();
    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let mut stack = vec![(root.clone(), 0usize)];
    let mut results = Vec::new();
    let mut visited = 0usize;

    while let Some((directory, depth)) = stack.pop() {
        if depth > MAX_SEARCH_DEPTH {
            continue;
        }
        let entries = match fs::read_dir(&directory) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for item in entries.flatten() {
            visited += 1;
            if visited > MAX_SEARCH_ENTRIES || results.len() >= MAX_SEARCH_RESULTS {
                break;
            }
            let name = item.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            let file_type = match item.file_type() {
                Ok(file_type) if !file_type.is_symlink() => file_type,
                _ => continue,
            };
            let path = item.path();
            let relative = relative_vault_path(&root, &path);
            if file_type.is_dir() {
                let has_children = fs::read_dir(&path)
                    .map(|mut children| children.next().is_some())
                    .unwrap_or(false);
                if has_children {
                    stack.push((path, depth + 1));
                }
            } else if file_type.is_file() {
                let haystack = relative.to_lowercase();
                if terms.iter().all(|term| haystack.contains(term)) {
                    results.push(VaultEntry {
                        name,
                        path: relative,
                        absolute_path: path.to_string_lossy().into_owned(),
                        kind: "file".to_string(),
                        has_children: false,
                    });
                }
            }
        }
    }

    results.sort_by(|a, b| a.path.to_lowercase().cmp(&b.path.to_lowercase()));
    results.truncate(MAX_SEARCH_RESULTS);
    Ok(results)
}

fn vault_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?
        .join("vault.json"))
}

/// Read a file chosen by the user through the native dialog or drag-and-drop.
///
/// The frontend receives raw bytes rather than a filesystem URL, so no broad
/// filesystem permission is exposed to the webview. Paths are absolute because
/// they always originate from a native picker or an OS drop event.
#[tauri::command]
fn read_file(path: String) -> Result<Response, String> {
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("Only absolute file paths can be opened.".into());
    }

    let metadata = fs::metadata(&path)
        .map_err(|error| format!("Could not open “{}”: {error}", display_name(&path)))?;
    if !metadata.is_file() {
        return Err("The selected path is not a file.".into());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err("This file is larger than the 512 MB viewer limit.".into());
    }
    if metadata.len() == 0 {
        return Err("This file is empty.".into());
    }

    let bytes = fs::read(&path)
        .map_err(|error| format!("Could not read “{}”: {error}", display_name(&path)))?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn get_vault(state: State<'_, VaultState>) -> Result<Option<VaultInfo>, String> {
    let guard = state
        .root
        .lock()
        .map_err(|_| "The library configuration is unavailable.".to_string())?;
    match guard.as_ref() {
        Some(root) if root.is_dir() => Ok(Some(vault_info(root)?)),
        _ => Ok(None),
    }
}

#[tauri::command]
fn default_vault_path(app: tauri::AppHandle) -> Result<String, String> {
    if let Ok(documents) = app.path().document_dir() {
        return Ok(documents.join("Library").to_string_lossy().into_owned());
    }
    let data = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    Ok(data.join("Library").to_string_lossy().into_owned())
}

#[tauri::command]
fn validate_vault(path: String) -> Result<VaultInfo, String> {
    vault_info(&absolute_path(&path)?)
}

#[tauri::command]
fn create_vault(path: String) -> Result<VaultInfo, String> {
    let path = absolute_path(&path)?;
    fs::create_dir_all(&path)
        .map_err(|error| format!("Could not create “{}”: {error}", path.display()))?;
    vault_info(&path)
}

#[tauri::command]
fn set_vault(
    path: String,
    state: State<'_, VaultState>,
    app: tauri::AppHandle,
) -> Result<VaultInfo, String> {
    let info = vault_info(&absolute_path(&path)?)?;
    if !info.writable {
        return Err("Hippocodex needs read and write access to this folder.".into());
    }

    let config_path = vault_config_path(&app)?;
    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not save the library setting: {error}"))?;
    }
    let stored = serde_json::to_string(&StoredVault {
        path: info.path.clone(),
    })
    .map_err(|error| error.to_string())?;
    fs::write(&config_path, stored)
        .map_err(|error| format!("Could not save the library setting: {error}"))?;

    let mut guard = state
        .root
        .lock()
        .map_err(|_| "The library configuration is unavailable.".to_string())?;
    *guard = Some(PathBuf::from(&info.path));
    Ok(info)
}

#[tauri::command]
fn clear_vault(state: State<'_, VaultState>, app: tauri::AppHandle) -> Result<(), String> {
    let config_path = vault_config_path(&app)?;
    if config_path.exists() {
        fs::remove_file(&config_path)
            .map_err(|error| format!("Could not clear the library setting: {error}"))?;
    }
    let mut guard = state
        .root
        .lock()
        .map_err(|_| "The library configuration is unavailable.".to_string())?;
    *guard = None;
    Ok(())
}

/// List one directory of the vault. Children are loaded lazily by the UI.
#[tauri::command]
fn list_vault_entries(
    path: String,
    state: State<'_, VaultState>,
) -> Result<Vec<VaultEntry>, String> {
    let root = {
        let guard = state
            .root
            .lock()
            .map_err(|_| "The library configuration is unavailable.".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "Choose a library folder in Settings first.".to_string())?
    };
    let directory = resolve_in_vault(&root, &path)?;
    let parent_relative = path.trim().replace('\\', "/");
    let mut entries = Vec::new();

    for item in fs::read_dir(&directory)
        .map_err(|error| format!("Could not list “{}”: {error}", directory.display()))?
    {
        let item = item.map_err(|error| error.to_string())?;
        let name = item.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }
        let file_type = item.file_type().map_err(|error| error.to_string())?;
        let kind = if file_type.is_dir() {
            "directory"
        } else if file_type.is_file() {
            "file"
        } else {
            continue;
        };
        let relative = if parent_relative.is_empty() {
            name.clone()
        } else {
            format!("{parent_relative}/{name}")
        };
        let has_children = kind == "directory"
            && fs::read_dir(item.path())
                .map(|mut children| children.next().is_some())
                .unwrap_or(false);
        entries.push(VaultEntry {
            name,
            path: relative,
            absolute_path: item.path().to_string_lossy().into_owned(),
            kind: kind.to_string(),
            has_children,
        });
    }

    entries.sort_by(|a, b| match (a.kind.as_str(), b.kind.as_str()) {
        ("directory", "file") => std::cmp::Ordering::Less,
        ("file", "directory") => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });
    Ok(entries)
}

/// Create a Markdown or plain-text note in the configured Library and return
/// its absolute path for the normal document-opening flow. Never overwrites an
/// existing file, and the name cannot escape the Library root.
#[tauri::command]
fn create_note(
    name: String,
    format: String,
    state: State<'_, VaultState>,
) -> Result<CreatedNote, String> {
    let root = {
        let guard = state
            .root
            .lock()
            .map_err(|_| "The library configuration is unavailable.".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "Choose a library folder in Settings first.".to_string())?
    };
    create_note_in(&root, &name, &format)
}

fn create_note_in(root: &Path, name: &str, format: &str) -> Result<CreatedNote, String> {
    let root = canonical_directory(root)?;
    let stem = note_stem(name)?;
    let file_name = note_file_name(&stem, format)?;
    let target = root.join(&file_name);

    // symlink_metadata also catches dangling symlinks, which `exists()` misses.
    if fs::symlink_metadata(&target).is_ok() {
        return Err("A file with that name already exists in the Library.".into());
    }
    if !is_writable(&root) {
        return Err("Hippocodex needs write access to this Library folder.".into());
    }
    fs::write(&target, note_contents(&stem, format))
        .map_err(|error| format!("Could not create “{file_name}”: {error}"))?;

    Ok(CreatedNote {
        path: target.to_string_lossy().into_owned(),
        name: file_name.clone(),
        relative_path: file_name,
    })
}

/// Save edits back to an existing note. The webview supplies only the absolute
/// path of a note it already opened; confinement is checked again here.
#[tauri::command]
fn update_note(path: String, contents: String, state: State<'_, VaultState>) -> Result<(), String> {
    let root = {
        let guard = state
            .root
            .lock()
            .map_err(|_| "The library configuration is unavailable.".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "Choose a library folder in Settings first.".to_string())?
    };
    update_note_in(&root, &path, &contents)
}

/// Search file names and relative paths across the whole configured Library.
#[tauri::command]
fn search_vault_files(
    query: String,
    state: State<'_, VaultState>,
) -> Result<Vec<VaultEntry>, String> {
    let root = {
        let guard = state
            .root
            .lock()
            .map_err(|_| "The library configuration is unavailable.".to_string())?;
        guard
            .clone()
            .ok_or_else(|| "Choose a library folder in Settings first.".to_string())?
    };
    search_vault_files_in(&root, &query)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config_path = vault_config_path(app.handle())?;
            let root = fs::read_to_string(&config_path)
                .ok()
                .and_then(|contents| serde_json::from_str::<StoredVault>(&contents).ok())
                .map(|stored| PathBuf::from(stored.path))
                .filter(|path| path.is_dir());
            app.manage(VaultState {
                root: Mutex::new(root),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            get_vault,
            default_vault_path,
            validate_vault,
            create_vault,
            set_vault,
            clear_vault,
            list_vault_entries,
            create_note,
            update_note,
            search_vault_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hippocodex");
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `Response` deliberately does not implement `Debug`, so unwrap_err is not available.
    fn expect_error(result: Result<Response, String>) -> String {
        match result {
            Ok(_) => panic!("expected the read to fail"),
            Err(error) => error,
        }
    }

    fn temp_vault(name: &str) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("hippocodex-vault-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn rejects_relative_paths() {
        let error = expect_error(read_file("relative.pdf".into()));
        assert!(error.contains("absolute"));
    }

    #[test]
    fn rejects_directories() {
        let error = expect_error(read_file(
            std::env::temp_dir().to_string_lossy().into_owned(),
        ));
        assert!(error.contains("not a file"));
    }

    #[test]
    fn reads_an_absolute_file() {
        let path = std::env::temp_dir().join(format!("hippocodex-test-{}.txt", std::process::id()));
        std::fs::write(&path, b"memory and navigation").unwrap();
        let result = read_file(path.to_string_lossy().into_owned());
        let _ = std::fs::remove_file(&path);
        assert!(result.is_ok());
    }

    #[test]
    fn rejects_empty_files() {
        let path =
            std::env::temp_dir().join(format!("hippocodex-empty-{}.txt", std::process::id()));
        std::fs::write(&path, b"").unwrap();
        let error = expect_error(read_file(path.to_string_lossy().into_owned()));
        let _ = std::fs::remove_file(&path);
        assert!(error.contains("empty"));
    }

    #[test]
    fn display_name_handles_missing_file_names() {
        assert_eq!(display_name(Path::new("/tmp/paper.pdf")), "paper.pdf");
        assert_eq!(display_name(Path::new("/")), "/");
    }

    #[test]
    fn vault_paths_must_be_absolute() {
        assert!(absolute_path("").is_err());
        assert!(absolute_path("  ").is_err());
        assert!(absolute_path("vault/notes").is_err());
        assert!(absolute_path("/tmp/vault").is_ok());
    }

    #[test]
    fn vault_lookup_stays_inside_the_root() {
        let root = temp_vault("confinement");
        fs::create_dir_all(root.join("papers")).unwrap();
        fs::write(root.join("papers/note.md"), b"hello").unwrap();

        assert_eq!(
            resolve_in_vault(&root, "papers").unwrap(),
            root.join("papers").canonicalize().unwrap()
        );
        assert!(resolve_in_vault(&root, "../elsewhere").is_err());
        assert!(resolve_in_vault(&root, "papers/../../elsewhere").is_err());
        assert!(resolve_in_vault(&root, &std::env::temp_dir().to_string_lossy()).is_err());
        assert!(resolve_in_vault(&root, "missing").is_err());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn vault_info_reports_a_real_writable_directory() {
        let root = temp_vault("info");
        let info = vault_info(&root).unwrap();
        assert_eq!(info.path, root.canonicalize().unwrap().to_string_lossy());
        assert_eq!(info.name, root.file_name().unwrap().to_string_lossy());
        assert!(info.exists);
        assert!(info.writable);
        assert!(vault_info(&root.join("note.md")).is_err());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn note_names_cannot_escape_the_library() {
        assert_eq!(note_stem("  Ideas.md  ").unwrap(), "Ideas");
        assert_eq!(note_file_name("Ideas", "md").unwrap(), "Ideas.md");
        assert_eq!(note_file_name("Ideas", "txt").unwrap(), "Ideas.txt");
        assert!(note_file_name("Ideas", "exe").is_err());
        assert!(note_stem("").is_err());
        assert!(note_stem(".hidden").is_err());
        assert!(note_stem("../escape").is_err());
        assert!(note_stem("sub/note").is_err());
        assert!(note_stem("C:\\notes").is_err());
        assert!(note_stem("bad\u{0000}name").is_err());
    }

    #[test]
    fn create_note_writes_inside_the_library_and_never_overwrites() {
        let root = temp_vault("create-note");
        let created = create_note_in(&root, " Lecture notes ", "md").unwrap();
        assert_eq!(created.name, "Lecture notes.md");
        assert_eq!(created.relative_path, "Lecture notes.md");
        assert_eq!(
            created.path,
            root.join("Lecture notes.md")
                .canonicalize()
                .unwrap()
                .to_string_lossy()
        );
        assert_eq!(
            fs::read_to_string(root.join("Lecture notes.md")).unwrap(),
            "# Lecture notes\n\n"
        );

        let plain = create_note_in(&root, "scratch.txt", "txt").unwrap();
        assert_eq!(plain.name, "scratch.txt");
        assert_eq!(
            fs::read_to_string(root.join("scratch.txt")).unwrap(),
            "scratch\n\n"
        );

        let error = create_note_in(&root, "Lecture notes.md", "md").unwrap_err();
        assert!(error.contains("already exists"));
        assert!(create_note_in(&root, "../outside", "md").is_err());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn note_edits_are_confined_and_exact() {
        let root = temp_vault("update-note");
        let target = root.join("Lecture notes.md");
        fs::write(&target, "# old\n").unwrap();

        update_note_in(
            &root,
            &target.to_string_lossy(),
            "# Edited\n\nMore detail.\n",
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(&target).unwrap(),
            "# Edited\n\nMore detail.\n"
        );

        let outside =
            std::env::temp_dir().join(format!("hippocodex-outside-{}.md", std::process::id()));
        fs::write(&outside, "secret").unwrap();
        let error = update_note_in(&root, &outside.to_string_lossy(), "changed").unwrap_err();
        assert!(error.contains("outside"));
        let _ = fs::remove_file(&outside);

        assert!(update_note_in(&root, "relative.md", "x").is_err());

        let unsupported = root.join("paper.pdf");
        fs::write(&unsupported, "pdf").unwrap();
        assert!(update_note_in(&root, &unsupported.to_string_lossy(), "x").is_err());

        let too_large = "x".repeat(MAX_NOTE_BYTES + 1);
        assert!(update_note_in(&root, &target.to_string_lossy(), &too_large).is_err());
        assert_eq!(
            fs::read_to_string(&target).unwrap(),
            "# Edited\n\nMore detail.\n"
        );

        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn symlinked_notes_cannot_be_edited() {
        let root = temp_vault("symlink-note");
        let target = root.join("note.md");
        fs::write(&target, "original").unwrap();
        let link = root.join("link.md");
        std::os::unix::fs::symlink(&target, &link).unwrap();

        let error = update_note_in(&root, &link.to_string_lossy(), "changed").unwrap_err();
        assert!(error.contains("Symlink"));
        assert_eq!(fs::read_to_string(&target).unwrap(), "original");

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn library_search_finds_nested_files_by_name_and_path() {
        let root = temp_vault("search");
        fs::create_dir_all(root.join("medicine/2026")).unwrap();
        fs::create_dir_all(root.join(".hidden")).unwrap();
        fs::write(root.join("medicine/2026/lecture notes.md"), b"notes").unwrap();
        fs::write(root.join("medicine/case.txt"), b"case").unwrap();
        fs::write(root.join(".hidden/secret.md"), b"secret").unwrap();

        let found = search_vault_files_in(&root, "LECture").unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].name, "lecture notes.md");
        assert_eq!(found[0].path, "medicine/2026/lecture notes.md");

        let multi_term = search_vault_files_in(&root, "2026 notes").unwrap();
        assert_eq!(multi_term.len(), 1);
        assert_eq!(multi_term[0].path, "medicine/2026/lecture notes.md");

        assert!(search_vault_files_in(&root, "   ").unwrap().is_empty());
        assert!(search_vault_files_in(&root, "secret").unwrap().is_empty());

        let _ = fs::remove_dir_all(&root);
    }
}
