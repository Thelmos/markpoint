import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Slide, ThemeId } from "../types";
import type { SrcResolver } from "../lib/markdown";
import { SlideView } from "./SlideView";
import { Icon } from "./Icons";
import { formatDuration, useT } from "../lib/i18n";

interface PresentationProps {
  slides: Slide[];
  initialIndex: number;
  theme: ThemeId;
  paginate: boolean;
  resolve: SrcResolver;
  onExit: (index: number) => void;
}

export function Presentation({
  slides,
  initialIndex,
  theme,
  paginate,
  resolve,
  onExit,
}: PresentationProps) {
  const t = useT();
  const [index, setIndex] = useState(() => Math.min(Math.max(initialIndex, 0), slides.length - 1));
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [scale, setScale] = useState(1);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [notesVisible, setNotesVisible] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const indexRef = useRef(index);
  const exited = useRef(false);

  indexRef.current = index;

  const finish = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    onExit(indexRef.current);
  }, [onExit]);

  useLayoutEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / 1280, window.innerHeight / 720));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const go = useCallback(
    (delta: number) => {
      setDirection(delta >= 0 ? "forward" : "back");
      setIndex((current) => Math.min(Math.max(current + delta, 0), slides.length - 1));
    },
    [slides.length],
  );

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
          setDirection("back");
          setIndex(0);
          break;
        case "End":
          event.preventDefault();
          setDirection("forward");
          setIndex(slides.length - 1);
          break;
        case "Escape":
          event.preventDefault();
          finish();
          break;
        case "n":
        case "N":
          setNotesVisible((value) => !value);
          break;
        case "t":
        case "T":
          setTimerVisible((value) => !value);
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
  }, [finish, go, slides.length]);

  const slide = slides[index];
  if (!slide) return null;

  return (
    <div className={`presentation${notesVisible ? " notes-open" : ""}`}>
      <div className="presentation-progress">
        <span style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      </div>

      {timerVisible ? (
        <div className={`presentation-timer${running ? "" : " paused"}`} title={t("timer")}>
          <Icon name="clock" size={14} />
          {formatDuration(seconds)}
        </div>
      ) : null}

      <div
        className="presentation-stage"
        data-direction={direction}
        style={{ transform: `scale(${scale})` }}
      >
        <SlideView
          key={index}
          slide={slide}
          theme={theme}
          resolve={resolve}
          showPageNumber={paginate}
          pageNumber={index + 1}
          lazyDiagrams={false}
        />
      </div>

      <div
        className="slide-hitarea"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          go(x < rect.width * 0.22 ? -1 : 1);
        }}
        aria-hidden="true"
      />

      {notesVisible ? (
        <div className="presentation-notes">
          <div className="notes-title">
            <Icon name="message" size={13} />
            {t("notes")}
          </div>
          {slide.notes || t("noNotes")}
        </div>
      ) : null}

      {notesVisible ? null : <div className="presentation-hint">{t("presentationHint")}</div>}

      <div className="presentation-controls" onClick={(event) => event.stopPropagation()}>
        <button className="btn icon" onClick={() => go(-1)} title={t("previous")} disabled={index === 0}>
          <Icon name="arrow-left" />
        </button>
        <span className="presentation-counter">
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
        <span className="toolbar-divider" />
        <button
          className={`btn icon${notesVisible ? " active" : ""}`}
          onClick={() => setNotesVisible((value) => !value)}
          title={t("notesToggle")}
        >
          <Icon name="message" />
        </button>
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
        <span className="toolbar-divider" />
        <button className="btn icon" onClick={finish} title={t("exitPresentation")}>
          <Icon name="x" />
        </button>
      </div>
    </div>
  );
}
