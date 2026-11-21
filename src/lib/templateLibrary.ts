import { join } from "@tauri-apps/api/path";
import { mkdir, readDir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import {
  base64ToBytes,
  bytesToBase64,
  sanitizeFileName,
  textToBytes,
} from "./assets";
import { BUILTIN_TEMPLATE } from "./builtinTemplate";
import { dataRoot } from "./dataRoot";
import {
  TEMPLATE_ART_LAYOUTS,
  TEMPLATE_EXAMPLE_FILE,
  TEMPLATE_THEME_FILE,
  createTemplatePack,
  encodeTemplateZip,
  parseTemplateTheme,
  templateArchiveFromEntries,
  templateArtFileName,
  withTemplateName,
  type TemplateArtLayout,
  type TemplateArchive,
  type TemplatePack,
} from "./templates";

const BROWSER_KEY = "markpoint.templates";
const BROWSER_SEED_KEY = "markpoint.templates.seeded";
const SEED_MARKER = ".seeded";

interface StoredTemplate {
  id: string;
  name: string;
  description: string;
  themeYaml: string;
  example: string;
  arts: Partial<Record<TemplateArtLayout, string>>;
  fonts: Array<{ path: string; data: string }>;
}

function builtinArchive(): TemplateArchive {
  const arts: Partial<Record<TemplateArtLayout, Uint8Array>> = {};
  for (const layout of TEMPLATE_ART_LAYOUTS) {
    const bytes = BUILTIN_TEMPLATE.arts[layout];
    if (bytes) arts[layout] = bytes;
  }
  return {
    themeYaml: BUILTIN_TEMPLATE.themeYaml,
    example: BUILTIN_TEMPLATE.example,
    arts,
    fonts: BUILTIN_TEMPLATE.fonts,
  };
}

function builtinPack(): TemplatePack {
  return createTemplatePack(builtinArchive(), {
    id: BUILTIN_TEMPLATE.id,
    fallbackName: BUILTIN_TEMPLATE.name,
  });
}

async function templatesDirectory(): Promise<string | null> {
  const root = await dataRoot();
  if (!root) return null;
  return join(root, "templates");
}

async function readOptional(path: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

async function writeTemplateFolder(directory: string, pack: TemplatePack): Promise<void> {
  await mkdir(directory, { recursive: true });
  await writeFile(
    await join(directory, TEMPLATE_THEME_FILE),
    textToBytes(withTemplateName(pack.themeYaml, pack.name)),
  );
  await writeFile(await join(directory, TEMPLATE_EXAMPLE_FILE), textToBytes(pack.example));

  for (const layout of TEMPLATE_ART_LAYOUTS) {
    const bytes = pack.arts[layout];
    if (!bytes) continue;
    await writeFile(await join(directory, templateArtFileName(layout)), bytes);
  }

  if (pack.fonts.length > 0) {
    const fonts = await join(directory, "fonts");
    await mkdir(fonts, { recursive: true });
    for (const font of pack.fonts) {
      const target = await join(fonts, ...font.path.split("/"));
      const parent = target.replace(/[\\/][^\\/]+$/, "");
      await mkdir(parent, { recursive: true });
      await writeFile(target, font.bytes);
    }
  }
}

async function seedDesktop(directory: string): Promise<void> {
  const marker = await readOptional(await join(directory, SEED_MARKER));
  if (marker) return;
  const target = await join(directory, BUILTIN_TEMPLATE.id);
  const existing = await readOptional(await join(target, TEMPLATE_THEME_FILE));
  if (!existing) await writeTemplateFolder(target, builtinPack());
  await writeFile(await join(directory, SEED_MARKER), textToBytes("1"));
}

async function readTemplateFolder(directory: string, folder: string): Promise<TemplatePack | null> {
  const theme = await readOptional(await join(directory, TEMPLATE_THEME_FILE));
  const example = await readOptional(await join(directory, TEMPLATE_EXAMPLE_FILE));
  if (!theme || !example) return null;

  const entries = new Map<string, Uint8Array>();
  entries.set(TEMPLATE_THEME_FILE, theme);
  entries.set(TEMPLATE_EXAMPLE_FILE, example);
  for (const layout of TEMPLATE_ART_LAYOUTS) {
    const bytes = await readOptional(await join(directory, templateArtFileName(layout)));
    if (bytes) entries.set(templateArtFileName(layout), bytes);
  }

  try {
    const fontEntries = await readDir(await join(directory, "fonts"));
    for (const entry of fontEntries) {
      if (entry.isDirectory || entry.isSymlink) continue;
      const bytes = await readOptional(await join(directory, "fonts", entry.name));
      if (bytes) entries.set(`fonts/${entry.name}`, bytes);
    }
  } catch {
    /* templates without fonts */
  }

  try {
    const archive = templateArchiveFromEntries(entries, folder);
    return createTemplatePack(archive, { id: folder, fallbackName: folder });
  } catch {
    // A broken folder is skipped instead of breaking the whole gallery.
    return null;
  }
}

async function loadDesktop(): Promise<TemplatePack[]> {
  const directory = await templatesDirectory();
  if (!directory) return [];
  await mkdir(directory, { recursive: true }).catch(() => undefined);
  await seedDesktop(directory).catch(() => undefined);

  let entries;
  try {
    entries = await readDir(directory);
  } catch {
    return [];
  }

  const packs: TemplatePack[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory || entry.isSymlink || entry.name.startsWith(".")) continue;
    const pack = await readTemplateFolder(await join(directory, entry.name), entry.name);
    if (pack) packs.push(pack);
  }
  return packs.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

function loadBrowserRecords(): StoredTemplate[] {
  try {
    const raw = localStorage.getItem(BROWSER_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredTemplate => {
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return (
        typeof record.id === "string" &&
        typeof record.name === "string" &&
        typeof record.themeYaml === "string" &&
        typeof record.example === "string" &&
        Boolean(record.arts) &&
        typeof record.arts === "object" &&
        !Array.isArray(record.arts) &&
        Array.isArray(record.fonts) &&
        record.fonts.every(
          (font: unknown) =>
            Boolean(font) &&
            typeof (font as { path?: unknown }).path === "string" &&
            typeof (font as { data?: unknown }).data === "string",
        )
      );
    });
  } catch {
    return [];
  }
}

function saveBrowserRecords(records: StoredTemplate[]): void {
  localStorage.setItem(BROWSER_KEY, JSON.stringify(records));
}

function recordFromPack(pack: TemplatePack): StoredTemplate {
  const arts: Partial<Record<TemplateArtLayout, string>> = {};
  for (const layout of TEMPLATE_ART_LAYOUTS) {
    const bytes = pack.arts[layout];
    if (bytes) arts[layout] = bytesToBase64(bytes);
  }
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    themeYaml: withTemplateName(pack.themeYaml, pack.name),
    example: pack.example,
    arts,
    fonts: pack.fonts.map((font) => ({
      path: font.path,
      data: bytesToBase64(font.bytes),
    })),
  };
}

function packFromRecord(record: StoredTemplate): TemplatePack | null {
  try {
    const entries = new Map<string, Uint8Array>();
    entries.set(TEMPLATE_THEME_FILE, textToBytes(record.themeYaml));
    entries.set(TEMPLATE_EXAMPLE_FILE, textToBytes(record.example));
    for (const layout of TEMPLATE_ART_LAYOUTS) {
      const data = record.arts[layout];
      if (data) entries.set(templateArtFileName(layout), base64ToBytes(data));
    }
    for (const font of record.fonts) {
      entries.set(`fonts/${font.path}`, base64ToBytes(font.data));
    }
    const archive = templateArchiveFromEntries(entries, record.name || "Plantilla");
    return createTemplatePack(archive, {
      id: record.id,
      fallbackName: record.name || "Plantilla",
    });
  } catch {
    return null;
  }
}

function seedBrowser(): void {
  try {
    if (localStorage.getItem(BROWSER_SEED_KEY)) return;
    const records = loadBrowserRecords();
    if (!records.some((record) => record.id === BUILTIN_TEMPLATE.id)) {
      records.push(recordFromPack(builtinPack()));
      saveBrowserRecords(records);
    }
    localStorage.setItem(BROWSER_SEED_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

function loadBrowser(): TemplatePack[] {
  seedBrowser();
  return loadBrowserRecords()
    .map(packFromRecord)
    .filter((pack): pack is TemplatePack => Boolean(pack))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function loadTemplates(): Promise<TemplatePack[]> {
  const directory = await templatesDirectory();
  return directory ? loadDesktop() : loadBrowser();
}

export async function saveTemplate(pack: TemplatePack): Promise<void> {
  const directory = await templatesDirectory();
  if (directory) {
    await writeTemplateFolder(await join(directory, pack.id), pack);
    return;
  }
  const records = loadBrowserRecords().filter((record) => record.id !== pack.id);
  records.push(recordFromPack(pack));
  saveBrowserRecords(records);
}

export async function deleteTemplate(pack: TemplatePack): Promise<void> {
  const directory = await templatesDirectory();
  if (directory) {
    await remove(await join(directory, pack.id), { recursive: true }).catch(() => undefined);
    return;
  }
  saveBrowserRecords(loadBrowserRecords().filter((record) => record.id !== pack.id));
}

export async function renameTemplate(pack: TemplatePack, name: string): Promise<TemplatePack> {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!clean) return pack;
  const themeYaml = withTemplateName(pack.themeYaml, clean);
  const parsed = parseTemplateTheme(themeYaml, clean);
  const updated: TemplatePack = {
    ...pack,
    name: parsed.name,
    description: parsed.description,
    theme: parsed.theme,
    themeYaml,
  };

  const directory = await templatesDirectory();
  if (directory) {
    await writeFile(
      await join(directory, pack.id, TEMPLATE_THEME_FILE),
      textToBytes(themeYaml),
    );
    return updated;
  }

  const records = loadBrowserRecords().map((record) =>
    record.id === pack.id ? recordFromPack(updated) : record,
  );
  saveBrowserRecords(records);
  return updated;
}

/** Unique file name for an exported template. */
export function templateExportName(pack: TemplatePack): string {
  return `${sanitizeFileName(pack.name, "plantilla")}.zip`;
}

/** Re-encodes a pack after its name changed, for download or export. */
export function templateZip(pack: TemplatePack): Uint8Array {
  return encodeTemplateZip(pack);
}

/** Name for an imported pack whose name already exists. */
export function uniqueTemplateName(name: string, existing: string[]): string {
  const clean = name.trim() || "Plantilla";
  if (!existing.some((item) => item.toLowerCase() === clean.toLowerCase())) return clean;
  let index = 2;
  let candidate = `${clean} (${index})`;
  while (existing.some((item) => item.toLowerCase() === candidate.toLowerCase())) {
    index += 1;
    candidate = `${clean} (${index})`;
  }
  return candidate;
}
