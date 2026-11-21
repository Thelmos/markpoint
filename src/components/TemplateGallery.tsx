import { useEffect, useRef, useState } from "react";
import type { TemplatePack } from "../lib/templates";
import { parseDeck } from "../lib/parser";
import { bytesToDataUrl } from "../lib/assets";
import { useT } from "../lib/i18n";
import { Icon } from "./Icons";

interface TemplateGalleryProps {
  templates: TemplatePack[];
  busy: boolean;
  onClose: () => void;
  onCreate: (pack: TemplatePack) => void;
  onImport: () => void;
  onExport: (pack: TemplatePack) => void;
  onRename: (pack: TemplatePack, name: string) => Promise<void>;
  onDelete: (pack: TemplatePack) => void;
}

function thumbnail(pack: TemplatePack): string | null {
  const cover = pack.arts.cover;
  return cover ? bytesToDataUrl(cover, "image/svg+xml") : null;
}

export function TemplateGallery({
  templates,
  busy,
  onClose,
  onCreate,
  onImport,
  onExport,
  onRename,
  onDelete,
}: TemplateGalleryProps) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const commitRename = async (pack: TemplatePack) => {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (!value) return;
    await onRename(pack, value);
    setRenaming(null);
  };

  return (
    <div
      className="help-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="help-dialog template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="help-header">
          <div>
            <h2 id="template-gallery-title">{t("templateGallery")}</h2>
            <p>{t("templateGalleryDesc")}</p>
          </div>
          <button className="btn icon" onClick={onClose} title={t("close")} aria-label={t("close")}>
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="help-body template-gallery">
          {templates.length === 0 ? (
            <p className="help-note">{t("templateEmpty")}</p>
          ) : (
            <div className="template-grid">
              {templates.map((pack) => {
                const cover = thumbnail(pack);
                const isRenaming = renaming?.id === pack.id;
                return (
                  <article className="template-card" key={pack.id}>
                    <div className="template-thumb">
                      {cover ? (
                        <img src={cover} alt="" />
                      ) : (
                        <div className="template-thumb-empty">
                          <Icon name="template" size={26} />
                          <span>{t("templateNoPreview")}</span>
                        </div>
                      )}
                    </div>
                    <div className="template-card-body">
                      {isRenaming ? (
                        <input
                          className="theme-input"
                          value={renaming.value}
                          autoFocus
                          maxLength={80}
                          onChange={(event) =>
                            setRenaming({ id: pack.id, value: event.target.value })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void commitRename(pack);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              event.stopPropagation();
                              setRenaming(null);
                            }
                          }}
                        />
                      ) : (
                        <h3>{pack.name}</h3>
                      )}
                      <p>{pack.description || t("templateNoDescription")}</p>
                      <div className="template-card-meta">
                        <span>{t("slideCount", { n: parseDeck(pack.example).slides.length })}</span>
                        {pack.fonts.length > 0 ? (
                          <span>{t("themeFontCount", { n: pack.fonts.length })}</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="template-card-actions">
                      {isRenaming ? (
                        <>
                          <button
                            className="btn icon"
                            title={t("save")}
                            onClick={() => void commitRename(pack)}
                            disabled={busy}
                          >
                            <Icon name="check" size={14} />
                          </button>
                          <button
                            className="btn icon"
                            title={t("cancel")}
                            onClick={() => setRenaming(null)}
                            disabled={busy}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn primary template-create"
                            onClick={() => onCreate(pack)}
                            disabled={busy}
                          >
                            <Icon name="play" size={13} />
                            {t("templateCreate")}
                          </button>
                          <button
                            className="btn icon"
                            title={t("templateExport")}
                            onClick={() => onExport(pack)}
                            disabled={busy}
                          >
                            <Icon name="download" size={14} />
                          </button>
                          <button
                            className="btn icon"
                            title={t("themeRename")}
                            onClick={() => setRenaming({ id: pack.id, value: pack.name })}
                            disabled={busy}
                          >
                            <Icon name="pencil" size={14} />
                          </button>
                          <button
                            className="btn icon"
                            title={t("templateDelete")}
                            onClick={() => onDelete(pack)}
                            disabled={busy}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="help-note">{t("templateImportHint")}</p>
        </div>

        <footer className="help-footer template-footer">
          <button className="btn" onClick={onImport} disabled={busy}>
            <Icon name="upload" size={14} />
            {t("templateImport")}
          </button>
          <span className="template-footer-spacer" />
          <button className="btn primary" onClick={onClose}>
            {t("close")}
          </button>
        </footer>
      </div>
    </div>
  );
}
