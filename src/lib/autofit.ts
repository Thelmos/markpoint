export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;

export const MIN_BODY_FONT = 13;
export const MIN_TITLE_FONT = 28;

const MAX_BODY_FONT = 74;
const MAX_TITLE_FONT = 82;

/**
 * Largest size that satisfies `fits`, rounded down to a tenth of a pixel.
 * Text height is monotonic with font size, so a binary search is enough.
 */
export function fitFontSize(
  min: number,
  max: number,
  fits: (size: number) => boolean,
): number {
  if (fits(max)) return max;

  let low = min;
  let high = max;
  let best = min;
  for (let i = 0; i < 12; i += 1) {
    const mid = (low + high) / 2;
    if (fits(mid)) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return Math.max(min, Math.floor(best * 10) / 10);
}

function applyFontSize(
  element: HTMLElement,
  size: number,
  min: number,
  max: number,
): void {
  element.style.fontSize = `${size}px`;
  element.dataset.fit = size <= min ? "min" : size >= max ? "max" : "auto";
}

/** Content height of a block, ignoring any CSS transform used for scaling. */
function blockHeight(element: HTMLElement): number {
  return Math.max(element.scrollHeight, element.offsetHeight);
}

/**
 * Shrinks the slide content until it fits its box. Works with tables, code,
 * images... Slides with a layout fit the title and the body independently.
 */
export function fitSlide(slide: HTMLElement | null): number {
  if (!slide) return 0;
  const content = slide.querySelector<HTMLElement>(".slide-content");
  if (!content) return 0;

  const available = content.clientHeight;
  if (available <= 0) return 0;

  if (content.classList.contains("slide-has-layout")) {
    return fitLayout(content, available);
  }

  const size = fitFontSize(MIN_BODY_FONT, MAX_BODY_FONT, (value) => {
    content.style.fontSize = `${value}px`;
    return content.scrollHeight <= available + 0.5;
  });
  applyFontSize(content, size, MIN_BODY_FONT, MAX_BODY_FONT);
  return size;
}

/**
 * Fits both zones of a layout. The title starts at the top margin and the
 * body uses the space that is left below it.
 */
function fitLayout(content: HTMLElement, available: number): number {
  const title = content.querySelector<HTMLElement>(".layout-title");
  const body = content.querySelector<HTMLElement>(".layout-body");
  const flow = content.querySelector<HTMLElement>(".layout-flow");
  const centered = content.classList.contains("layout-centered");
  const hasTitle = Boolean(title && title.textContent?.trim());

  if (title && hasTitle) {
    const heading = title.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6");
    let titleScale = 1;
    if (heading) {
      const base = Number.parseFloat(getComputedStyle(title).fontSize);
      const rendered = Number.parseFloat(getComputedStyle(heading).fontSize);
      if (base > 0 && rendered > 0) titleScale = rendered / base;
    }
    // The minimum applies to the rendered heading: a smaller h2 starts from a
    // larger zone size, so it never drops below 28 px.
    const minTitleSize = MIN_TITLE_FONT / Math.max(titleScale, 0.01);
    const budget = available * 0.5;
    const size = fitFontSize(minTitleSize, MAX_TITLE_FONT, (value) => {
      title.style.fontSize = `${value}px`;
      return blockHeight(title) <= budget + 0.5;
    });
    applyFontSize(title, size, minTitleSize, MAX_TITLE_FONT);
  }

  if (!body || !flow) return 0;

  let bodyAvailable = body.clientHeight;
  if (centered) {
    const stack = content.querySelector<HTMLElement>(".layout-stack");
    const gap = stack ? Number.parseFloat(getComputedStyle(stack).rowGap) || 0 : 0;
    bodyAvailable = available - (title?.offsetHeight ?? 0) - gap;
  }
  bodyAvailable = Math.max(0, bodyAvailable);
  // Images inside the body must fit the body, not the whole slide.
  flow.style.setProperty("--slide-content-height", `${bodyAvailable}px`);

  const size = fitFontSize(MIN_BODY_FONT, MAX_BODY_FONT, (value) => {
    flow.style.fontSize = `${value}px`;
    return blockHeight(flow) <= bodyAvailable + 0.5;
  });
  applyFontSize(flow, size, MIN_BODY_FONT, MAX_BODY_FONT);
  body.dataset.fit = flow.dataset.fit;
  content.dataset.fit = flow.dataset.fit;
  return size;
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
