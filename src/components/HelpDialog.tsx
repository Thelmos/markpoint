import { useEffect, useRef } from "react";
import { useT } from "../lib/i18n";
import { hintKeyFor, THEME_HINT_GROUPS } from "../lib/themeHints";
import { Icon } from "./Icons";

const IMAGE_SYNTAX: Array<{ code: string; label: string }> = [
  { code: "![bg](fondo.jpg)", label: "helpImageBackground" },
  { code: "![bg:contain](logo.png)", label: "helpImageContain" },
  { code: "![left:40%](imagen.png)", label: "helpImageLeft" },
  { code: "![right](imagen.png)", label: "helpImageRight" },
  { code: "![center:60%](logo.png)", label: "helpImageCenter" },
  { code: "![texto](foto.png)", label: "helpImageInline" },
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const dialogRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div
      className="help-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="help-header">
          <div>
            <h2 id="help-title">{t("help")}</h2>
            <p>{t("helpSubtitle")}</p>
          </div>
          <button
            className="btn icon"
            onClick={onClose}
            title={t("close")}
            aria-label={t("close")}
          >
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="help-body">
          <section className="help-section">
            <h3>{t("helpSlidesTitle")}</h3>
            <p>{t("helpSlidesDesc")}</p>
            <pre className="help-code">
              <code>{t("helpSlidesCode")}</code>
            </pre>
          </section>

          <section className="help-section">
            <h3>{t("helpTextTitle")}</h3>
            <p>{t("helpTextDesc")}</p>
            <pre className="help-code">
              <code>{t("helpTextCode")}</code>
            </pre>
            <p className="help-note">{t("helpContextDesc")}</p>
          </section>

          <section className="help-section">
            <h3>{t("helpImagesTitle")}</h3>
            <p>{t("helpImagesDesc")}</p>
            <ul className="help-syntax-list">
              {IMAGE_SYNTAX.map((item) => (
                <li key={item.code}>
                  <code>{item.code}</code>
                  <span>{t(item.label)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="help-section">
            <h3>{t("helpTemplatesTitle")}</h3>
            <p>{t("helpTemplatesDesc")}</p>
            <ul className="help-syntax-list">
              <li>
                <code>Fondo…</code>
                <span>{t("helpTemplatesBackground")}</span>
              </li>
              <li>
                <code>{t("newFromTemplate")}</code>
                <span>{t("helpTemplatesGallery")}</span>
              </li>
            </ul>
            <p className="help-note">{t("helpTemplatesNote")}</p>
          </section>

          <section className="help-section">
            <h3>{t("helpLayoutsTitle")}</h3>
            <p>{t("helpLayoutsDesc")}</p>
            <pre className="help-code">
              <code>{t("helpLayoutsCode")}</code>
            </pre>
            <ul className="help-syntax-list">
              <li>
                <code>section</code>
                <span>{t("helpLayoutSection")}</span>
              </li>
              <li>
                <code>content-1c</code>
                <span>{t("helpLayoutContent1c")}</span>
              </li>
              <li>
                <code>content-2c</code>
                <span>{t("helpLayoutContent2c")}</span>
              </li>
            </ul>
            <p className="help-note">{t("helpLayoutsLevels")}</p>
            <p className="help-note">{t("helpLayoutsApply")}</p>
          </section>

          <section className="help-section">
            <h3>{t("helpThemeTitle")}</h3>
            <p>{t("helpThemeDesc")}</p>
            <pre className="help-code">
              <code>{t("helpThemeCode")}</code>
            </pre>
            <p className="help-note">{t("helpThemeHover")}</p>
            {THEME_HINT_GROUPS.map((group) => (
              <div className="help-hint-group" key={group.titleKey}>
                <h4>{t(group.titleKey)}</h4>
                <ul className="help-syntax-list">
                  {group.keys.map((key) => (
                    <li key={key}>
                      <code>{key}</code>
                      <span>{t(hintKeyFor(key))}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="help-note">{t("helpThemeFonts")}</p>
          </section>

          <section className="help-section">
            <h3>{t("helpNotesTitle")}</h3>
            <p>{t("helpNotesDesc")}</p>
            <pre className="help-code">
              <code>{t("helpNotesCode")}</code>
            </pre>
          </section>

          <section className="help-section">
            <h3>{t("helpMoreTitle")}</h3>
            <p>{t("helpMoreDesc")}</p>
            <div className="help-chips">
              <code>| tabla |</code>
              <code>- [x]</code>
              <code>{"```mermaid"}</code>
              <code>{"$e^{i\\pi}+1=0$"}</code>
              <code>:rocket:</code>
            </div>
          </section>

          <section className="help-section">
            <h3>{t("helpShortcutsTitle")}</h3>
            <p>{t("helpShortcutsDesc")}</p>
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
