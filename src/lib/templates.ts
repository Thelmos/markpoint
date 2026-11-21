import { dump as dumpYaml, load as loadYaml } from "js-yaml";
import { unzipSync, zipSync } from "fflate";
import type { ProjectData, ThemeSpec } from "../types";
import {
  bytesToText,
  encodeAssetPath,
  textToBytes,
  uniqueAssetPath,
  uniqueFontPath,
} from "./assets.ts";
import { createManifest, DEFAULT_MARKDOWN_FILE } from "./project.ts";
import { parseDeck } from "./parser.ts";
import { setThemeInMarkdown } from "./themeBlock.ts";
import { resolveTheme, stackWithFamily } from "./themes.ts";

export const TEMPLATE_THEME_FILE = "theme.yaml";
export const TEMPLATE_EXAMPLE_FILE = "example.md";
export const TEMPLATE_ART_LAYOUTS = [
  "cover",
  "section",
  "content-1c",
  "content-2c",
] as const;

export type TemplateArtLayout = (typeof TEMPLATE_ART_LAYOUTS)[number];

export interface TemplateFontFile {
  /** Path relative to the template's `fonts/` folder. */
  path: string;
  bytes: Uint8Array;
}

export interface TemplatePack {
  id: string;
  name: string;
  description: string;
  theme: ThemeSpec;
  /** Original YAML, kept so exporting does not rewrite hand-written keys. */
  themeYaml: string;
  example: string;
  arts: Partial<Record<TemplateArtLayout, Uint8Array>>;
  fonts: TemplateFontFile[];
}

export interface TemplateArchive {
  themeYaml: string;
  example: string;
  arts: Partial<Record<TemplateArtLayout, Uint8Array>>;
  fonts: TemplateFontFile[];
}

const MAX_ZIP_BYTES = 24_000_000;
const MAX_TOTAL_BYTES = 16_000_000;
const MAX_FILE_BYTES = 8_000_000;
const MAX_THEME_BYTES = 64_000;
const MAX_EXAMPLE_BYTES = 512_000;
const MAX_FONT_BYTES = 4_000_000;
const MAX_ENTRIES = 64;

const FONT_EXTENSION = /\.(?:woff2|woff|ttf|otf)$/i;

export function templateArtFileName(layout: TemplateArtLayout): string {
  return `${layout}.svg`;
}

export function templateArtLayoutFromFile(name: string): TemplateArtLayout | null {
  const normalized = name.trim().toLowerCase();
  return (TEMPLATE_ART_LAYOUTS as readonly string[]).includes(normalized)
    ? (normalized as TemplateArtLayout)
    : null;
}

export function createTemplateId(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${slug || "plantilla"}-${Date.now().toString(36)}`;
}

export function isSafeTemplatePath(path: string): boolean {
  if (!path || path.length > 260) return false;
  if (path.includes("\\") || path.includes("\0")) return false;
  if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) return false;
  return path.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

function normalizeArchivePath(path: string): string {
  return path.replace(/^\.\//, "").replace(/^\/+/, "");
}

function fontRelativePath(file: string): string {
  const clean = normalizeArchivePath(file.replace(/^assets\/fonts\//i, "fonts/"));
  return clean.replace(/^fonts\//i, "");
}

function looksLikeSvg(bytes: Uint8Array): boolean {
  const text = bytesToText(bytes.subarray(0, 4096));
  return /<svg[\s>]/i.test(text);
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseTemplateTheme(
  themeYaml: string,
  fallbackName: string,
): { name: string; description: string; theme: ThemeSpec } {
  let parsed: unknown;
  try {
    parsed = loadYaml(themeYaml);
  } catch (error) {
    throw new Error(
      `theme.yaml is not valid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("theme.yaml must contain a map of theme values");
  }

  const raw = { ...(parsed as Record<string, unknown>) };
  const name = textField(raw.name) || fallbackName.trim() || "Plantilla";
  const description = textField(raw.description);
  delete raw.description;
  raw.name = name;

  const resolved = resolveTheme(raw);
  if (resolved.warnings.length > 0) {
    throw new Error(`theme.yaml has invalid values: ${resolved.warnings.join(", ")}`);
  }

  return { name: name.slice(0, 80), description: description.slice(0, 240), theme: raw as ThemeSpec };
}

export function withTemplateName(themeYaml: string, name: string): string {
  const parsed = loadYaml(themeYaml);
  const raw =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  raw.name = name.trim().slice(0, 80);
  return dumpYaml(raw, { lineWidth: 120, noRefs: true });
}

export function createTemplatePack(
  input: TemplateArchive,
  options: { id?: string; fallbackName?: string } = {},
): TemplatePack {
  const parsed = parseTemplateTheme(input.themeYaml, options.fallbackName ?? "Plantilla");
  return {
    id: options.id ?? createTemplateId(parsed.name),
    name: parsed.name,
    description: parsed.description,
    theme: parsed.theme,
    themeYaml: input.themeYaml,
    example: input.example,
    arts: input.arts,
    fonts: input.fonts,
  };
}

function stripCommonRoot(entries: Map<string, Uint8Array>): Map<string, Uint8Array> {
  const names = Array.from(entries.keys());
  if (names.length === 0) return entries;
  const root = names[0].split("/")[0];
  if (!root || !names.every((name) => name.includes("/") && name.split("/")[0] === root)) {
    return entries;
  }
  const stripped = new Map<string, Uint8Array>();
  for (const [name, bytes] of entries) {
    stripped.set(name.slice(root.length + 1), bytes);
  }
  return stripped;
}

/**
 * Validates the files of a template folder or archive. Every path is checked
 * before anything is written, so an invalid zip never leaves a partial pack.
 */
export function templateArchiveFromEntries(
  entries: Map<string, Uint8Array>,
  fallbackName: string,
): TemplateArchive {
  const normalized = new Map<string, Uint8Array>();
  let total = 0;
  if (entries.size > MAX_ENTRIES) throw new Error("The template has too many files");
  for (const [rawPath, bytes] of entries) {
    const path = normalizeArchivePath(rawPath);
    if (!isSafeTemplatePath(path)) throw new Error(`Invalid template path: ${rawPath}`);
    if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`The file ${path} is too large`);
    total += bytes.byteLength;
    if (total > MAX_TOTAL_BYTES) throw new Error("The template is too large");
    normalized.set(path, bytes);
  }

  const files = stripCommonRoot(normalized);
  const themeBytes = files.get(TEMPLATE_THEME_FILE);
  const exampleBytes = files.get(TEMPLATE_EXAMPLE_FILE);
  if (!themeBytes) throw new Error("The template does not contain theme.yaml");
  if (!exampleBytes) throw new Error("The template does not contain example.md");
  if (themeBytes.byteLength > MAX_THEME_BYTES) throw new Error("theme.yaml is too large");
  if (exampleBytes.byteLength > MAX_EXAMPLE_BYTES) throw new Error("example.md is too large");

  const themeYaml = bytesToText(themeBytes);
  const example = bytesToText(exampleBytes);
  if (!example.trim()) throw new Error("example.md is empty");

  const parsedTheme = parseTemplateTheme(themeYaml, fallbackName);
  const arts: Partial<Record<TemplateArtLayout, Uint8Array>> = {};
  const fonts: TemplateFontFile[] = [];

  for (const [path, bytes] of files) {
    if (path === TEMPLATE_THEME_FILE || path === TEMPLATE_EXAMPLE_FILE) continue;
    if (path.startsWith("fonts/")) {
      const relative = path.slice("fonts/".length);
      const fileName = relative.split("/").pop() ?? "";
      if (!fileName || !FONT_EXTENSION.test(fileName)) continue;
      if (fonts.some((font) => font.path.toLowerCase() === fileName.toLowerCase())) {
        throw new Error(`Duplicate font file: ${fileName}`);
      }
      if (bytes.byteLength > MAX_FONT_BYTES) throw new Error(`The font ${path} is too large`);
      fonts.push({ path: fileName, bytes });
      continue;
    }
    const layout = templateArtLayoutFromFile(path.replace(/\.svg$/i, ""));
    if (layout && /^[a-z0-9-]+\.svg$/i.test(path)) {
      if (!looksLikeSvg(bytes)) throw new Error(`${path} is not an SVG image`);
      arts[layout] = bytes;
      continue;
    }
    // Unknown files are ignored: they will not be copied anywhere.
  }

  for (const font of parsedTheme.theme.fonts ?? []) {
    const wanted = fontRelativePath(font.file);
    const match = fonts.some(
      (candidate) =>
        candidate.path.toLowerCase() === wanted.toLowerCase() ||
        candidate.path.split("/").pop()?.toLowerCase() === wanted.split("/").pop()?.toLowerCase(),
    );
    if (!match) throw new Error(`The font ${font.file} is missing from the template`);
  }

  // A background that the example references but the pack does not include
  // would produce a broken project, so it is treated as a corrupt template.
  const reference = /!\[[^\]]*\]\((?:\.\/|assets\/)?(cover|section|content-1c|content-2c)\.svg\)/gi;
  for (const match of example.matchAll(reference)) {
    const layout = match[1].toLowerCase() as TemplateArtLayout;
    if (!arts[layout]) throw new Error(`The background ${match[1]}.svg is missing from the template`);
  }

  return { themeYaml, example, arts, fonts };
}

export function encodeTemplateZip(pack: TemplatePack): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  entries[TEMPLATE_THEME_FILE] = [
    textToBytes(withTemplateName(pack.themeYaml, pack.name)),
    { level: 6 },
  ];
  entries[TEMPLATE_EXAMPLE_FILE] = [textToBytes(pack.example), { level: 6 }];
  for (const layout of TEMPLATE_ART_LAYOUTS) {
    const bytes = pack.arts[layout];
    if (bytes) entries[templateArtFileName(layout)] = [bytes, { level: 6 }];
  }
  for (const font of pack.fonts) {
    const ext = font.path.split(".").pop()?.toLowerCase();
    entries[`fonts/${font.path}`] = [
      font.bytes,
      { level: ext === "woff2" || ext === "woff" ? 0 : 6 },
    ];
  }
  return zipSync(entries, { level: 6 });
}

export function decodeTemplateZip(bytes: Uint8Array, fallbackName: string): TemplatePack {
  if (bytes.byteLength > MAX_ZIP_BYTES) throw new Error("The template zip is too large");

  let invalid: string | null = null;
  let total = 0;
  let count = 0;
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        if (file.name.endsWith("/")) return false;
        if (!isSafeTemplatePath(file.name)) {
          invalid = `Invalid path: ${file.name}`;
          return false;
        }
        count += 1;
        total += file.originalSize;
        if (count > MAX_ENTRIES) {
          invalid = "The template has too many files";
          return false;
        }
        if (file.originalSize > MAX_FILE_BYTES) {
          invalid = `The file ${file.name} is too large`;
          return false;
        }
        if (total > MAX_TOTAL_BYTES) {
          invalid = "The template is too large";
          return false;
        }
        return true;
      },
    });
  } catch (error) {
    throw new Error(
      `The template zip could not be read: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (invalid) throw new Error(invalid);

  const map = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(entries)) {
    map.set(normalizeArchivePath(path), data);
  }
  return createTemplatePack(templateArchiveFromEntries(map, fallbackName), {
    fallbackName,
  });
}

function replaceTemplateReferences(
  markdown: string,
  paths: Map<string, string>,
): string {
  if (paths.size === 0) return markdown;
  const names = Array.from(paths.keys())
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const pattern = new RegExp(
    `(!\\[[^\\]]*\\]\\()\\s*(?:\\.\\/|assets\\/)?(${names})\\s*(\\))`,
    "gi",
  );
  return markdown.replace(pattern, (_match, open: string, name: string, close: string) => {
    const target = paths.get(name.toLowerCase());
    return target ? `${open}${encodeAssetPath(target)}${close}` : _match;
  });
}

function lineOffsets(markdown: string): number[] {
  const offsets = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

/** Replaces (or adds) the title of the front matter, keeping the rest intact. */
export function setFrontMatterTitle(markdown: string, title: string): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!clean) return markdown;
  const value = JSON.stringify(clean);
  const parsed = parseDeck(markdown);
  if (!parsed.frontMatterRange) {
    return `---\ntitle: ${value}\n---\n\n${markdown.replace(/^\n+/, "")}`;
  }

  const lines = markdown.split("\n");
  const closing = Math.min(parsed.frontMatterRange.end - 1, lines.length - 1);
  const offsets = lineOffsets(markdown);
  for (let index = parsed.frontMatterRange.start; index < closing; index += 1) {
    if (/^title\s*:/.test(lines[index])) {
      const from = offsets[index];
      const to = from + lines[index].replace(/\r$/, "").length;
      return markdown.slice(0, from) + `title: ${value}` + markdown.slice(to);
    }
  }

  const from = offsets[closing] ?? markdown.length;
  return markdown.slice(0, from) + `title: ${value}\n` + markdown.slice(from);
}

/**
 * Builds a self-contained project: theme in the front matter, artwork and
 * fonts copied to assets, and the example as the initial content.
 */
export function createProjectFromTemplate(
  pack: TemplatePack,
  options: { title?: string } = {},
): ProjectData {
  const files = new Map<string, Uint8Array>();
  const artPaths = new Map<string, string>();

  for (const layout of TEMPLATE_ART_LAYOUTS) {
    const bytes = pack.arts[layout];
    if (!bytes) continue;
    const path = uniqueAssetPath(files, templateArtFileName(layout));
    files.set(path, bytes);
    artPaths.set(templateArtFileName(layout).toLowerCase(), path);
  }

  const fontPaths = new Map<string, string>();
  for (const font of pack.fonts) {
    const fileName = font.path.split("/").pop() || "font.woff2";
    const path = uniqueFontPath(files, fileName);
    files.set(path, font.bytes);
    fontPaths.set(font.path.toLowerCase(), path);
    fontPaths.set(fileName.toLowerCase(), path);
  }

  const theme: ThemeSpec = { ...pack.theme };
  if (theme.fonts && theme.fonts.length > 0) {
    const rewritten = theme.fonts
      .map((font) => {
        const wanted = fontRelativePath(font.file);
        const path =
          fontPaths.get(wanted.toLowerCase()) ??
          fontPaths.get((wanted.split("/").pop() ?? "").toLowerCase());
        return path ? { ...font, file: path } : null;
      })
      .filter((font): font is NonNullable<typeof font> => Boolean(font));
    if (rewritten.length > 0) theme.fonts = rewritten;
    else delete theme.fonts;
  }

  const resolved = resolveTheme(theme);
  for (const font of theme.fonts ?? []) {
    theme.font = stackWithFamily(theme.font ?? resolved.values.font, font.family);
    theme.headingFont = stackWithFamily(
      theme.headingFont ?? resolved.values.headingFont,
      font.family,
    );
  }

  let markdown = replaceTemplateReferences(pack.example, artPaths);
  const parsed = parseDeck(markdown);
  const edit = setThemeInMarkdown(markdown, parsed.frontMatterRange, theme);
  markdown = markdown.slice(0, edit.from) + edit.insert + markdown.slice(edit.to);

  const title = (options.title?.trim() || pack.name).replace(/\s+/g, " ").trim();
  markdown = setFrontMatterTitle(markdown, title);

  return {
    markdownPath: DEFAULT_MARKDOWN_FILE,
    markdown,
    manifest: createManifest(title),
    files,
  };
}
