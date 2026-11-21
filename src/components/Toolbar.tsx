import { useEffect, useRef, useState } from "react";
import type { ResolvedTheme } from "../types";
import { PRESETS, presetById, resolveTheme, swatchFor } from "../lib/themes";
import type { StoredTheme } from "../lib/themeLibrary";
import type { RecentFile } from "../lib/recent";
import { useAppStore } from "../store";
import { useT } from "../lib/i18n";
import { Icon, LogoMark } from "./Icons";

export type ExportKind = "html" | "pdf";

interface ToolbarProps {
  busy: boolean;
  recent: RecentFile[];
  theme: ResolvedTheme;
  savedThemes: StoredTheme[];
  onNew: () => void;
  onNewFromTemplate: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onRemoveRecent: (path: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onInsertSlide: () => void;
  onExport: (kind: ExportKind) => void;
  onPresent: () => void;
  onHelp: () => void;
  onSelectTheme: (id: string) => void;
  onSelectSavedTheme: (theme: StoredTheme) => void;
  onManageThemes: () => void;
}

export function Toolbar({
  busy,
  recent,
  theme,
  savedThemes,
  onNew,
  onNewFromTemplate,
  onOpen,
  onOpenRecent,
  onRemoveRecent,
  onSave,
  onSaveAs,
  onInsertSlide,
  onExport,
  onPresent,
  onHelp,
  onSelectTheme,
  onSelectSavedTheme,
  onManageThemes,
}: ToolbarProps) {
  const t = useT();
  const title = useAppStore((state) => state.manifest.title);
  const setTitle = useAppStore((state) => state.setTitle);
  const lang = useAppStore((state) => state.lang);
  const setLang = useAppStore((state) => state.setLang);
  const dirty = useAppStore((state) => state.dirty);

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [recentOpen, setRecentOpen] = useState(false);
  const recentRef = useRef<HTMLDivElement | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportOpen && !recentOpen && !themeOpen) return;
    const close = (event: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
      if (recentRef.current && !recentRef.current.contains(event.target as Node)) {
        setRecentOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportOpen(false);
        setRecentOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [exportOpen, recentOpen, themeOpen]);

  const currentPreset = presetById(theme.presetId);
  const themeLabel = currentPreset ? t(currentPreset.labelKey) : theme.name || t("themeCustom");
  const themeSwatch = currentPreset ? currentPreset.swatch : swatchFor(theme);

  return (
    <header className="toolbar">
      <div className="brand">
        <div className="brand-logo">
          <LogoMark size={17} />
        </div>
        <div className="brand-name">
          Mark<span>Point</span>
        </div>
      </div>

      <div className="title-wrap" title={t("title")}>
        <input
          className="title-input"
          value={title}
          placeholder={t("untitled")}
          spellCheck={false}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={() => {
            if (!title.trim()) setTitle(t("untitled"));
          }}
        />
        {dirty ? <span className="dirty-dot" title={t("dirtyIndicator")} /> : null}
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button className="btn icon" onClick={onNew} title={t("newPresentation")} disabled={busy}>
          <Icon name="file-plus" />
        </button>
        <button
          className="btn icon"
          onClick={onNewFromTemplate}
          title={t("newFromTemplate")}
          aria-label={t("newFromTemplate")}
          disabled={busy}
        >
          <Icon name="template" />
        </button>
        <button className="btn icon" onClick={onOpen} title={t("open")} disabled={busy}>
          <Icon name="folder-open" />
        </button>
        <div className="menu-wrap" ref={recentRef}>
          <button
            className={`btn icon${recentOpen ? " active" : ""}`}
            onClick={() => {
              setRecentOpen((value) => !value);
              setExportOpen(false);
            }}
            title={t("recentFiles")}
            disabled={busy}
          >
            <Icon name="clock" />
          </button>
          {recentOpen ? (
            <div className="menu recent-menu">
              <div className="recent-menu-header">{t("recentFiles")}</div>
              <button
                className="menu-item"
                onClick={() => {
                  setRecentOpen(false);
                  onOpen();
                }}
              >
                <Icon name="folder-open" />
                <span>
                  <span className="menu-item-title">{t("openFile")}</span>
                </span>
              </button>
              {recent.length === 0 ? (
                <div className="recent-empty">{t("noRecent")}</div>
              ) : (
                recent.map((file) => (
                  <div className="recent-item" key={file.path}>
                    <button
                      className="recent-open"
                      title={file.path}
                      onClick={() => {
                        setRecentOpen(false);
                        onOpenRecent(file.path);
                      }}
                    >
                      <span className="recent-title">{file.title || file.path}</span>
                      <span className="recent-path">{file.path}</span>
                    </button>
                    <button
                      className="recent-remove"
                      title={t("removeRecent")}
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveRecent(file.path);
                      }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button className="btn icon" onClick={onSave} title={`${t("save")} (Ctrl+S)`} disabled={busy}>
          <Icon name="save" />
        </button>
        <button className="btn icon" onClick={onSaveAs} title={t("saveAs")} disabled={busy}>
          <Icon name="save-as" />
        </button>
        <button
          className="btn icon"
          onClick={onInsertSlide}
          title={t("insertSlideShort")}
          disabled={busy}
        >
          <Icon name="plus" />
        </button>
        <button
          className="btn icon"
          onClick={onHelp}
          title={t("helpTooltip")}
          aria-label={t("help")}
          disabled={busy}
        >
          <Icon name="help" />
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-actions">
        <div className="menu-wrap" ref={themeRef}>
          <button
            className={`btn ghost theme-button${themeOpen ? " active" : ""}`}
            onClick={() => {
              setThemeOpen((value) => !value);
              setExportOpen(false);
              setRecentOpen(false);
            }}
            title={t("themeTooltip")}
            aria-label={t("theme")}
            aria-haspopup="menu"
            aria-expanded={themeOpen}
            disabled={busy}
          >
            <span className="theme-swatch" style={{ background: themeSwatch }} />
            <span className="btn-label">{themeLabel}</span>
            <Icon name="chevron-down" className="sm" />
          </button>
          {themeOpen ? (
            <div className="menu theme-menu" role="menu">
              <div className="theme-menu-label">{t("themeBuiltin")}</div>
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  className="menu-item theme-item"
                  role="menuitemradio"
                  aria-checked={theme.presetId === preset.id}
                  onClick={() => {
                    setThemeOpen(false);
                    onSelectTheme(preset.id);
                  }}
                >
                  <span className="theme-swatch" style={{ background: preset.swatch }} />
                  <span className="menu-item-title">{t(preset.labelKey)}</span>
                  {theme.presetId === preset.id ? (
                    <Icon name="check" size={14} className="theme-check" />
                  ) : null}
                </button>
              ))}

              {savedThemes.length > 0 ? (
                <>
                  <div className="theme-menu-label">{t("themeMine")}</div>
                  {savedThemes.map((saved) => (
                    <button
                      key={saved.id}
                      className="menu-item theme-item"
                      role="menuitemradio"
                      aria-checked={!theme.presetId && theme.name === saved.name}
                      onClick={() => {
                        setThemeOpen(false);
                        onSelectSavedTheme(saved);
                      }}
                    >
                      <span
                        className="theme-swatch"
                        style={{ background: swatchFor(resolveTheme(saved.spec)) }}
                      />
                      <span className="menu-item-title">{saved.name}</span>
                      {!theme.presetId && theme.name === saved.name ? (
                        <Icon name="check" size={14} className="theme-check" />
                      ) : null}
                    </button>
                  ))}
                </>
              ) : null}

              <div className="menu-separator" role="separator" />
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  setThemeOpen(false);
                  onManageThemes();
                }}
              >
                <Icon name="more" />
                <span>
                  <span className="menu-item-title">{t("themeManage")}</span>
                  <span className="menu-item-desc">{t("themeManageDesc")}</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>

        <div className="menu-wrap" ref={exportRef}>
          <button
            className={`btn ghost${exportOpen ? " active" : ""}`}
            onClick={() => {
              setExportOpen((value) => !value);
              setRecentOpen(false);
            }}
            title={t("export")}
            disabled={busy}
          >
            <Icon name="download" />
            <span className="btn-label">{t("export")}</span>
            <Icon name="chevron-down" className="sm" />
          </button>
          {exportOpen ? (
            <div className="menu">
              <button
                className="menu-item"
                onClick={() => {
                  setExportOpen(false);
                  onExport("pdf");
                }}
              >
                <Icon name="file-pdf" />
                <span>
                  <span className="menu-item-title">{t("exportPdf")}</span>
                  <span className="menu-item-desc">{t("exportPdfDesc")}</span>
                </span>
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setExportOpen(false);
                  onExport("html");
                }}
              >
                <Icon name="file-code" />
                <span>
                  <span className="menu-item-title">{t("exportHtml")}</span>
                  <span className="menu-item-desc">{t("exportHtmlDesc")}</span>
                </span>
              </button>
            </div>
          ) : null}
        </div>

        <button
          className="btn icon"
          onClick={() => setLang(lang === "es" ? "en" : "es")}
          title={t("langTooltip")}
          aria-label={t("language")}
        >
          <Icon name="globe" />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em" }}>
            {lang.toUpperCase()}
          </span>
        </button>

        <button className="btn primary" onClick={onPresent} title={t("presentTooltip")} disabled={busy}>
          <Icon name="play" size={15} />
          {t("present")}
        </button>
      </div>
    </header>
  );
}
