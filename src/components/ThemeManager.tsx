import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedTheme } from "../types";
import { sanitizeFileName } from "../lib/assets";
import {
  confirmDialog,
  pickSavePath,
  pickThemeFile,
  showError,
  writeFilePath,
} from "../lib/tauri";
import { useAppStore } from "../store";
import { useT } from "../lib/i18n";
import { PRESETS, resolveTheme, swatchFor } from "../lib/themes";
import {
  createThemeId,
  decodeTheme,
  encodeTheme,
  loadThemes,
  saveThemes,
  storeCurrentTheme,
  type StoredTheme,
} from "../lib/themeLibrary";
import { Icon } from "./Icons";

interface ThemeManagerProps {
  theme: ResolvedTheme;
  saved: StoredTheme[];
  onClose: () => void;
  onThemesChanged: () => void | Promise<void>;
  onApplyPreset: (id: string) => void;
  onApplySaved: (theme: StoredTheme) => void;
  onAddFont: () => Promise<void>;
}

export function ThemeManager({
  theme,
  saved,
  onClose,
  onThemesChanged,
  onApplyPreset,
  onApplySaved,
  onAddFont,
}: ThemeManagerProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [list, setList] = useState<StoredTheme[]>(saved);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const statusTimer = useRef<number | null>(null);

  const showStatus = useCallback((text: string) => {
    setStatus(text);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(""), 2600);
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    };
  }, [onClose]);

  const reload = useCallback(async () => {
    try {
      setList(await loadThemes());
    } catch {
      /* keep the current list */
    }
    await onThemesChanged();
  }, [onThemesChanged]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      try {
        await action();
      } catch (error) {
        await showError(t("themeError"), error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const saveCurrent = () =>
    run(async () => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const record = storeCurrentTheme(trimmed, theme, useAppStore.getState().files);
      const next = [...list.filter((item) => item.name !== record.name), record];
      await saveThemes(next);
      setList(next);
      setName("");
      showStatus(t("themeSaved"));
      await onThemesChanged();
    });

  const applyPreset = (id: string) => {
    onApplyPreset(id);
    onClose();
  };

  const applySaved = (stored: StoredTheme) => {
    onApplySaved(stored);
    onClose();
  };

  const remove = (stored: StoredTheme) =>
    run(async () => {
      const confirmed = await confirmDialog(t("themeDeleteConfirm", { name: stored.name }), {
        title: "MarkPoint",
        kind: "warning",
        okLabel: t("delete"),
        cancelLabel: t("cancel"),
      });
      if (!confirmed) return;
      const next = list.filter((item) => item.id !== stored.id);
      await saveThemes(next);
      setList(next);
      showStatus(t("themeDeleted"));
      await onThemesChanged();
    });

  const commitRename = () =>
    run(async () => {
      if (!renaming) return;
      const value = renaming.value.trim();
      if (!value) return;
      const next = list.map((item) => (item.id === renaming.id ? { ...item, name: value } : item));
      await saveThemes(next);
      setList(next);
      setRenaming(null);
      showStatus(t("themeRenamed"));
      await onThemesChanged();
    });

  const duplicate = (stored: StoredTheme) =>
    run(async () => {
      const copy: StoredTheme = {
        ...stored,
        id: createThemeId(stored.name),
        name: `${stored.name} ${t("themeCopySuffix")}`,
      };
      const next = [...list, copy];
      await saveThemes(next);
      setList(next);
      showStatus(t("themeDuplicated"));
      await onThemesChanged();
    });

  const exportTheme = (stored: StoredTheme) =>
    run(async () => {
      const target = await pickSavePath(
        `${sanitizeFileName(stored.name, "theme")}.json`,
        t("themeFileFilter"),
        ["json"],
      );
      if (!target) return;
      await writeFilePath(target, encodeTheme(stored));
      showStatus(t("themeExported"));
    });

  const importTheme = () =>
    run(async () => {
      const picked = await pickThemeFile(t("themeFileFilter"));
      if (!picked) return;
      const imported = decodeTheme(picked.bytes);
      const next = [
        ...list,
        list.some((item) => item.name === imported.name)
          ? { ...imported, name: `${imported.name} ${t("themeImportedSuffix")}` }
          : imported,
      ];
      await saveThemes(next);
      setList(next);
      showStatus(t("themeImported"));
      await onThemesChanged();
    });

  return (
    <div
      className="help-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="help-dialog theme-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-manager-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="help-header">
          <div>
            <h2 id="theme-manager-title">{t("themeManage")}</h2>
            <p>{t("themeManagerDesc")}</p>
          </div>
          <button className="btn icon" onClick={onClose} title={t("close")} aria-label={t("close")}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="help-body theme-manager">
          <p className="help-note">{t("themeManagerHint")}</p>

          <section className="help-section">
            <h3>{t("themeBuiltin")}</h3>
            <div className="theme-list">
              {PRESETS.map((preset) => (
                <div className="theme-row" key={preset.id}>
                  <span className="theme-swatch" style={{ background: preset.swatch }} />
                  <span className="theme-row-name">{t(preset.labelKey)}</span>
                  {theme.presetId === preset.id ? (
                    <span className="theme-current">{t("themeCurrent")}</span>
                  ) : (
                    <button
                      className="btn ghost"
                      onClick={() => applyPreset(preset.id)}
                      disabled={busy}
                    >
                      {t("themeApply")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="help-section">
            <h3>{t("themeMine")}</h3>
            {list.length === 0 ? (
              <p className="help-note">{t("themeEmpty")}</p>
            ) : (
              <div className="theme-list">
                {list.map((stored) => (
                  <div className="theme-row" key={stored.id}>
                    <span
                      className="theme-swatch"
                      style={{ background: swatchFor(resolveTheme(stored.spec)) }}
                    />
                    {renaming?.id === stored.id ? (
                      <input
                        className="theme-input"
                        value={renaming.value}
                        autoFocus
                        onChange={(event) =>
                          setRenaming({ id: stored.id, value: event.target.value })
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void commitRename();
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            setRenaming(null);
                          }
                        }}
                      />
                    ) : (
                      <span className="theme-row-name">
                        {stored.name}
                        {stored.fonts.length > 0 ? (
                          <span className="theme-row-meta">
                            {t("themeFontCount", { n: stored.fonts.length })}
                          </span>
                        ) : null}
                      </span>
                    )}

                    {renaming?.id === stored.id ? (
                      <>
                        <button
                          className="btn icon"
                          title={t("save")}
                          onClick={() => void commitRename()}
                          disabled={busy}
                        >
                          <Icon name="check" size={14} />
                        </button>
                        <button
                          className="btn icon"
                          title={t("cancel")}
                          onClick={() => setRenaming(null)}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </>
                    ) : (
                      <div className="theme-row-actions">
                        <button
                          className="btn icon"
                          title={t("themeApply")}
                          onClick={() => applySaved(stored)}
                          disabled={busy}
                        >
                          <Icon name="check" size={14} />
                        </button>
                        <button
                          className="btn icon"
                          title={t("themeRename")}
                          onClick={() => setRenaming({ id: stored.id, value: stored.name })}
                          disabled={busy}
                        >
                          <Icon name="pencil" size={14} />
                        </button>
                        <button
                          className="btn icon"
                          title={t("themeDuplicate")}
                          onClick={() => void duplicate(stored)}
                          disabled={busy}
                        >
                          <Icon name="copy" size={14} />
                        </button>
                        <button
                          className="btn icon"
                          title={t("themeExport")}
                          onClick={() => void exportTheme(stored)}
                          disabled={busy}
                        >
                          <Icon name="download" size={14} />
                        </button>
                        <button
                          className="btn icon"
                          title={t("themeDelete")}
                          onClick={() => void remove(stored)}
                          disabled={busy}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form
              className="theme-save"
              onSubmit={(event) => {
                event.preventDefault();
                void saveCurrent();
              }}
            >
              <input
                className="theme-input"
                value={name}
                placeholder={t("themeName")}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
              />
              <button className="btn" type="submit" disabled={busy || !name.trim()}>
                <Icon name="save" size={14} />
                {t("themeSave")}
              </button>
              <button
                className="btn ghost"
                type="button"
                onClick={() => void importTheme()}
                disabled={busy}
              >
                <Icon name="upload" size={14} />
                {t("themeImport")}
              </button>
            </form>
            {status ? <p className="theme-status">{status}</p> : null}
          </section>

          <section className="help-section">
            <h3>{t("themeFonts")}</h3>
            {theme.fonts.length === 0 ? (
              <p className="help-note">{t("themeNoFonts")}</p>
            ) : (
              <ul className="theme-fonts">
                {theme.fonts.map((font) => (
                  <li key={`${font.family}-${font.file}`}>
                    <code>{font.family}</code>
                    <span>{font.file}</span>
                  </li>
                ))}
              </ul>
            )}
            <button className="btn ghost" onClick={() => void onAddFont()} disabled={busy}>
              <Icon name="plus" size={14} />
              {t("themeAddFont")}
            </button>
            <p className="help-note">{t("themeFontsHint")}</p>
          </section>
        </div>

        <footer className="help-footer">
          <button className="btn primary" onClick={onClose}>
            {t("close")}
          </button>
        </footer>
      </div>
    </div>
  );
}
