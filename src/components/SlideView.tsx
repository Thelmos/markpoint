import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Slide, ThemeId } from "../types";
import { cssUrl, renderSlideMarkdown, type SrcResolver } from "../lib/markdown";
import { fitSlide } from "../lib/autofit";
import { renderMermaidBlocks } from "../lib/mermaid";

interface SlideViewProps {
  slide: Slide;
  theme: ThemeId;
  resolve: SrcResolver;
  showPageNumber: boolean;
  pageNumber: number;
  lazyDiagrams?: boolean;
  className?: string;
}

/**
 * Renders one fixed-size 1280x720 slide and auto-fits its content. Diagrams are
 * rendered lazily when the slide approaches the viewport (preview only).
 */
export function SlideView({
  slide,
  theme,
  resolve,
  showPageNumber,
  pageNumber,
  lazyDiagrams = true,
  className,
}: SlideViewProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(!lazyDiagrams);
  const active = !lazyDiagrams || inView;

  const rendered = useMemo(
    () =>
      active
        ? renderSlideMarkdown(slide.markdown, resolve)
        : { html: "", backgrounds: [], hasBody: false },
    // Theme is included because cached blob URLs may change with it.
    [active, slide.markdown, resolve, theme],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !active) return;

    const runFit = () => fitSlide(root);
    runFit();

    const images = Array.from(root.querySelectorAll("img"));
    for (const image of images) {
      if (!image.complete) {
        image.addEventListener("load", runFit, { once: true });
        image.addEventListener("error", runFit, { once: true });
      }
    }

    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) runFit();
    });

    return () => {
      cancelled = true;
      for (const image of images) {
        image.removeEventListener("load", runFit);
        image.removeEventListener("error", runFit);
      }
    };
  }, [rendered.html, active]);

  useEffect(() => {
    if (!lazyDiagrams) {
      setInView(true);
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [lazyDiagrams]);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    if (!root || !rendered.html.includes("mermaid-block")) return;
    let cancelled = false;
    void renderMermaidBlocks(root, theme).then(() => {
      if (!cancelled) fitSlide(root);
    });
    return () => {
      cancelled = true;
    };
  }, [active, rendered.html, theme]);

  return (
    <section
      ref={rootRef}
      className={className ? `slide ${className}` : "slide"}
      data-theme={theme}
      aria-label={`Slide ${pageNumber}`}
    >
      {active
        ? rendered.backgrounds.map((background, index) => (
            <div
              key={`${background.src}-${index}`}
              className="slide-bg"
              style={{
                backgroundImage: cssUrl(background.src),
                backgroundSize: background.fit,
              }}
            />
          ))
        : null}
      {active ? (
        <div
          className={rendered.hasBody ? "slide-content has-body" : "slide-content"}
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      ) : null}
      {showPageNumber ? <div className="slide-number">{pageNumber}</div> : null}
    </section>
  );
}
