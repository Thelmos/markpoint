import { unzipSync, zipSync } from "fflate";
import type { Manifest, ProjectData, ThemeId } from "../types";
import { bytesToText, extensionOf, textToBytes } from "./assets";
import { deckTitle, parseDeck } from "./parser";

export const MANIFEST_FILE = "manifest.json";
export const DEFAULT_MARKDOWN_FILE = "presentation.md";

const THEMES: ThemeId[] = ["light", "dark", "ocean", "sand"];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEMES as string[]).includes(value);
}

export function createManifest(title: string, theme: ThemeId = "light"): Manifest {
  const now = new Date().toISOString();
  return {
    format: "markpoint",
    version: 1,
    title,
    theme,
    createdAt: now,
    updatedAt: now,
  };
}

export function titleFromFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? name;
  const withoutExt = base.replace(/\.[^.]+$/, "");
  return withoutExt.trim() || "Presentación";
}

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Reads either a .markpoint bundle or a plain markdown file. */
export function readProject(bytes: Uint8Array, fileName: string): ProjectData {
  const fallbackTitle = titleFromFileName(fileName);
  if (!looksLikeZip(bytes)) {
    const markdown = bytesToText(bytes);
    const parsed = parseDeck(markdown);
    return {
      markdownPath: DEFAULT_MARKDOWN_FILE,
      markdown,
      manifest: createManifest(deckTitle(parsed.frontMatter, fallbackTitle)),
      files: new Map(),
    };
  }

  const entries = unzipSync(bytes);
  const files = new Map<string, Uint8Array>();
  for (const [rawPath, data] of Object.entries(entries)) {
    const path = normalizePath(rawPath);
    if (!path || path.endsWith("/")) continue;
    files.set(path, data);
  }

  let manifest = createManifest(fallbackTitle);
  const manifestBytes = files.get(MANIFEST_FILE);
  if (manifestBytes) {
    try {
      const parsed = JSON.parse(bytesToText(manifestBytes)) as Partial<Manifest>;
      manifest = {
        format: "markpoint",
        version: 1,
        title:
          typeof parsed.title === "string" && parsed.title.trim()
            ? parsed.title.trim()
            : fallbackTitle,
        theme: isThemeId(parsed.theme) ? parsed.theme : "light",
        createdAt:
          typeof parsed.createdAt === "string" ? parsed.createdAt : new Date().toISOString(),
        updatedAt:
          typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
      };
    } catch {
      /* keep defaults */
    }
  }

  let markdownPath = DEFAULT_MARKDOWN_FILE;
  if (!files.has(markdownPath)) {
    const candidate = Array.from(files.keys())
      .filter((path) => /\.(md|markdown)$/i.test(path))
      .sort((a, b) => a.length - b.length)[0];
    if (candidate) markdownPath = candidate;
  }

  const markdownBytes = files.get(markdownPath);
  const markdown = markdownBytes ? bytesToText(markdownBytes) : "";
  files.delete(MANIFEST_FILE);
  files.delete(markdownPath);

  return { markdownPath, markdown, manifest, files };
}

/** Serializes a project to a .markpoint zip bundle. */
export function writeProject(project: ProjectData): Uint8Array {
  const entries: Record<string, [Uint8Array, { level: 0 | 6 }]> = {};
  entries[project.markdownPath] = [textToBytes(project.markdown), { level: 6 }];

  const manifest: Manifest = {
    ...project.manifest,
    format: "markpoint",
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  entries[MANIFEST_FILE] = [
    textToBytes(JSON.stringify(manifest, null, 2)),
    { level: 6 },
  ];

  for (const [path, data] of project.files) {
    if (path === MANIFEST_FILE || path === project.markdownPath) continue;
    const ext = extensionOf(path);
    const alreadyCompressed = ["png", "jpg", "jpeg", "gif", "webp", "avif", "mp4", "webm", "woff2", "zip"].includes(ext);
    entries[normalizePath(path)] = [data, { level: alreadyCompressed ? 0 : 6 }];
  }

  return zipSync(entries, { level: 6 });
}

export function hasMarkpointExtension(path: string): boolean {
  return /\.markpoint$/i.test(path);
}
