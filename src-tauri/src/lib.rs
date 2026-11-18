use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::thread::sleep;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// File passed on the command line (double-click, "Open with...", etc.).
struct StartupFile(Mutex<Option<String>>);

fn is_deck_argument(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.ends_with(".markpoint") || lower.ends_with(".md") || lower.ends_with(".markdown")
}

fn deck_argument(args: &[String]) -> Option<String> {
    args.iter()
        .skip(1)
        .find(|argument| is_deck_argument(argument))
        .cloned()
}

#[tauri::command]
fn take_startup_file(state: tauri::State<'_, StartupFile>) -> Option<String> {
    state
        .0
        .lock()
        .ok()
        .and_then(|mut startup| startup.take())
}

#[derive(serde::Serialize)]
struct DataRoot {
    root: String,
    portable: bool,
}

fn is_writable(directory: &Path) -> bool {
    let probe = directory.join(".markpoint-write-test");
    match fs::write(&probe, b"ok") {
        Ok(_) => {
            let _ = fs::remove_file(&probe);
            true
        }
        Err(_) => false,
    }
}

/// Resolves where user data lives. The portable build keeps its themes and
/// recovery draft next to the executable; the installed build uses app data.
#[tauri::command]
fn data_root(app: tauri::AppHandle) -> Result<DataRoot, String> {
    if !cfg!(debug_assertions) {
        if let Ok(executable) = std::env::current_exe() {
            if let Some(directory) = executable.parent() {
                let installed = directory.join("uninstall.exe").exists();
                if !installed {
                    let root = directory.join("MarkPointData");
                    if fs::create_dir_all(&root).is_ok() && is_writable(&root) {
                        return Ok(DataRoot {
                            root: root.to_string_lossy().into_owned(),
                            portable: true,
                        });
                    }
                }
            }
        }
    }

    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not resolve the app data directory: {error}"))?;
    fs::create_dir_all(&root)
        .map_err(|error| format!("Could not create the app data directory: {error}"))?;
    Ok(DataRoot {
        root: root.to_string_lossy().into_owned(),
        portable: false,
    })
}

fn browser_candidates() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(
            Path::new(&program_files).join("Microsoft/Edge/Application/msedge.exe"),
        );
        candidates.push(
            Path::new(&program_files).join("Google/Chrome/Application/chrome.exe"),
        );
    }
    if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
        candidates.push(
            Path::new(&program_files_x86).join("Microsoft/Edge/Application/msedge.exe"),
        );
        candidates.push(
            Path::new(&program_files_x86).join("Google/Chrome/Application/chrome.exe"),
        );
    }
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates.push(
            Path::new(&local_app_data).join("Microsoft/Edge/Application/msedge.exe"),
        );
        candidates.push(
            Path::new(&local_app_data).join("Google/Chrome/Application/chrome.exe"),
        );
    }

    candidates.push(PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"));
    candidates.push(PathBuf::from("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"));
    candidates.push(PathBuf::from("/usr/bin/google-chrome"));
    candidates.push(PathBuf::from("/usr/bin/google-chrome-stable"));
    candidates.push(PathBuf::from("/usr/bin/chromium"));
    candidates.push(PathBuf::from("/usr/bin/chromium-browser"));
    candidates.push(PathBuf::from("/usr/bin/microsoft-edge"));

    candidates
}

fn wait_for_pdf(path: &Path) -> bool {
    for _ in 0..60 {
        if let Ok(metadata) = fs::metadata(path) {
            if metadata.len() > 0 {
                return true;
            }
        }
        sleep(Duration::from_millis(100));
    }
    false
}

fn cleanup(dir: &Path) {
    let _ = fs::remove_dir_all(dir);
}

/// Renders a print-ready HTML document to PDF using Edge/Chrome in headless mode.
/// Keeps a 16:9 page per slide with no headers, footers or margins.
#[tauri::command]
fn export_pdf(html: String, out_path: String) -> Result<(), String> {
    let requested = PathBuf::from(&out_path);
    let out = if requested.is_absolute() {
        requested
    } else {
        std::env::current_dir()
            .map_err(|error| format!("Could not resolve the output path: {error}"))?
            .join(requested)
    };

    if let Some(parent) = out.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Could not create the output directory: {error}"))?;
        }
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let work = std::env::temp_dir().join(format!("markpoint-pdf-{}-{stamp}", std::process::id()));
    fs::create_dir_all(&work)
        .map_err(|error| format!("Could not create a temporary directory: {error}"))?;

    let html_path = work.join("deck.html");
    fs::write(&html_path, html.as_bytes())
        .map_err(|error| format!("Could not write the temporary HTML file: {error}"))?;

    let file_url = url::Url::from_file_path(&html_path)
        .map_err(|_| "Could not build a file URL for the temporary document".to_string())?;

    let profile = work.join("profile");
    let partial = work.join("render.pdf");
    let mut errors: Vec<String> = Vec::new();

    for browser in browser_candidates() {
        if !browser.exists() {
            continue;
        }

        for headless in ["--headless=new", "--headless"] {
            let _ = fs::remove_file(&partial);

            let mut command = Command::new(&browser);
            command
                .arg(headless)
                .arg("--disable-gpu")
                .arg("--disable-extensions")
                .arg("--disable-background-networking")
                .arg("--no-first-run")
                .arg("--no-default-browser-check")
                .arg("--no-pdf-header-footer")
                .arg("--print-to-pdf-no-header")
                .arg("--virtual-time-budget=20000")
                .arg(format!("--user-data-dir={}", profile.display()))
                .arg(format!("--print-to-pdf={}", partial.display()))
                .arg(file_url.as_str());

            #[cfg(windows)]
            command.creation_flags(CREATE_NO_WINDOW);

            match command.output() {
                Ok(output) if output.status.success() => {
                    if wait_for_pdf(&partial) {
                        if let Err(error) = fs::copy(&partial, &out) {
                            cleanup(&work);
                            return Err(format!(
                                "Could not write the PDF to the selected path: {error}"
                            ));
                        }
                        cleanup(&work);
                        return Ok(());
                    }
                    errors.push(format!("{}: the PDF file was not created", browser.display()));
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    errors.push(format!(
                        "{} ({}): {}",
                        browser.display(),
                        output.status,
                        stderr.trim()
                    ));
                }
                Err(error) => {
                    errors.push(format!("{}: {error}", browser.display()));
                }
            }
        }
    }

    cleanup(&work);
    Err(format!(
        "Could not export the PDF. Microsoft Edge or Google Chrome is required.\n\n{}",
        errors.join("\n")
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_file = deck_argument(&std::env::args().collect::<Vec<_>>());

    tauri::Builder::default()
        // Single-instance must be the first plugin so a second double-click
        // forwards its file argument to the running window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = deck_argument(&argv) {
                let _ = app.emit("open-file", path);
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(StartupFile(Mutex::new(startup_file)))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            export_pdf,
            take_startup_file,
            data_root
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}
