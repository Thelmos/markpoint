import { useEffect, useRef, useState } from "react";
import type { DeckBackground } from "../lib/background";
import type { SrcResolver } from "../lib/markdown";
import { useT } from "../lib/i18n";
import { Icon } from "./Icons";

interface BackgroundPickerProps {
  current: DeckBackground | null;
  backgrounds: DeckBackground[];
  resolve: SrcResolver;
  onSelect: (background: DeckBackground) => void;
  onClear: () => void;
  onPick: () => void;
}

function imageStyle(src: string, resolve: SrcResolver, fit: "cover" | "contain") {
  return {
    backgroundImage: `url(${JSON.stringify(resolve(src))})`,
    backgroundSize: fit,
  };
}

export function BackgroundPicker({
  current,
  backgrounds,
  resolve,
  onSelect,
  onClear,
  onPick,
}: BackgroundPickerProps) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    setOpen(false);
  }, [current?.src, current?.fit]);

  const nameFor = (src: string): string => {
    if (/^data:/i.test(src)) return t("backgroundInline");
    const clean = src.split(/[?#]/)[0];
    const name = clean.split("/").pop() || src;
    try {
      return decodeURIComponent(name);
    } catch {
      return name;
    }
  };

  return (
    <div className="background-picker">
      <span className="layout-picker-label">{t("background")}</span>
      <div className="menu-wrap" ref={wrapRef}>
        <button
          type="button"
          className={`background-picker-button${open ? " active" : ""}`}
          title={current ? `${t("backgroundTooltip")}: ${current.src}` : t("backgroundTooltip")}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("background")}
          onClick={() => setOpen((value) => !value)}
        >
          {current ? (
            <span
              className={`background-picker-thumb${current.fit === "contain" ? " contain" : ""}`}
              style={imageStyle(current.src, resolve, current.fit)}
            />
          ) : (
            <span className="background-picker-thumb empty">
              <Icon name="background" size={12} />
            </span>
          )}
          <span className="background-picker-name">
            {current ? nameFor(current.src) : t("backgroundNone")}
          </span>
          <Icon name="chevron-down" className="sm" />
        </button>

        {open ? (
          <div className="menu background-picker-menu" role="menu" aria-label={t("background")}>
            {current ? (
              <button
                className="menu-item background-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClear();
                }}
              >
                <span className="background-thumb none">
                  <Icon name="x" size={13} />
                </span>
                <span className="background-item-text">
                  <span className="menu-item-title">{t("backgroundRemove")}</span>
                </span>
              </button>
            ) : null}

            {backgrounds.length === 0 ? (
              <div className="background-empty">{t("backgroundEmpty")}</div>
            ) : (
              backgrounds.map((background) => {
                const selected =
                  current?.src === background.src && current?.fit === background.fit;
                return (
                  <button
                    key={`${background.src}-${background.fit}`}
                    className="menu-item background-item"
                    role="menuitemradio"
                    aria-checked={selected}
                    title={background.src}
                    onClick={() => {
                      setOpen(false);
                      onSelect(background);
                    }}
                  >
                    <span
                      className={`background-thumb${background.fit === "contain" ? " contain" : ""}`}
                      style={imageStyle(background.src, resolve, background.fit)}
                    />
                    <span className="background-item-text">
                      <span className="menu-item-title">{nameFor(background.src)}</span>
                      <span className="menu-item-desc">
                        {background.fit === "contain" ? t("backgroundContain") : t("backgroundCover")}
                      </span>
                    </span>
                    {selected ? <Icon name="check" size={14} className="theme-check" /> : null}
                  </button>
                );
              })
            )}

            <div className="menu-separator" role="separator" />
            <button
              className="menu-item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick();
              }}
            >
              <Icon name="image" />
              <span>
                <span className="menu-item-title">{t("backgroundPick")}</span>
                <span className="menu-item-desc">{t("backgroundPickDesc")}</span>
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
