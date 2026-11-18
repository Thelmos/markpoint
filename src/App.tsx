import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProjectData, ThemeSpec } from "./types";
import { useAppStore } from "./store";
import { deckTitle, lineForSlide, parseDeck, slideAtLine } from "./lib/parser";
import { normalizeAssetPath } from "./lib/markdown";
import {
  bytesToBlobUrl,
  encodeAssetPath,
  fileToDataUrl,
  fontAssetPath,
  formatBytes,
  isFontPath,
  isImagePath,
  sanitizeFileName,
  textToBytes,
  uniqueFontPath,
} from "./lib/assets";
import {
  hasMarkpointExtension,
  readProject,
  unreferencedImages,
  writeProject,
} from "./lib/project";
import {
  basename,
  confirmDialog,
  createAudienceWindow,
  emitToDesktopWindow,
  exportPdf,
  focusMainWindow,
  isDesktop,
  listenDesktop,
  onCloseRequested,
  onFileDrop,
  openExternal,
  pickFontFile,
  pickImageFiles,
  pickProjectFile,
  pickSavePath,
  readFilePath,
  setWindowFullscreen,
  setWindowTitle,
  showError,
  takeStartupFile,
  writeFilePath,
  type AudienceWindowInfo,
} from "./lib/tauri";
import {
  deleteRecoveryDraft,
  readRecoveryDraft,
  writeRecoveryDraft,
} from "./lib/recovery";
import { forgetRecent, loadRecent, rememberRecent, type RecentFile } from "./lib/recent";
import {
  AUDIENCE_EXIT,
  AUDIENCE_INDEX,
  AUDIENCE_INIT,
  AUDIENCE_NAV,
  AUDIENCE_READY,
  type AudienceInit,
} from "./lib/audience";
import { buildPrintHtml, buildStandaloneHtml, renderDeckMarkup } from "./lib/export";
import { translate, useT } from "./lib/i18n";
import {
  familyFromFileName,
  hasThemeOverrides,
  resolveTheme,
  specFromResolved,
  stackWithFamily,
} from "./lib/themes";
import { setThemeInMarkdown, themeBlockLines } from "./lib/themeBlock";
import {
  applyStoredTheme,
  loadThemes,
  type StoredTheme,
} from "./lib/themeLibrary";
import { THEME_HINT_KEYS, hintKeyFor } from "./lib/themeHints";
import { EditorPane, type EditorHandle } from "./components/EditorPane";
import { PreviewPane, type PreviewHandle } from "./components/PreviewPane";
import { Toolbar, type ExportKind } from "./components/Toolbar";
import { Presentation } from "./components/Presentation";
import { Presenter } from "./components/Presenter";
import { BusyOverlay, ToastStack, type ToastItem } from "./components/Overlays";
import { HelpDialog } from "./components/HelpDialog";
import { ThemeManager } from "./components/ThemeManager";
import { ThemeStyle } from "./components/ThemeStyle";
import { Icon } from "./components/Icons";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function openPrintWindow(html: string): void {
  const win = window.open("", "_blank");
  if (!win) throw new Error("The print window was blocked by the browser");
  win.document.open();
  win.document.write(html);
  win.document.close();
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  }, 650);
}

export default function App() {
  const t = useT();
  const markdown = useAppStore((state) => state.markdown);
  const files = useAppStore((state) => state.files);
  const manifest = useAppStore((state) => state.manifest);
  const dirty = useAppStore((state) => state.dirty);
  const filePath = useAppStore((state) => state.filePath);
  const setMarkdown = useAppStore((state) => state.setMarkdown);
  const loadProject = useAppStore((state) => state.loadProject);
  const newProject = useAppStore((state) => state.newProject);
  const markSaved = useAppStore((state) => state.markSaved);

  const deck = useMemo(() => parseDeck(markdown), [markdown]);
  const slides = deck.slides;
  const paginate = deck.frontMatter.paginate !== false;
  const title = manifest.title.trim() || t("untitled");
  const resolvedTheme = useMemo(
    () => resolveTheme(deck.frontMatter.theme),
    [deck.frontMatter.theme],
  );
  const firstSlideLine = slides[0]?.startLine ?? 1;

  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  const originRef = useRef<"editor" | "preview" | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const pendingScroll = useRef(false);
  const [dragActive, setDragActive] = useState(false);
  const dragDepth = useRef(0);
  const [recent, setRecent] = useState<RecentFile[]>(() => loadRecent());
  const [helpOpen, setHelpOpen] = useState(false);
  const [savedThemes, setSavedThemes] = useState<StoredTheme[]>([]);
  const [themeManagerOpen, setThemeManagerOpen] = useState(false);

  /**
   * Source lines that belong to the active slide. When the cursor is in the
   * front matter or the gap before the first slide, the whole prelude is
   * highlighted instead, so editing the theme stays readable.
   */
  const activeLines = useMemo(() => {
    if (firstSlideLine > 1 && cursorLine < firstSlideLine) {
      return { from: 1, to: firstSlideLine - 1 };
    }
    const slide = slides[active] ?? slides[slides.length - 1];
    if (!slide) return null;
    return { from: slide.startLine, to: slide.endLine };
  }, [active, slides, cursorLine, firstSlideLine]);

  const themeLines = useMemo(
    () => themeBlockLines(markdown, deck.frontMatterRange),
    [markdown, deck.frontMatterRange],
  );
  const themeHints = useMemo(() => {
    if (!themeLines) return null;
    const hints: Record<string, string> = {};
    for (const key of THEME_HINT_KEYS) hints[key] = t(hintKeyFor(key));
    return { ...themeLines, hints };
  }, [themeLines, t]);

  const [session, setSession] = useState<{ mode: "overlay" | "presenter"; start: number } | null>(
    null,
  );
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [presenterIndex, setPresenterIndex] = useState(0);
  const presenterIndexRef = useRef(presenterIndex);
  presenterIndexRef.current = presenterIndex;
  const [audienceMonitor, setAudienceMonitor] = useState<string | null>(null);
  const audienceRef = useRef<AudienceWindowInfo | null>(null);
  const audiencePayloadRef = useRef<AudienceInit | null>(null);
  const audienceReadyRef = useRef(false);
  const audienceReadyPendingRef = useRef(false);
  const startingRef = useRef(false);
  const audienceTimeoutRef = useRef<number | null>(null);
  const closingAudienceRef = useRef(false);
  const exitPresentationRef = useRef<(index: number) => void>(() => undefined);
  const slideCountRef = useRef(slides.length);
  slideCountRef.current = slides.length;

  const [autoSavedAt, setAutoSavedAt] = useState<number | null>(null);
  const [recoverySavedAt, setRecoverySavedAt] = useState<number | null>(null);
  const autoSaveErrorRef = useRef<string | null>(null);
  const bootedRef = useRef(false);

  const editorRef = useRef<EditorHandle>(null);
  const previewRef = useRef<PreviewHandle>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [editorWidth, setEditorWidth] = useState(() => {
    try {
      const stored = Number(localStorage.getItem("markpoint.split"));
      if (stored >= 26 && stored <= 72) return stored;
    } catch {
      /* ignore */
    }
    return 46;
  });
  const [resizing, setResizing] = useState(false);

  const pushToast = useCallback((text: string, kind: ToastItem["kind"] = "info") => {
    const id = ++toastId.current;
    setToasts((current) => [...current, { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 3800);
  }, []);

  /* ---------------------------------------------------------------- themes */

  const refreshThemes = useCallback(async () => {
    try {
      setSavedThemes(await loadThemes());
    } catch {
      setSavedThemes([]);
    }
  }, []);

  useEffect(() => {
    void refreshThemes();
  }, [refreshThemes]);

  const themeWarningsKey = resolvedTheme.warnings.join("|");
  const shownThemeWarnings = useRef("");
  useEffect(() => {
    if (!themeWarningsKey || themeWarningsKey === shownThemeWarnings.current) return;
    shownThemeWarnings.current = themeWarningsKey;
    pushToast(t("themeInvalid"), "error");
  }, [themeWarningsKey, pushToast, t]);

  const confirmThemeReplace = useCallback(async () => {
    const raw = parseDeck(useAppStore.getState().markdown).frontMatter.theme;
    if (!hasThemeOverrides(raw)) return true;
    return confirmDialog(t("themeDiscardEdits"), {
      title: "MarkPoint",
      kind: "warning",
      okLabel: t("replace"),
      cancelLabel: t("cancel"),
    });
  }, [t]);

  const applyTheme = useCallback(
    async (target: string | ThemeSpec, options?: { keepEdits?: boolean }) => {
      const state = useAppStore.getState();
      const parsed = parseDeck(state.markdown);
      const current = resolveTheme(parsed.frontMatter.theme);
      if (
        typeof target === "string" &&
        current.presetId === target &&
        !hasThemeOverrides(parsed.frontMatter.theme)
      ) {
        return;
      }
      if (!options?.keepEdits && !(await confirmThemeReplace())) return;
      const edit = setThemeInMarkdown(state.markdown, parsed.frontMatterRange, target);
      editorRef.current?.replaceRange(edit.from, edit.to, edit.insert);
    },
    [confirmThemeReplace],
  );

  const applySavedTheme = useCallback(
    async (stored: StoredTheme) => {
      if (!(await confirmThemeReplace())) return;
      const addFont = (fileName: string, bytes: Uint8Array) => {
        const state = useAppStore.getState();
        const path = fontAssetPath(state.files, fileName);
        if (!state.files.has(path)) state.addFileAt(path, bytes);
        return path;
      };
      await applyTheme(applyStoredTheme(stored, addFont), { keepEdits: true });
    },
    [applyTheme, confirmThemeReplace],
  );

  const addThemeFont = useCallback(async () => {
    try {
      const picked = await pickFontFile(t("themeFontFilter"));
      if (!picked) return;
      const family = familyFromFileName(picked.name);
      const state = useAppStore.getState();
      const current = resolveTheme(parseDeck(state.markdown).frontMatter.theme);
      const existing = current.fonts.find((font) => font.family === family);
      const path = existing?.file ?? uniqueFontPath(state.files, picked.name);
      state.addFileAt(path, picked.bytes);
      const fonts = [
        ...current.fonts.filter((font) => font.family !== family),
        { family, file: path },
      ];
      const spec = specFromResolved(current, { name: current.name ?? undefined, fonts });
      spec.font = stackWithFamily(current.values.font, family);
      spec.headingFont = stackWithFamily(current.values.headingFont, family);
      await applyTheme(spec, { keepEdits: true });
      pushToast(t("themeFontAdded", { name: family }), "success");
    } catch (error) {
      await showError(t("themeError"), error instanceof Error ? error.message : String(error));
    }
  }, [applyTheme, pushToast, t]);

  /* --------------------------------------------------------------- assets */

  const assetUrls = useMemo(() => {
    const map = new Map<string, string>();
    for (const [path, bytes] of files) {
      if (isImagePath(path) || isFontPath(path)) map.set(path, bytesToBlobUrl(bytes, path));
    }
    return map;
  }, [files]);

  useEffect(() => {
    const urls = assetUrls;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [assetUrls]);

  const assetByFileName = useMemo(() => {
    const map = new Map<string, string>();
    for (const [path, url] of assetUrls) {
      const name = path.split("/").pop();
      if (name && !map.has(name)) map.set(name, url);
    }
    return map;
  }, [assetUrls]);

  const resolveSrc = useCallback(
    (raw: string) => {
      const path = normalizeAssetPath(raw);
      if (/^(https?:|data:|blob:)/i.test(path)) return raw;
      return (
        assetUrls.get(path) ??
        assetUrls.get(`assets/${path}`) ??
        assetByFileName.get(path.split("/").pop() ?? "") ??
        raw
      );
    },
    [assetUrls, assetByFileName],
  );

  /* ------------------------------------------------------ active slide sync */

  const setActiveFromEditor = useCallback((index: number) => {
    if (index === activeRef.current) return;
    originRef.current = "editor";
    activeRef.current = index;
    setActive(index);
  }, []);

  const handleEditorCursor = useCallback(
    (line: number) => {
      setCursorLine(line);
      if (line < firstSlideLine) return;
      setActiveFromEditor(slideAtLine(slides, line));
    },
    [slides, firstSlideLine, setActiveFromEditor],
  );

  const handleEditorScroll = useCallback(
    (line: number) => {
      if (line < firstSlideLine) return;
      setActiveFromEditor(slideAtLine(slides, line));
    },
    [slides, firstSlideLine, setActiveFromEditor],
  );

  const handlePreviewActive = useCallback(
    (index: number) => {
      if (index === activeRef.current) return;
      originRef.current = "preview";
      activeRef.current = index;
      setActive(index);
      // While the cursor lives in the front matter, scrolling the preview
      // must not pull the editor away from the theme block.
      if (cursorLine >= firstSlideLine) {
        editorRef.current?.scrollToLine(lineForSlide(slides, index));
      }
    },
    [slides, cursorLine, firstSlideLine],
  );

  const handleSlideClick = useCallback(
    (index: number) => {
      originRef.current = "preview";
      activeRef.current = index;
      setActive(index);
      editorRef.current?.scrollToLine(lineForSlide(slides, index), { cursor: true });
    },
    [slides],
  );

  useEffect(() => {
    if (active > slides.length - 1) {
      const next = Math.max(0, slides.length - 1);
      activeRef.current = next;
      setActive(next);
    }
  }, [active, slides.length]);

  useEffect(() => {
    if (originRef.current === "preview") {
      originRef.current = null;
      return;
    }
    previewRef.current?.centerSlide(active, true);
  }, [active]);

  useEffect(() => {
    if (!pendingScroll.current) return;
    pendingScroll.current = false;
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollToLine(1, { cursor: true });
      previewRef.current?.centerSlide(0, false);
    });
  }, [markdown]);

  useEffect(() => {
    void setWindowTitle(`${title}${dirty ? " •" : ""} — MarkPoint`);
  }, [title, dirty]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (/^(https?:|mailto:)/i.test(href)) {
        event.preventDefault();
        void openExternal(href).catch(() => undefined);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  /* ------------------------------------------------------------- projects */

  const confirmDiscard = useCallback(async () => {
    if (!useAppStore.getState().dirty) return true;
    return confirmDialog(t("discardChanges"), {
      title: "MarkPoint",
      kind: "warning",
      okLabel: t("discard"),
      cancelLabel: t("cancel"),
    });
  }, [t]);

  const applyProject = useCallback(
    (project: ProjectData, path: string | null) => {
      loadProject(project, path);
      activeRef.current = 0;
      setActive(0);
      originRef.current = null;
      pendingScroll.current = true;
      setAutoSavedAt(null);
      setRecoverySavedAt(null);
      autoSaveErrorRef.current = null;
    },
    [loadProject],
  );

  const saveProject = useCallback(
    async (saveAs = false) => {
      const state = useAppStore.getState();
      try {
        let target = state.filePath;
        if (!target || saveAs) {
          const suggested = `${sanitizeFileName(state.manifest.title || translate(state.lang, "untitled"))}.markpoint`;
          target = await pickSavePath(suggested, "MarkPoint", ["markpoint"]);
          if (!target) return;
        }
        const pruned = unreferencedImages(state.files, state.markdown);
        const freed = pruned.reduce(
          (total, path) => total + (state.files.get(path)?.byteLength ?? 0),
          0,
        );
        const bytes = writeProject({
          markdownPath: state.markdownPath,
          markdown: state.markdown,
          manifest: state.manifest,
          files: state.files,
        });
        await writeFilePath(target, bytes);
        markSaved(target);
        await deleteRecoveryDraft();
        setRecoverySavedAt(null);
        if (isDesktop) {
          setRecent(
            rememberRecent({
              path: target,
              title: state.manifest.title.trim() || translate(state.lang, "untitled"),
            }),
          );
        }
        pushToast(translate(state.lang, "saved"), "success");
        if (pruned.length > 0) {
          pushToast(
            translate(state.lang, "imagesPruned", {
              n: pruned.length,
              size: formatBytes(freed),
            }),
          );
        }
      } catch (error) {
        await showError(t("saveError"), error instanceof Error ? error.message : String(error));
      }
    },
    [markSaved, pushToast, t],
  );

  const openPath = useCallback(
    async (path: string, options?: { confirm?: boolean; keepRecovery?: boolean }) => {
      if (options?.confirm !== false && !(await confirmDiscard())) return false;
      try {
        const bytes = await readFilePath(path);
        const project = readProject(bytes, basename(path));
        applyProject(project, path);
        if (!options?.keepRecovery) {
          await deleteRecoveryDraft();
          setRecoverySavedAt(null);
        }
        setRecent(
          rememberRecent({
            path,
            title: project.manifest.title.trim() || basename(path),
          }),
        );
        pushToast(t("opened"), "success");
        return true;
      } catch (error) {
        setRecent(forgetRecent(path));
        await showError(t("openError"), error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    [applyProject, confirmDiscard, pushToast, t],
  );

  const openPathRef = useRef(openPath);
  openPathRef.current = openPath;

  const openProject = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    try {
      const picked = await pickProjectFile();
      if (!picked) return;
      const project = readProject(picked.bytes, picked.name);
      applyProject(project, picked.path);
      await deleteRecoveryDraft();
      setRecoverySavedAt(null);
      if (picked.path) {
        setRecent(
          rememberRecent({
            path: picked.path,
            title: project.manifest.title.trim() || picked.name,
          }),
        );
      }
      pushToast(t("opened"), "success");
    } catch (error) {
      await showError(t("openError"), error instanceof Error ? error.message : String(error));
    }
  }, [applyProject, confirmDiscard, pushToast, t]);

  const newPresentation = useCallback(async () => {
    if (!(await confirmDiscard())) return;
    const state = useAppStore.getState();
    newProject(translate(state.lang, "untitled"), state.lang);
    activeRef.current = 0;
    setActive(0);
    pendingScroll.current = true;
    setAutoSavedAt(null);
    setRecoverySavedAt(null);
    await deleteRecoveryDraft();
    pushToast(t("newPresentation"));
  }, [confirmDiscard, newProject, pushToast, t]);

  const addImages = useCallback(
    (images: Array<{ name: string; bytes: Uint8Array }>) => {
      if (images.length === 0) return;
      const state = useAppStore.getState();
      const paths: string[] = [];
      for (const image of images) {
        paths.push(state.addFile(image.name, image.bytes));
      }
      const snippet = paths.map((path) => `![](${encodeAssetPath(path)})`).join("\n\n");
      editorRef.current?.insertText(`\n\n${snippet}\n\n`);
      pushToast(
        images.length === 1
          ? translate(state.lang, "imageAdded", { name: images[0].name })
          : translate(state.lang, "imagesAdded", { n: images.length }),
        "success",
      );
    },
    [pushToast],
  );

  const insertImages = useCallback(async () => {
    try {
      const picked = await pickImageFiles(t("imageFilter"));
      if (picked.length === 0) return;
      addImages(picked.map((file) => ({ name: file.name, bytes: file.bytes })));
    } catch (error) {
      await showError(
        t("imagePickError"),
        error instanceof Error ? error.message : String(error),
      );
    }
  }, [addImages, t]);

  /* --------------------------------------------------- autosave / recovery */

  const runAutosave = useCallback(async () => {
    const snapshot = useAppStore.getState();
    if (!snapshot.dirty) return;

    const captured = {
      markdown: snapshot.markdown,
      files: snapshot.files,
      manifest: snapshot.manifest,
    };

    try {
      const bytes = writeProject({
        markdownPath: snapshot.markdownPath,
        markdown: snapshot.markdown,
        manifest: snapshot.manifest,
        files: snapshot.files,
      });

      if (snapshot.filePath) {
        await writeFilePath(snapshot.filePath, bytes);
        const after = useAppStore.getState();
        if (
          after.markdown === captured.markdown &&
          after.files === captured.files &&
          after.manifest === captured.manifest
        ) {
          useAppStore.getState().markSaved(snapshot.filePath);
          setAutoSavedAt(Date.now());
          autoSaveErrorRef.current = null;
          void deleteRecoveryDraft();
        }
      } else {
        await writeRecoveryDraft(bytes);
        setRecoverySavedAt(Date.now());
        autoSaveErrorRef.current = null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (autoSaveErrorRef.current !== message) {
        autoSaveErrorRef.current = message;
        pushToast(
          translate(useAppStore.getState().lang, snapshot.filePath ? "autosaveFailed" : "recoveryFailed"),
          "error",
        );
      }
    }
  }, [pushToast]);

  useEffect(() => {
    if (!isDesktop || !dirty) return;
    const delay = filePath ? 1200 : 2800;
    const timer = window.setTimeout(() => {
      void runAutosave();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [markdown, files, manifest, dirty, filePath, runAutosave]);

  const checkRecovery = useCallback(async () => {
    const bytes = await readRecoveryDraft();
    if (!bytes) return;
    let project: ProjectData;
    try {
      project = readProject(bytes, "recovery.markpoint");
    } catch {
      await deleteRecoveryDraft();
      return;
    }
    if (!project.markdown.trim() && project.files.size === 0) {
      await deleteRecoveryDraft();
      return;
    }
    const restore = await confirmDialog(
      t("recoveryMessage", { title: project.manifest.title || t("untitled") }),
      {
        title: "MarkPoint",
        kind: "warning",
        okLabel: t("restore"),
        cancelLabel: t("discard"),
      },
    );
    if (!restore) {
      await deleteRecoveryDraft();
      return;
    }
    applyProject(project, null);
    useAppStore.getState().setDirty(true);
    pushToast(t("recoveryRestored"), "success");
  }, [applyProject, pushToast, t]);

  useEffect(() => {
    if (!isDesktop || bootedRef.current) return;
    bootedRef.current = true;
    void (async () => {
      const startup = await takeStartupFile().catch(() => null);
      if (startup) {
        const opened = await openPathRef.current(startup, {
          confirm: false,
          keepRecovery: true,
        });
        if (opened) return;
      }
      await checkRecovery();
    })();
  }, [checkRecovery]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listenDesktop<string>("open-file", (path) => {
      void openPathRef.current(path);
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const guard = onFileDrop((paths) => {
      void (async () => {
        const projectPath = paths.find(
          (path) => hasMarkpointExtension(path) || /\.(md|markdown)$/i.test(path),
        );
        if (projectPath) {
          await openPathRef.current(projectPath);
          return;
        }
        const images: Array<{ name: string; bytes: Uint8Array }> = [];
        for (const path of paths) {
          if (!isImagePath(path)) continue;
          try {
            images.push({ name: basename(path), bytes: await readFilePath(path) });
          } catch {
            /* ignore unreadable file */
          }
        }
        addImages(images);
      })();
    });
    return () => guard.unlisten();
  }, [addImages]);

  /* --------------------------------------------------------------- export */

  const exportDeck = useCallback(
    async (kind: ExportKind) => {
      const state = useAppStore.getState();
      const parsed = parseDeck(state.markdown);
      const exportTitle =
        state.manifest.title.trim() || translate(state.lang, "untitled");
      setBusy(translate(state.lang, kind === "html" ? "busyHtml" : "busyPdf"));
      try {
        const markup = await renderDeckMarkup({
          slides: parsed.slides,
          theme: resolveTheme(parsed.frontMatter.theme),
          lang: state.lang,
          paginate: parsed.frontMatter.paginate !== false,
          title: exportTitle,
          files: state.files,
        });

        if (kind === "html") {
          const target = await pickSavePath(
            `${sanitizeFileName(exportTitle)}.html`,
            "HTML",
            ["html"],
          );
          if (!target) return;
          await writeFilePath(
            target,
            textToBytes(buildStandaloneHtml(markup, exportTitle, state.lang)),
          );
          pushToast(translate(state.lang, "exportedHtml"), "success");
          return;
        }

        const target = await pickSavePath(
          `${sanitizeFileName(exportTitle)}.pdf`,
          "PDF",
          ["pdf"],
        );
        if (!target) return;
        const html = buildPrintHtml(markup, exportTitle, state.lang);
        if (isDesktop) {
          await exportPdf(html, target);
          pushToast(translate(state.lang, "exportedPdf"), "success");
        } else {
          openPrintWindow(html);
          pushToast(translate(state.lang, "pdfPrintFallback"), "info");
        }
      } catch (error) {
        await showError(
          translate(state.lang, "exportError"),
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        setBusy(null);
      }
    },
    [pushToast],
  );

  /* --------------------------------------------------------- presentation */

  const buildAudiencePayload = useCallback((start: number): AudienceInit => {
    const state = useAppStore.getState();
    const parsed = parseDeck(state.markdown);
    const assets: Record<string, string> = {};
    for (const [path, bytes] of state.files) {
      if (isImagePath(path) || isFontPath(path)) assets[path] = fileToDataUrl(bytes, path);
    }
    return {
      slides: parsed.slides,
      theme: resolveTheme(parsed.frontMatter.theme),
      paginate: parsed.frontMatter.paginate !== false,
      lang: state.lang,
      title: state.manifest.title.trim() || translate(state.lang, "untitled"),
      index: start,
      assets,
    };
  }, []);

  const showAudience = useCallback(async () => {
    const info = audienceRef.current;
    const payload = audiencePayloadRef.current;
    if (!info || !payload) return;
    audienceReadyPendingRef.current = false;
    audienceReadyRef.current = true;
    if (audienceTimeoutRef.current) {
      window.clearTimeout(audienceTimeoutRef.current);
      audienceTimeoutRef.current = null;
    }
    await emitToDesktopWindow(info.label, AUDIENCE_INIT, payload).catch(() => undefined);
    await info.window.setFullscreenOnMonitor(info.monitor.position).catch(async () => {
      await info.window.setFullscreen(true).catch(() => undefined);
    });
    await info.window.show().catch(() => undefined);
    await emitToDesktopWindow(
      info.label,
      AUDIENCE_INDEX,
      presenterIndexRef.current,
    ).catch(() => undefined);
    await focusMainWindow();
  }, []);

  const exitPresentation = useCallback(
    (index: number) => {
      if (audienceTimeoutRef.current) {
        window.clearTimeout(audienceTimeoutRef.current);
        audienceTimeoutRef.current = null;
      }
      const info = audienceRef.current;
      audienceRef.current = null;
      audiencePayloadRef.current = null;
      audienceReadyRef.current = false;
      audienceReadyPendingRef.current = false;
      startingRef.current = false;
      setAudienceMonitor(null);
      if (info) {
        closingAudienceRef.current = true;
        void info.window
          .close()
          .catch(() => undefined)
          .finally(() => {
            closingAudienceRef.current = false;
          });
      }
      setSession(null);
      const next = clamp(index, 0, Math.max(0, slides.length - 1));
      activeRef.current = next;
      setActive(next);
      originRef.current = null;
      const line = lineForSlide(slides, next);
      setCursorLine(line);
      editorRef.current?.scrollToLine(line, { cursor: true });
      void setWindowFullscreen(false).catch(() => undefined);
    },
    [slides],
  );
  exitPresentationRef.current = exitPresentation;

  const handlePresenterIndex = useCallback((index: number) => {
    const next = clamp(index, 0, Math.max(0, slideCountRef.current - 1));
    presenterIndexRef.current = next;
    setPresenterIndex(next);
  }, []);

  const startPresentation = useCallback(
    async (from?: number) => {
      if (slides.length === 0 || sessionRef.current || startingRef.current) return;
      startingRef.current = true;
      const start = clamp(from ?? activeRef.current, 0, slides.length - 1);

      if (isDesktop) {
        try {
          const info = await createAudienceWindow();
          if (info) {
            const wasReady = audienceReadyPendingRef.current;
            audienceRef.current = info;
            audiencePayloadRef.current = buildAudiencePayload(start);
            audienceReadyRef.current = false;
            audienceReadyPendingRef.current = false;
            setAudienceMonitor(info.monitorName);
            presenterIndexRef.current = start;
            setPresenterIndex(start);
            setSession({ mode: "presenter", start });
            void setWindowFullscreen(false).catch(() => undefined);

            // Show the audience window immediately (black until the deck
            // snapshot arrives) so a hidden WebView2 never stalls loading.
            await info.window
              .setFullscreenOnMonitor(info.monitor.position)
              .catch(async () => {
                await info.window.setFullscreen(true).catch(() => undefined);
              });
            await info.window.show().catch(() => undefined);
            await focusMainWindow();

            if (wasReady) {
              void showAudience();
            }

            void info.window
              .onCloseRequested((event) => {
                if (closingAudienceRef.current) return;
                event.preventDefault();
                exitPresentationRef.current(presenterIndexRef.current);
              })
              .catch(() => undefined);

            if (audienceTimeoutRef.current) {
              window.clearTimeout(audienceTimeoutRef.current);
            }
            audienceTimeoutRef.current = window.setTimeout(() => {
              if (audienceReadyRef.current || sessionRef.current?.mode !== "presenter") return;
              pushToast(
                translate(useAppStore.getState().lang, "audienceFailed"),
                "error",
              );
              exitPresentationRef.current(presenterIndexRef.current);
              setSession({ mode: "overlay", start: presenterIndexRef.current });
              void setWindowFullscreen(true).catch(() => undefined);
            }, 9000);
            startingRef.current = false;
            return;
          }
        } catch (error) {
          await showError(
            translate(useAppStore.getState().lang, "audienceFailed"),
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      setSession({ mode: "overlay", start });
      setPresenterIndex(start);
      void setWindowFullscreen(true).catch(() => undefined);
      startingRef.current = false;
    },
    [buildAudiencePayload, pushToast, showAudience, slides.length],
  );

  useEffect(() => {
    if (!isDesktop) return;
    let disposed = false;
    let unReady: (() => void) | undefined;
    let unNav: (() => void) | undefined;
    let unExit: (() => void) | undefined;

    void (async () => {
      try {
        unReady = await listenDesktop(AUDIENCE_READY, () => {
          audienceReadyPendingRef.current = true;
          void showAudience();
        });
        unNav = await listenDesktop<number>(AUDIENCE_NAV, (delta) => {
          if (sessionRef.current?.mode !== "presenter") return;
          handlePresenterIndex(presenterIndexRef.current + delta);
        });
        unExit = await listenDesktop(AUDIENCE_EXIT, () => {
          if (sessionRef.current?.mode === "presenter") {
            exitPresentationRef.current(presenterIndexRef.current);
          }
        });
      } catch {
        /* ignore */
      }
      if (disposed) {
        unReady?.();
        unNav?.();
        unExit?.();
      }
    })();

    return () => {
      disposed = true;
      unReady?.();
      unNav?.();
      unExit?.();
    };
  }, [handlePresenterIndex, showAudience]);

  useEffect(() => {
    const info = audienceRef.current;
    if (!info || !audienceReadyRef.current || session?.mode !== "presenter") return;
    void emitToDesktopWindow(info.label, AUDIENCE_INDEX, presenterIndex).catch(() => undefined);
  }, [presenterIndex, session?.mode]);

  useEffect(
    () => () => {
      if (audienceTimeoutRef.current) window.clearTimeout(audienceTimeoutRef.current);
      closingAudienceRef.current = true;
      void audienceRef.current?.window.close().catch(() => undefined);
    },
    [],
  );

  /* ---------------------------------------------------------- shortcuts etc */

  const insertSlide = useCallback(() => {
    editorRef.current?.insertText("\n\n---\n\n");
    pushToast(t("separatorInserted"));
  }, [pushToast, t]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (session || busy || helpOpen) return;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "s") {
          event.preventDefault();
          void saveProject(event.shiftKey);
        } else if (key === "o") {
          event.preventDefault();
          void openProject();
        } else if (key === "n") {
          event.preventDefault();
          void newPresentation();
        }
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        void startPresentation();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, busy, helpOpen, saveProject, openProject, newPresentation, startPresentation]);

  useEffect(() => {
    const guard = onCloseRequested(async () => {
      const state = useAppStore.getState();
      if (!state.dirty) return true;

      if (state.filePath) {
        try {
          const bytes = writeProject({
            markdownPath: state.markdownPath,
            markdown: state.markdown,
            manifest: state.manifest,
            files: state.files,
          });
          await writeFilePath(state.filePath, bytes);
          useAppStore.getState().markSaved(state.filePath);
          await deleteRecoveryDraft();
          return true;
        } catch {
          const discard = await confirmDialog(t("autosaveFailedClose"), {
            title: "MarkPoint",
            kind: "warning",
            okLabel: t("discard"),
            cancelLabel: t("cancel"),
          });
          if (!discard) return false;
          await deleteRecoveryDraft();
          return true;
        }
      }

      const discard = await confirmDialog(t("confirmClose"), {
        title: "MarkPoint",
        kind: "warning",
        okLabel: t("discard"),
        cancelLabel: t("cancel"),
      });
      if (discard) await deleteRecoveryDraft();
      return discard;
    });
    return () => guard.unlisten();
  }, [t]);

  /* ------------------------------------------------------------- splitter */

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    setResizing(true);
    let latest = 46;
    const move = (pointerEvent: PointerEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;
      latest = Math.min(72, Math.max(26, ((pointerEvent.clientX - rect.left) / rect.width) * 100));
      setEditorWidth(latest);
    };
    const up = () => {
      setResizing(false);
      try {
        localStorage.setItem("markpoint.split", String(Math.round(latest)));
      } catch {
        /* ignore */
      }
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  /* ---------------------------------------------------------- browser drop */

  const onBrowserDragEnter = (event: React.DragEvent) => {
    if (isDesktop) return;
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragActive(true);
  };

  const onBrowserDragOver = (event: React.DragEvent) => {
    if (isDesktop) return;
    event.preventDefault();
  };

  const onBrowserDragLeave = (event: React.DragEvent) => {
    if (isDesktop) return;
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragActive(false);
    }
  };

  const onBrowserDrop = async (event: React.DragEvent) => {
    if (isDesktop) return;
    event.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    const dropped = Array.from(event.dataTransfer.files);
    if (dropped.length === 0) return;

    const projectFile = dropped.find((file) => hasMarkpointExtension(file.name));
    if (projectFile) {
      if (!(await confirmDiscard())) return;
      const project = readProject(new Uint8Array(await projectFile.arrayBuffer()), projectFile.name);
      applyProject(project, null);
      return;
    }

    const images: Array<{ name: string; bytes: Uint8Array }> = [];
    for (const file of dropped) {
      if (!isImagePath(file.name)) continue;
      images.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    }
    addImages(images);
  };

  const deckName = deckTitle(deck.frontMatter, title);
  const pathLabel = filePath ? basename(filePath) : t("project");
  const autoSavedLabel = autoSavedAt
    ? t("autosavedAt", { time: new Date(autoSavedAt).toLocaleTimeString() })
    : t("autosaveOn");

  return (
    <div
      className="app-shell"
      onDragEnter={onBrowserDragEnter}
      onDragOver={onBrowserDragOver}
      onDragLeave={onBrowserDragLeave}
      onDrop={(event) => void onBrowserDrop(event)}
    >
      <ThemeStyle theme={resolvedTheme} resolve={resolveSrc} />
      <Toolbar
        busy={Boolean(busy)}
        recent={recent}
        onNew={() => void newPresentation()}
        onOpen={() => void openProject()}
        onOpenRecent={(path) => void openPath(path)}
        onRemoveRecent={(path) => setRecent(forgetRecent(path))}
        onSave={() => void saveProject(false)}
        onSaveAs={() => void saveProject(true)}
        onInsertSlide={insertSlide}
        onExport={(kind) => void exportDeck(kind)}
        onPresent={() => void startPresentation()}
        onHelp={() => setHelpOpen(true)}
        theme={resolvedTheme}
        savedThemes={savedThemes}
        onSelectTheme={(id) => void applyTheme(id)}
        onSelectSavedTheme={(stored) => void applySavedTheme(stored)}
        onManageThemes={() => setThemeManagerOpen(true)}
      />

      <div className="workspace" ref={workspaceRef}>
        <section className="pane editor-pane" style={{ width: `${editorWidth}%`, flex: "0 0 auto" }}>
          <div className="pane-header">
            <span>{t("editor")}</span>
          </div>
          <EditorPane
            ref={editorRef}
            value={markdown}
            placeholder={t("emptyEditor")}
            activeLines={activeLines}
            themeHints={themeHints}
            onChange={setMarkdown}
            onCursorLine={handleEditorCursor}
            onScrollLine={handleEditorScroll}
            onInsertImage={() => void insertImages()}
          />
        </section>

        <div
          className={`splitter${resizing ? " dragging" : ""}`}
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panes"
        />

        <section className="pane preview-pane" style={{ flex: 1 }}>
          <div className="pane-header">
            <span>{t("preview")}</span>
            <span className="hint">{t("slideCount", { n: slides.length })}</span>
          </div>
          <PreviewPane
            ref={previewRef}
            slides={slides}
            theme={resolvedTheme}
            activeIndex={active}
            paginate={paginate}
            resolve={resolveSrc}
            onActivate={handleSlideClick}
            onPreviewActive={handlePreviewActive}
            onPresentFrom={(index) => void startPresentation(index)}
          />
        </section>
      </div>

      <footer className="statusbar">
        <span className="status-item">
          <span className={`status-dot${dirty ? " dirty" : ""}`} />
          {dirty ? t("unsaved") : t("saved")}
        </span>
        <span className="status-item status-path" title={filePath ?? deckName}>
          {pathLabel}
        </span>
        {isDesktop && filePath ? (
          <span className="status-item" title={autoSavedLabel}>
            <Icon name="clock" size={11} />
            {t("autosaveOn")}
          </span>
        ) : null}
        {isDesktop && !filePath && recoverySavedAt ? (
          <span className="status-item">{t("recoveryDraft")}</span>
        ) : null}
        <span className="status-spacer" />
        <span className="status-item">
          {t("slideNumber", { n: active + 1, total: slides.length })}
        </span>
        <span className="status-item">{t("line", { n: cursorLine })}</span>
        <span className="status-item">{t("fitLabel")}</span>
        <span className="status-item">{t("shortcuts")}</span>
      </footer>

      <ToastStack items={toasts} />
      {helpOpen ? <HelpDialog onClose={() => setHelpOpen(false)} /> : null}
      {themeManagerOpen ? (
        <ThemeManager
          theme={resolvedTheme}
          saved={savedThemes}
          onClose={() => {
            setThemeManagerOpen(false);
            void refreshThemes();
          }}
          onThemesChanged={refreshThemes}
          onApplyPreset={(id) => {
            void applyTheme(id);
            setThemeManagerOpen(false);
          }}
          onApplySaved={applySavedTheme}
          onAddFont={addThemeFont}
        />
      ) : null}
      {busy ? <BusyOverlay label={busy} /> : null}

      {dragActive ? (
        <div className="drop-overlay">
          <div className="drop-overlay-card">
            <Icon name="image" size={22} />
            {t("dropImages")}
          </div>
        </div>
      ) : null}

      {session?.mode === "overlay" ? (
        <Presentation
          slides={slides}
          initialIndex={session.start}
          theme={resolvedTheme}
          paginate={paginate}
          resolve={resolveSrc}
          onExit={exitPresentation}
        />
      ) : null}

      {session?.mode === "presenter" ? (
        <Presenter
          slides={slides}
          index={presenterIndex}
          theme={resolvedTheme}
          paginate={paginate}
          resolve={resolveSrc}
          audienceMonitor={audienceMonitor}
          onIndexChange={handlePresenterIndex}
          onExit={exitPresentation}
        />
      ) : null}
    </div>
  );
}
