import { create } from "zustand";
import type { Lang, Manifest, ProjectData, ThemeId } from "./types";
import { createDemoProject } from "./lib/demo";
import { uniqueAssetPath } from "./lib/assets";

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem("markpoint.lang");
    if (stored === "es" || stored === "en") return stored;
  } catch {
    /* ignore */
  }
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("es")
    ? "es"
    : "en";
}

interface AppState {
  markdown: string;
  markdownPath: string;
  files: Map<string, Uint8Array>;
  manifest: Manifest;
  theme: ThemeId;
  lang: Lang;
  filePath: string | null;
  dirty: boolean;

  setMarkdown: (markdown: string) => void;
  setTheme: (theme: ThemeId) => void;
  setLang: (lang: Lang) => void;
  setTitle: (title: string) => void;
  addFile: (fileName: string, bytes: Uint8Array) => string;
  replaceFile: (path: string, bytes: Uint8Array) => void;
  loadProject: (project: ProjectData, filePath: string | null, dirty?: boolean) => void;
  newProject: (title?: string, lang?: Lang) => void;
  setDirty: (dirty: boolean) => void;
  markSaved: (filePath: string) => void;
}

const initial = createDemoProject();

export const useAppStore = create<AppState>()((set, get) => ({
  markdown: initial.markdown,
  markdownPath: initial.markdownPath,
  files: initial.files,
  manifest: initial.manifest,
  theme: initial.manifest.theme,
  lang: detectLang(),
  filePath: null,
  dirty: false,

  setMarkdown: (markdown) => set({ markdown, dirty: true }),

  setTheme: (theme) =>
    set((state) => ({
      theme,
      manifest: { ...state.manifest, theme },
      dirty: true,
    })),

  setLang: (lang) => {
    try {
      localStorage.setItem("markpoint.lang", lang);
    } catch {
      /* ignore */
    }
    set({ lang });
  },

  setTitle: (title) =>
    set((state) => ({
      manifest: { ...state.manifest, title },
      dirty: true,
    })),

  addFile: (fileName, bytes) => {
    const path = uniqueAssetPath(get().files, fileName);
    const files = new Map(get().files);
    files.set(path, bytes);
    set({ files, dirty: true });
    return path;
  },

  replaceFile: (path, bytes) => {
    const files = new Map(get().files);
    files.set(path, bytes);
    set({ files, dirty: true });
  },

  loadProject: (project, filePath, dirty = false) =>
    set({
      markdown: project.markdown,
      markdownPath: project.markdownPath,
      files: new Map(project.files),
      manifest: project.manifest,
      theme: project.manifest.theme,
      filePath,
      dirty,
    }),

  newProject: (title = "Presentación sin título", lang: Lang = "es") => {
    const hint = lang === "es" ? "Empieza a escribir en Markdown…" : "Start writing in Markdown…";
    const project = {
      markdownPath: "presentation.md",
      markdown:
        "---\ntitle: " +
        title +
        "\npaginate: true\n---\n\n# " +
        title +
        "\n\n" +
        hint +
        "\n",
      manifest: {
        format: "markpoint" as const,
        version: 1 as const,
        title,
        theme: "light" as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      files: new Map<string, Uint8Array>(),
    };
    set({
      markdown: project.markdown,
      markdownPath: project.markdownPath,
      files: project.files,
      manifest: project.manifest,
      theme: project.manifest.theme,
      filePath: null,
      dirty: false,
    });
  },

  setDirty: (dirty) => set({ dirty }),

  markSaved: (filePath) =>
    set((state) => ({
      filePath,
      dirty: false,
      manifest: { ...state.manifest, updatedAt: new Date().toISOString() },
    })),
}));
