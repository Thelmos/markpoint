import { useCallback, useEffect, useRef, useState } from "react";
import type { Slide, ThemeId } from "../types";
import type { SrcResolver } from "../lib/markdown";
import { formatDuration, useT } from "../lib/i18n";
import { SlideView } from "./SlideView";
import { SlideViewport } from "./SlideViewport";
import { Icon, LogoMark } from "./Icons";

interface PresenterProps {
  slides: Slide[];
  index: number;
  theme: ThemeId;
  paginate: boolean;
  resolve: SrcResolver;
  audienceMonitor: string | null;
  onIndexChange: (index: number) => void;
  onExit: (index: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Presenter window shown on the laptop screen while the audience window is
 * fullscreen on the second monitor.
 */
export function Presenter({
  slides,
  index,
  theme,
  paginate,
  resolve,
  audienceMonitor,
  onIndexChange,
  onExit,
}: PresenterProps) {
  const t = useT();
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const indexRef = useRef(index);
  indexRef.current = index;

  const go = useCallback(
    (delta: number) => {
      onIndexChange(clamp(indexRef.current + delta, 0, slides.length - 1));
    },
    [onIndexChange, slides.length],
  );

  const finish = useCallback(() => onExit(indexRef.current), [onExit, indexRef]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
        case "Enter":
          event.preventDefault();
          go(1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
        case "Backspace":
          event.preventDefault();
          go(-1);
          break;
        case "Home":
          event.preventDefault();
          onIndexChange(0);
          break;
        case "End":
          event.preventDefault();
          onIndexChange(slides.length - 1);
          break;
        case "Escape":
          event.preventDefault();
          finish();
          break;
        case "p":
        case "P":
          setRunning((value) => !value);
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [finish, go, onIndexChange, slides.length]);

  const slide = slides[index];
  const next = slides[index + 1];
  if (!slide) return null;

  return (
    <div className="presenter">
      <div className="presenter-top">
        <div className="presenter-brand">
          <span className="presenter-logo">
            <LogoMark size={15} />
          </span>
          <span className="presenter-brand-name">MarkPoint</span>
          <span className="presenter-mode">{t("presenterMode")}</span>
        </div>
        <div className="presenter-top-spacer" />
        <div className={`presenter-timer${running ? "" : " paused"}`}>
          <Icon name="clock" size={14} />
          {formatDuration(seconds)}
        </div>
        <button className="btn icon" onClick={finish} title={t("exitPresenter")}>
          <Icon name="x" />
        </button>
      </div>

      <div className="presenter-progress">
        <span style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      </div>

      <div className="presenter-layout">
        <div className="presenter-main">
          <div className="presenter-label">{t("onScreen")}</div>
          <SlideViewport className="presenter-current">
            <SlideView
              key={index}
              slide={slide}
              theme={theme}
              resolve={resolve}
              showPageNumber={paginate}
              pageNumber={index + 1}
              lazyDiagrams={false}
            />
          </SlideViewport>
          <div className="presenter-controls">
            <button className="btn icon" onClick={() => go(-1)} title={t("previous")} disabled={index === 0}>
              <Icon name="arrow-left" />
            </button>
            <span className="presenter-counter">
              {index + 1} / {slides.length}
            </span>
            <button
              className="btn icon"
              onClick={() => go(1)}
              title={t("next")}
              disabled={index === slides.length - 1}
            >
              <Icon name="arrow-right" />
            </button>
            <span className="presenter-divider" />
            <button
              className="btn icon"
              onClick={() => setRunning((value) => !value)}
              title={running ? t("pauseTimer") : t("resumeTimer")}
            >
              <Icon name={running ? "pause" : "play"} />
            </button>
            <button className="btn icon" onClick={() => setSeconds(0)} title={t("resetTimer")}>
              <Icon name="reset" />
            </button>
            <span className="presenter-divider" />
            <button className="btn ghost" onClick={finish}>
              <Icon name="x" />
              {t("exitPresentation")}
            </button>
          </div>
        </div>

        <aside className="presenter-aside">
          <div className="presenter-next-card">
            <div className="presenter-label">{t("nextSlide")}</div>
            {next ? (
              <SlideViewport className="presenter-next">
                <SlideView
                  key={next.index}
                  slide={next}
                  theme={theme}
                  resolve={resolve}
                  showPageNumber={paginate}
                  pageNumber={next.index + 1}
                  lazyDiagrams={false}
                />
              </SlideViewport>
            ) : (
              <div className="presenter-end">{t("endOfDeck")}</div>
            )}
          </div>

          <div className="presenter-audience">
            <Icon name="monitor" size={15} />
            <span>
              {audienceMonitor
                ? t("audienceOn", { name: audienceMonitor })
                : t("audienceWindow")}
            </span>
          </div>
        </aside>

        <div className="presenter-notes-card">
          <div className="presenter-label">
            <Icon name="message" size={12} />
            {t("presenterNotes")}
          </div>
          <div className="presenter-notes-body">{slide.notes || t("noNotes")}</div>
        </div>
      </div>

      <div className="presenter-footer">
        <span className="presenter-hint">{t("presenterHint")}</span>
        <span className="presenter-footer-spacer" />
        <span className="presenter-slide-number">
          {t("slideNumber", { n: index + 1, total: slides.length })}
        </span>
      </div>
    </div>
  );
}
