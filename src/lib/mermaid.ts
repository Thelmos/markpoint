import type { ResolvedTheme } from "../types";

type MermaidModule = typeof import("mermaid").default;

let loader: Promise<MermaidModule> | null = null;
let initializedDark: boolean | null = null;

async function getMermaid(): Promise<MermaidModule> {
  if (!loader) loader = import("mermaid").then((mod) => mod.default);
  return loader;
}

export async function initMermaid(theme: ResolvedTheme): Promise<MermaidModule> {
  const mermaid = await getMermaid();
  if (initializedDark !== theme.dark) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: theme.dark ? "dark" : "default",
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      themeVariables: {
        fontSize: "18px",
      },
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    initializedDark = theme.dark;
  }
  return mermaid;
}

let counter = 0;

/** Replaces every pending `.mermaid-block` under `root` with rendered SVG. */
export async function renderMermaidBlocks(root: ParentNode, theme: ResolvedTheme): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(".mermaid-block:not([data-rendered])"));
  if (blocks.length === 0) return;
  const mermaid = await initMermaid(theme);

  for (const block of blocks) {
    const encoded = block.dataset.code ?? "";
    let code = "";
    try {
      code = decodeURIComponent(encoded);
    } catch {
      code = encoded;
    }
    block.dataset.rendered = "1";
    const id = `mermaid-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, code);
      block.innerHTML = svg;
      block.classList.add("mermaid-rendered");
      const element = block.querySelector<SVGSVGElement>("svg");
      if (element) fitMermaidBlock(block, element);
    } catch (error) {
      block.innerHTML = `<pre class="mermaid-error">${escapeHtml(code)}\n\n${escapeHtml(
        error instanceof Error ? error.message : String(error),
      )}</pre>`;
      block.classList.add("mermaid-failed");
    }
  }
}

/**
 * Largest box with the SVG aspect ratio that fits in `maxWidth × maxHeight`.
 * Returns null when any dimension is missing.
 */
export function fitSvgSize(
  boxWidth: number,
  boxHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } | null {
  if (
    !(boxWidth > 0) ||
    !(boxHeight > 0) ||
    !(maxWidth > 0) ||
    !(maxHeight > 0)
  ) {
    return null;
  }
  const scale = Math.min(maxWidth / boxWidth, maxHeight / boxHeight);
  if (!Number.isFinite(scale) || scale <= 0) return null;
  return {
    width: Math.round(boxWidth * scale * 100) / 100,
    height: Math.round(boxHeight * scale * 100) / 100,
  };
}

/**
 * Scales a rendered diagram to the space that is actually free in its slide.
 * The SVG keeps its intrinsic aspect ratio and never overflows the title or
 * the text around it.
 */
function fitMermaidBlock(block: HTMLElement, svg: SVGSVGElement): void {
  const content = block.closest<HTMLElement>(".slide-content");
  const parent = block.parentElement;
  if (!content || !parent) return;

  const layout = content.dataset.layout;
  let available: number;

  if (layout) {
    const flow = block.closest<HTMLElement>(".layout-flow") ?? content;
    const body = block.closest<HTMLElement>(".layout-body");
    const parsed = Number.parseFloat(
      getComputedStyle(flow).getPropertyValue("--slide-content-height"),
    );
    if (Number.isFinite(parsed) && parsed > 0 && parsed < content.clientHeight) {
      available = parsed;
    } else if (body) {
      if (content.classList.contains("layout-centered")) {
        const stack = content.querySelector<HTMLElement>(".layout-stack");
        const title = content.querySelector<HTMLElement>(".layout-title");
        const gap = stack ? Number.parseFloat(getComputedStyle(stack).rowGap) || 0 : 0;
        available = Math.max(
          0,
          content.clientHeight - (title?.offsetHeight ?? 0) - gap,
        );
      } else {
        available = body.clientHeight;
      }
    } else {
      available = content.clientHeight;
    }
  } else if (
    parent.classList.contains("slide-body") ||
    parent.classList.contains("slide-content")
  ) {
    available = parent.clientHeight;
  } else {
    available = content.clientHeight;
  }

  if (available <= 0) return;

  const style = getComputedStyle(block);
  const marginY =
    (Number.parseFloat(style.marginTop) || 0) +
    (Number.parseFloat(style.marginBottom) || 0);

  // In the default rendering the title is part of the same flow. Let it keep
  // a modest allowance instead of measuring its current (possibly huge) size,
  // and shrink it in the final text fit.
  const firstChild = parent.firstElementChild;
  const title =
    !layout &&
    parent.classList.contains("slide-content") &&
    firstChild &&
    /^H[1-6]$/i.test(firstChild.tagName)
      ? firstChild
      : null;

  let other = 0;
  for (const child of Array.from(parent.children)) {
    if (child === block || child === title || !(child instanceof HTMLElement)) continue;
    const childStyle = getComputedStyle(child);
    other +=
      child.offsetHeight +
      (Number.parseFloat(childStyle.marginTop) || 0) +
      (Number.parseFloat(childStyle.marginBottom) || 0);
  }

  const remaining = Math.max(0, available - other - marginY);
  const titleAllowance = title ? Math.min(120, available * 0.25) : 0;
  const maxHeight = Math.max(80, remaining - titleAllowance);

  const box = svg.viewBox?.baseVal;
  const boxWidth = box?.width ?? 0;
  const boxHeight = box?.height ?? 0;
  if (!boxWidth || !boxHeight) return;

  const maxWidth = block.clientWidth || parent.clientWidth || content.clientWidth;
  const size = fitSvgSize(boxWidth, boxHeight, maxWidth, maxHeight);
  if (!size) return;

  svg.style.width = `${size.width}px`;
  svg.style.height = `${size.height}px`;
  svg.style.maxWidth = "100%";
  svg.style.maxHeight = "100%";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
