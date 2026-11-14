import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Scales a fixed 1280×720 slide to fit any box, preserving 16:9. */
export function SlideViewport({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.1);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      if (width > 0 && height > 0) setScale(Math.min(width / 1280, height / 720));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={className ? `slide-viewport ${className}` : "slide-viewport"} ref={ref}>
      <div
        className="slide-viewport-stage"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
