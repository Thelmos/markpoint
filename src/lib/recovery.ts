import { appDataDir, join } from "@tauri-apps/api/path";
import { mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { isDesktop } from "./tauri";

const RECOVERY_FILE = "recovery.markpoint";

async function recoveryPath(): Promise<string> {
  const directory = await appDataDir();
  return join(directory, RECOVERY_FILE);
}

/** Returns the last autosaved draft for an untitled project, if any. */
export async function readRecoveryDraft(): Promise<Uint8Array | null> {
  if (!isDesktop) return null;
  try {
    return await readFile(await recoveryPath());
  } catch {
    return null;
  }
}

export async function writeRecoveryDraft(bytes: Uint8Array): Promise<void> {
  if (!isDesktop) return;
  const path = await recoveryPath();
  await mkdir(await appDataDir(), { recursive: true });
  await writeFile(path, bytes);
}

export async function deleteRecoveryDraft(): Promise<void> {
  if (!isDesktop) return;
  try {
    await remove(await recoveryPath());
  } catch {
    /* already gone */
  }
}
