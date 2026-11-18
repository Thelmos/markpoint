import { invoke } from "@tauri-apps/api/core";
import { isDesktop } from "./tauri";

let cached: Promise<string> | null = null;

/**
 * Folder that stores user data (theme library, recovery draft). On the
 * portable build it lives next to the executable; the installed build uses
 * the app data directory.
 */
export function dataRoot(): Promise<string> {
  if (!isDesktop) return Promise.resolve("");
  if (!cached) {
    cached = invoke<{ root: string; portable: boolean }>("data_root")
      .then((info) => info.root)
      .catch(() => "");
  }
  return cached;
}
