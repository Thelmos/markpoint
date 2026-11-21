import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ResolvedTheme, Slide } from "../types";
import { cssUrl, renderSlideMarkdown, slideContentClass, type SrcResolver } from "../lib/markdown";
import { fitSlide } from "../lib/autofit";
import { renderMermaidBlocks } from "../lib/mermaid";

interface SlideViewProps {
  slide: Slide;
  theme: ResolvedTheme;
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
        ? renderSlideMarkdown(slide.markdown, resolve, slide.layout)
        : { html: "", backgrounds: [], hasBody: false, layout: null },
    [active, slide.markdown, slide.layout, resolve],
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
  }, [active, rendered.html, theme.dark]);

  return (
    <section
      ref={rootRef}
      className={className ? `slide ${className}` : "slide"}
      style={theme.vars as CSSProperties}
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
          className={slideContentClass(rendered)}
          data-layout={rendered.layout ?? undefined}
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      ) : null}
      {showPageNumber ? <div className="slide-number">{pageNumber}</div> : null}
    </section>
  );
}
