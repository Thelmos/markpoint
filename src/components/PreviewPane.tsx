import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Slide, ThemeId } from "../types";
import type { SrcResolver } from "../lib/markdown";
import { SlideView } from "./SlideView";
import { Icon } from "./Icons";
import { useT } from "../lib/i18n";

export interface PreviewHandle {
  centerSlide: (index: number, smooth?: boolean) => void;
}

interface PreviewPaneProps {
  slides: Slide[];
  theme: ThemeId;
  activeIndex: number;
  paginate: boolean;
  resolve: SrcResolver;
  onActivate: (index: number) => void;
  onPreviewActive: (index: number) => void;
  onPresentFrom: (index: number) => void;
}

function slideLabel(slide: Slide): string {
  for (const line of slide.markdown.split("\n")) {
    const heading = /^\s{0,3}#{1,6}\s+(.+)$/.exec(line);
    if (heading) return heading[1].replace(/[*_`~[\]]/g, "").trim().slice(0, 80);
  }
  const first = slide.markdown
    .split("\n")
    .map((line) => line.replace(/^[\s>*#\-+]+/, "").trim())
    .find(Boolean);
  return (first ?? "").replace(/[*_`~[\]]/g, "").slice(0, 80);
}

interface FrameProps {
  slide: Slide;
  theme: ThemeId;
  resolve: SrcResolver;
  paginate: boolean;
  active: boolean;
  onActivate: () => void;
  onPresent: () => void;
}

function SlideFrame({ slide, theme, resolve, paginate, active, onActivate, onPresent }: FrameProps) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.4);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => setScale(frame.clientWidth / 1280);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frameRef}
      className={`slide-frame${active ? " active" : ""}`}
      role="button"
      tabIndex={-1}
      aria-current={active ? "true" : undefined}
      onClick={onActivate}
      onDoubleClick={onPresent}
    >
      <div className="slide-stage" style={{ transform: `scale(${scale})` }}>
        <SlideView
          slide={slide}
          theme={theme}
          resolve={resolve}
          showPageNumber={paginate}
          pageNumber={slide.index + 1}
          lazyDiagrams
        />
      </div>
    </div>
  );
}

export const PreviewPane = forwardRef<PreviewHandle, PreviewPaneProps>(function PreviewPane(
  { slides, theme, activeIndex, paginate, resolve, onActivate, onPreviewActive, onPresentFrom },
  ref,
) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const activeRef = useRef(activeIndex);
  const suppressUntil = useRef(0);
  const raf = useRef(0);

  activeRef.current = activeIndex;

  const centerSlide = useCallback((index: number, smooth = true) => {
    const container = scrollRef.current;
    const item = itemRefs.current[index];
    if (!container || !item) return;
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const target =
      container.scrollTop +
      (itemRect.top - containerRect.top) -
      (containerRect.height - itemRect.height) / 2;
    suppressUntil.current = performance.now() + (smooth ? 900 : 200);
    container.scrollTo({ top: Math.max(0, target), behavior: smooth ? "smooth" : "auto" });
  }, []);

  useImperativeHandle(ref, () => ({ centerSlide }), [centerSlide]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => {
      if (performance.now() < suppressUntil.current) return;
      cancelAnimationFrame(raf.current);
      raf.current = requestAnimationFrame(() => {
        if (performance.now() < suppressUntil.current) return;
        const containerRect = container.getBoundingClientRect();
        const center = containerRect.top + containerRect.height / 2;
        let best = activeRef.current;
        let bestDistance = Number.POSITIVE_INFINITY;
        itemRefs.current.forEach((item, index) => {
          if (!item) return;
          const rect = item.getBoundingClientRect();
          if (rect.bottom < containerRect.top || rect.top > containerRect.bottom) return;
          const distance = Math.abs((rect.top + rect.bottom) / 2 - center);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = index;
          }
        });
        if (best !== activeRef.current) {
          onPreviewActive(best);
        }
      });
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      container.removeEventListener("scroll", onScroll);
    };
  }, [onPreviewActive]);

  return (
    <div className="preview-scroll" ref={scrollRef}>
      {slides.length === 0 ? (
        <div className="preview-empty">{t("previewEmpty")}</div>
      ) : (
        <div className="slide-list">
          {slides.map((slide, index) => (
            <div
              key={`${theme}-${slide.index}`}
              className={`slide-item${index === activeIndex ? " active" : ""}`}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
            >
              <div className="slide-meta">
                <span className="slide-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="slide-meta-sep" />
                <span className="slide-index">{slideLabel(slide)}</span>
                {slide.notes ? (
                  <span
                    className="notes-badge"
                    title={`${t("notes")}:\n${slide.notes}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Icon name="message" size={11} />
                    {t("notesShort")}
                  </span>
                ) : null}
              </div>
              <SlideFrame
                slide={slide}
                theme={theme}
                resolve={resolve}
                paginate={paginate}
                active={index === activeIndex}
                onActivate={() => onActivate(index)}
                onPresent={() => onPresentFrom(index)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
