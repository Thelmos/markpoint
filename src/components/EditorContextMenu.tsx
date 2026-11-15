import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "../lib/i18n";
import { Icon } from "./Icons";

export type EditorFormat = "bold" | "italic" | "heading1" | "heading2" | "heading3";

interface EditorContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onInsertImage: () => void;
  onFormat: (format: EditorFormat) => void;
  onClose: () => void;
}

const HEADINGS: Array<{ format: EditorFormat; label: string; glyph: string }> = [
  { format: "heading1", label: "contextHeading1", glyph: "#" },
  { format: "heading2", label: "contextHeading2", glyph: "##" },
  { format: "heading3", label: "contextHeading3", glyph: "###" },
];

export function EditorContextMenu({
  x,
  y,
  hasSelection,
  onInsertImage,
  onFormat,
  onClose,
}: EditorContextMenuProps) {
  const t = useT();
  const ref = useRef<HTMLDivElement | null>(null);
  const firstItemRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ left: x, top: y });
  const [headingsOpen, setHeadingsOpen] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const margin = 8;
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    });
  }, [x, y]);

  useEffect(() => {
    firstItemRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onBlur = () => onClose();

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", onBlur);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("resize", onBlur);
    };
  }, [onClose]);

  useEffect(() => {
    if (!hasSelection) setHeadingsOpen(false);
  }, [hasSelection]);

  const openLeft = position.left + 420 > window.innerWidth;
  const flyoutUp = position.top > window.innerHeight / 2;

  return createPortal(
    <div
      className="editor-context-menu"
      style={{ left: position.left, top: position.top }}
      ref={ref}
      role="menu"
      aria-label={t("contextMenu")}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        className="context-menu-item"
        role="menuitem"
        ref={firstItemRef}
        onClick={() => {
          onClose();
          onInsertImage();
        }}
      >
        <Icon name="image" size={14} className="context-menu-icon" />
        <span className="context-menu-label">{t("contextInsertImage")}</span>
      </button>

      <div className="context-menu-separator" role="separator" />

      <button
        className="context-menu-item"
        role="menuitem"
        disabled={!hasSelection}
        onClick={() => onFormat("bold")}
      >
        <span className="context-menu-glyph bold">B</span>
        <span className="context-menu-label">{t("contextBold")}</span>
      </button>
      <button
        className="context-menu-item"
        role="menuitem"
        disabled={!hasSelection}
        onClick={() => onFormat("italic")}
      >
        <span className="context-menu-glyph italic">I</span>
        <span className="context-menu-label">{t("contextItalic")}</span>
      </button>

      <div
        className="context-menu-submenu-wrap"
        onPointerEnter={() => {
          if (hasSelection) setHeadingsOpen(true);
        }}
        onPointerLeave={() => setHeadingsOpen(false)}
      >
        <button
          className="context-menu-item"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={headingsOpen}
          disabled={!hasSelection}
          onClick={() => setHeadingsOpen((value) => !value)}
        >
          <span className="context-menu-glyph">H</span>
          <span className="context-menu-label">{t("contextHeading")}</span>
          <Icon name="chevron-right" size={13} className="context-menu-arrow" />
        </button>
        {headingsOpen ? (
          <div
            className={`editor-context-menu context-menu-flyout${openLeft ? " align-left" : ""}${
              flyoutUp ? " open-up" : ""
            }`}
            role="menu"
            aria-label={t("contextHeading")}
          >
            {HEADINGS.map((heading) => (
              <button
                className="context-menu-item"
                role="menuitem"
                key={heading.format}
                onClick={() => onFormat(heading.format)}
              >
                <span className="context-menu-glyph mono">{heading.glyph}</span>
                <span className="context-menu-label">{t(heading.label)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
