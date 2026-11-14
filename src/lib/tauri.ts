import { invoke, isTauri as tauriIsTauri } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  availableMonitors,
  currentMonitor,
  getCurrentWindow,
  type Monitor,
} from "@tauri-apps/api/window";
import { ask, message as messageDialog, open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { openUrl } from "@tauri-apps/plugin-opener";

export const isDesktop = tauriIsTauri();

export interface PickedFile {
  path: string | null;
  name: string;
  bytes: Uint8Array;
}

function pickInBrowser(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener("change", () => finish(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => finish(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickProjectFile(): Promise<PickedFile | null> {
  if (isDesktop) {
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: [
        { name: "MarkPoint", extensions: ["markpoint"] },
        { name: "Markdown", extensions: ["md", "markdown"] },
      ],
    });
    if (typeof selected !== "string") return null;
    const bytes = await readFile(selected);
    const name = selected.replace(/\\/g, "/").split("/").pop() ?? selected;
    return { path: selected, name, bytes };
  }

  const file = await pickInBrowser(".markpoint,.md,.markdown,application/zip,text/markdown");
  if (!file) return null;
  return { path: null, name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
}

export async function readFilePath(path: string): Promise<Uint8Array> {
  if (isDesktop) return readFile(path);
  throw new Error("Reading a path is only available in the desktop app");
}

export async function pickSavePath(
  defaultName: string,
  filterName: string,
  extensions: string[],
): Promise<string | null> {
  if (!isDesktop) return defaultName;
  return saveDialog({
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions }],
  });
}

export function downloadBytes(name: string, bytes: Uint8Array, mime = "application/octet-stream"): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function writeFilePath(path: string, bytes: Uint8Array): Promise<void> {
  if (isDesktop) {
    await writeFile(path, bytes);
  } else {
    downloadBytes(path, bytes);
  }
}

export async function confirmDialog(
  message: string,
  options: { title?: string; okLabel?: string; cancelLabel?: string; kind?: "info" | "warning" | "error" } = {},
): Promise<boolean> {
  if (!isDesktop) return window.confirm(message);
  return ask(message, {
    title: options.title ?? "MarkPoint",
    kind: options.kind ?? "warning",
    okLabel: options.okLabel,
    cancelLabel: options.cancelLabel,
  });
}

export async function showError(message: string, detail?: string): Promise<void> {
  const text = detail ? `${message}\n\n${detail}` : message;
  if (!isDesktop) {
    window.alert(text);
    return;
  }
  await messageDialog(text, { title: "MarkPoint", kind: "error" });
}

export async function openExternal(url: string): Promise<void> {
  if (isDesktop) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function setWindowFullscreen(value: boolean): Promise<void> {
  if (isDesktop) {
    await getCurrentWindow().setFullscreen(value);
    return;
  }
  if (value) {
    await document.documentElement.requestFullscreen?.().catch(() => undefined);
  } else if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
  }
}

export async function setWindowTitle(title: string): Promise<void> {
  document.title = title;
  if (isDesktop) {
    await getCurrentWindow().setTitle(title).catch(() => undefined);
  }
}

export interface CloseGuard {
  unlisten: () => void;
}

export function onCloseRequested(handler: () => boolean | Promise<boolean>): CloseGuard {
  if (!isDesktop) return { unlisten: () => undefined };
  let unlisten: (() => void) | undefined;
  let closing = false;
  getCurrentWindow()
    .onCloseRequested(async (event) => {
      if (closing) return;
      // Prevent the close immediately: deciding may require a native dialog.
      event.preventDefault();
      const allowed = await handler();
      if (!allowed) return;
      closing = true;
      await getCurrentWindow().destroy();
    })
    .then((fn) => {
      unlisten = fn;
    })
    .catch(() => undefined);
  return {
    unlisten: () => {
      unlisten?.();
    },
  };
}

export function onFileDrop(handler: (paths: string[]) => void): CloseGuard {
  if (!isDesktop) return { unlisten: () => undefined };
  let unlisten: (() => void) | undefined;
  getCurrentWebview()
    .onDragDropEvent((event) => {
      if (event.payload.type === "drop" && event.payload.paths.length > 0) {
        handler(event.payload.paths);
      }
    })
    .then((fn) => {
      unlisten = fn;
    })
    .catch(() => undefined);
  return {
    unlisten: () => {
      unlisten?.();
    },
  };
}

export async function exportPdf(html: string, outPath: string): Promise<void> {
  if (!isDesktop) throw new Error("PDF export is only available in the desktop app");
  await invoke("export_pdf", { html, outPath });
}

/** A file passed by the OS/installer (double-click, command line, etc.). */
export async function takeStartupFile(): Promise<string | null> {
  if (!isDesktop) return null;
  return invoke<string | null>("take_startup_file");
}

/** Subscribes to a Tauri event and returns an unlisten function. */
export async function listenDesktop<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (!isDesktop) return () => undefined;
  const unlisten = await listen<T>(event, (message) => handler(message.payload));
  return unlisten;
}

export async function emitToDesktopWindow<T>(
  label: string,
  event: string,
  payload: T,
): Promise<void> {
  if (!isDesktop) return;
  await emitTo(label, event, payload);
}

export async function focusMainWindow(): Promise<void> {
  if (!isDesktop) return;
  await getCurrentWindow().setFocus().catch(() => undefined);
}

export interface AudienceWindowInfo {
  window: WebviewWindow;
  label: string;
  monitor: Monitor;
  monitorName: string;
}

/**
 * Creates a dedicated fullscreen window on a secondary monitor. Returns null
 * when there is only one monitor so the caller can fall back to the overlay.
 */
export async function createAudienceWindow(): Promise<AudienceWindowInfo | null> {
  if (!isDesktop) return null;

  const monitors = await availableMonitors();
  if (monitors.length < 2) return null;

  const current = await currentMonitor().catch(() => null);
  const target =
    monitors.find(
      (monitor) =>
        !current ||
        monitor.position.x !== current.position.x ||
        monitor.position.y !== current.position.y,
    ) ?? monitors[monitors.length - 1];

  const leftovers = (await WebviewWindow.getAll().catch(() => [])).filter((window) =>
    window.label.startsWith("audience"),
  );
  await Promise.all(leftovers.map((window) => window.close().catch(() => undefined)));

  const label = `audience-${Date.now().toString(36)}`;
  const window = new WebviewWindow(label, {
    // The audience app is selected by the window label, not the URL, because
    // Tauri app URLs treat "?query" as part of the asset path.
    url: "index.html",
    title: "MarkPoint — Audience",
    visible: false,
    decorations: false,
    skipTaskbar: true,
    focus: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: false,
    fullscreen: false,
  });

  await new Promise<void>((resolve, reject) => {
    void window.once("tauri://created", () => resolve());
    void window.once("tauri://error", (event) => {
      reject(new Error(`Could not create the audience window: ${String(event.payload)}`));
    });
  });

  return {
    window,
    label,
    monitor: target,
    monitorName: target.name || `Monitor ${monitors.indexOf(target) + 1}`,
  };
}

export function basename(path: string): string {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}
