import { join } from "@tauri-apps/api/path";
import { mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { dataRoot } from "./dataRoot";
import { isDesktop } from "./tauri";

const RECOVERY_FILE = "recovery.markpoint";

async function recoveryTarget(): Promise<{ root: string; path: string } | null> {
  const root = await dataRoot();
  if (!root) return null;
  return { root, path: await join(root, RECOVERY_FILE) };
}

/** Returns the last autosaved draft for an untitled project, if any. */
export async function readRecoveryDraft(): Promise<Uint8Array | null> {
  if (!isDesktop) return null;
  const target = await recoveryTarget();
  if (!target) return null;
  try {
    return await readFile(target.path);
  } catch {
    return null;
  }
}

export async function writeRecoveryDraft(bytes: Uint8Array): Promise<void> {
  if (!isDesktop) return;
  const target = await recoveryTarget();
  if (!target) return;
  await mkdir(target.root, { recursive: true }).catch(() => undefined);
  await writeFile(target.path, bytes);
}

export async function deleteRecoveryDraft(): Promise<void> {
  if (!isDesktop) return;
  const target = await recoveryTarget();
  if (!target) return;
  try {
    await remove(target.path);
  } catch {
    /* already gone */
  }
}
