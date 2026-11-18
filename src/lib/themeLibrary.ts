import { join } from "@tauri-apps/api/path";
import { mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import type { ResolvedTheme, ThemeFont, ThemeSpec } from "../types";
import { base64ToBytes, bytesToBase64, bytesToText, textToBytes } from "./assets";
import { dataRoot } from "./dataRoot";
import { specFromResolved } from "./themes";

export interface StoredFont {
  family: string;
  fileName: string;
  weight?: string;
  style?: "normal" | "italic";
  /** Base64 of the woff2 file, so a theme travels on its own. */
  data: string;
}

export interface StoredTheme {
  id: string;
  name: string;
  /** Theme values without font references; fonts are stored separately. */
  spec: ThemeSpec;
  fonts: StoredFont[];
}

const FILE = "themes.json";
const STORAGE_KEY = "markpoint.themes";
const MAX_FILE_BYTES = 8_000_000;
const MAX_FONT_BYTES = 4_000_000;

export function createThemeId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "tema"}-${Date.now().toString(36)}`;
}

function isBase64(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_FONT_BYTES && /^[a-z0-9+/=\s]+$/i.test(value);
}

function normalizeFont(raw: unknown): StoredFont | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const font = raw as Record<string, unknown>;
  if (typeof font.family !== "string" || !/^[-a-z0-9 _]{1,60}$/i.test(font.family.trim())) return null;
  if (typeof font.fileName !== "string" || !/^[^\\/]+\.(?:woff2|woff|ttf|otf)$/i.test(font.fileName)) {
    return null;
  }
  if (!isBase64(font.data)) return null;
  const stored: StoredFont = {
    family: font.family.trim(),
    fileName: font.fileName,
    data: font.data.replace(/\s+/g, ""),
  };
  if (typeof font.weight === "string" && /^(?:[1-9]00|normal|bold)$/.test(font.weight)) {
    stored.weight = font.weight;
  }
  if (font.style === "italic") stored.style = "italic";
  return stored;
}

function normalizeTheme(raw: unknown): StoredTheme | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const theme = raw as Record<string, unknown>;
  if (typeof theme.name !== "string" || !theme.name.trim()) return null;
  if (!theme.spec || typeof theme.spec !== "object" || Array.isArray(theme.spec)) return null;
  const fonts: StoredFont[] = [];
  if (Array.isArray(theme.fonts)) {
    for (const item of theme.fonts.slice(0, 12)) {
      const font = normalizeFont(item);
      if (font) fonts.push(font);
    }
  }
  const id =
    typeof theme.id === "string" && /^[a-z0-9-]{1,80}$/i.test(theme.id)
      ? theme.id
      : createThemeId(theme.name);
  return {
    id,
    name: theme.name.trim().slice(0, 80),
    spec: theme.spec as ThemeSpec,
    fonts,
  };
}

async function readRaw(): Promise<string | null> {
  const root = await dataRoot();
  if (root) {
    try {
      return bytesToText(await readFile(await join(root, FILE)));
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

async function writeRaw(text: string): Promise<void> {
  const root = await dataRoot();
  if (root) {
    await mkdir(root, { recursive: true });
    await writeFile(await join(root, FILE), textToBytes(text));
    return;
  }
  localStorage.setItem(STORAGE_KEY, text);
}

export async function loadThemes(): Promise<StoredTheme[]> {
  try {
    const raw = await readRaw();
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === "object" && Array.isArray((parsed as { themes?: unknown }).themes)
        ? ((parsed as { themes: unknown[] }).themes)
        : [];
    return list.map(normalizeTheme).filter((theme): theme is StoredTheme => Boolean(theme));
  } catch {
    return [];
  }
}

export async function saveThemes(themes: StoredTheme[]): Promise<void> {
  await writeRaw(JSON.stringify({ version: 1, themes }, null, 2));
}

/** Captures the resolved theme and copies its font bytes into the record. */
export function storeCurrentTheme(
  name: string,
  theme: ResolvedTheme,
  files: Map<string, Uint8Array>,
): StoredTheme {
  const byName = new Map<string, Uint8Array>();
  for (const [path, bytes] of files) {
    const fileName = path.split("/").pop();
    if (fileName && !byName.has(fileName)) byName.set(fileName, bytes);
  }

  const fonts: StoredFont[] = [];
  for (const font of theme.fonts) {
    const bytes =
      files.get(font.file) ??
      files.get(`assets/${font.file}`) ??
      byName.get(font.file.split("/").pop() ?? "");
    if (!bytes) continue;
    fonts.push({
      family: font.family,
      fileName: font.file.split("/").pop() ?? `${font.family}.woff2`,
      weight: font.weight,
      style: font.style,
      data: bytesToBase64(bytes),
    });
  }

  return {
    id: createThemeId(name),
    name: name.trim().slice(0, 80),
    spec: specFromResolved(theme, { name: name.trim().slice(0, 80), fonts: [] }),
    fonts,
  };
}

/** Rebuilds a spec and adds its fonts to the current project. */
export function applyStoredTheme(
  theme: StoredTheme,
  addFont: (fileName: string, bytes: Uint8Array) => string,
): ThemeSpec {
  const fonts: ThemeFont[] = [];
  for (const font of theme.fonts) {
    fonts.push({
      family: font.family,
      file: addFont(font.fileName, base64ToBytes(font.data)),
      weight: font.weight,
      style: font.style,
    });
  }
  return {
    ...(() => {
      const spec: ThemeSpec = { ...theme.spec };
      delete spec.fonts;
      return spec;
    })(),
    name: theme.name,
    ...(fonts.length > 0 ? { fonts } : {}),
  };
}

export function encodeTheme(theme: StoredTheme): Uint8Array {
  return textToBytes(JSON.stringify(theme, null, 2));
}

export function decodeTheme(bytes: Uint8Array): StoredTheme {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error("The theme file is too large");
  const parsed: unknown = JSON.parse(bytesToText(bytes));
  const theme = normalizeTheme(parsed);
  if (!theme) throw new Error("The theme file is not valid");
  return { ...theme, id: createThemeId(theme.name) };
}
