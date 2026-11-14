export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

const MIN_FONT = 13;
const MAX_FONT = 74;

/**
 * Shrinks the slide content until it fits its box. Uses binary search because
 * text height is monotonic with font size. Works with tables, code, images...
 */
export function fitSlide(slide: HTMLElement | null): number {
  if (!slide) return 0;
  const content = slide.querySelector<HTMLElement>(".slide-content");
  if (!content) return 0;

  const available = content.clientHeight;
  if (available <= 0) return 0;

  const fits = (size: number) => {
    content.style.fontSize = `${size}px`;
    return content.scrollHeight <= available + 0.5;
  };

  if (fits(MAX_FONT)) {
    content.dataset.fit = "max";
    return MAX_FONT;
  }

  let low = MIN_FONT;
  let high = MAX_FONT;
  let best = MIN_FONT;
  for (let i = 0; i < 12; i += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }

  const rounded = Math.floor(best * 10) / 10;
  content.style.fontSize = `${rounded}px`;
  content.dataset.fit = rounded <= MIN_FONT ? "min" : "auto";
  return rounded;
}

/** Waits for every image inside `root` to be decoded (or fail). */
export function imagesReady(root: ParentNode, timeoutMs = 4000): Promise<void> {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return Promise.resolve();
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();

  return new Promise((resolve) => {
    let remaining = pending.length;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    for (const img of pending) {
      const handler = () => {
        remaining -= 1;
        if (remaining <= 0) {
          window.clearTimeout(timer);
          finish();
        }
      };
      img.addEventListener("load", handler, { once: true });
      img.addEventListener("error", handler, { once: true });
    }
  });
}
