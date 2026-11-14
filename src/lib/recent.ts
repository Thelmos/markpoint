import type { ThemeId } from "../types";

export interface RecentFile {
  path: string;
  title: string;
  theme: ThemeId;
  openedAt: number;
}

const KEY = "markpoint.recent";
const MAX_RECENT = 8;
const THEMES: ThemeId[] = ["light", "dark", "ocean", "sand"];

function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEMES as string[]).includes(value);
}

export function loadRecent(): RecentFile[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentFile =>
          Boolean(item) &&
          typeof item.path === "string" &&
          typeof item.title === "string" &&
          typeof item.openedAt === "number" &&
          isTheme(item.theme),
      )
      .sort((a, b) => b.openedAt - a.openedAt)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function save(list: RecentFile[]): RecentFile[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore quota / private mode */
  }
  return list;
}

export function rememberRecent(entry: Omit<RecentFile, "openedAt">): RecentFile[] {
  const list = loadRecent().filter((item) => item.path !== entry.path);
  return save([{ ...entry, openedAt: Date.now() }, ...list].slice(0, MAX_RECENT));
}

export function forgetRecent(path: string): RecentFile[] {
  return save(loadRecent().filter((item) => item.path !== path));
}
