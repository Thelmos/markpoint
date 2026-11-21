import type { Slide, SlideLayout } from "../types";

/** Layouts in the order shown by the selector. */
export const SLIDE_LAYOUTS: SlideLayout[] = ["section", "content-1c", "content-2c"];

export interface LayoutEdit {
  from: number;
  to: number;
  insert: string;
}

function lineOffsets(markdown: string): number[] {
  const offsets = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

export function layoutDirective(layout: SlideLayout): string {
  return `<!-- layout: ${layout} -->`;
}

/**
 * Returns the edit that writes (or removes) the layout directive of a slide.
 *
 * The directive always sits on the first non-empty line. `null` removes it and
 * leaves the slide with the default rendering. Returns `null` when there is
 * nothing to change.
 */
export function setLayoutInMarkdown(
  markdown: string,
  slide: Slide,
  layout: SlideLayout | null,
): LayoutEdit | null {
  const lines = markdown.split("\n");
  const offsets = lineOffsets(markdown);

  if (slide.layoutLine) {
    const index = Math.min(Math.max(slide.layoutLine - 1, 0), lines.length - 1);
    const start = offsets[index] ?? markdown.length;
    const end = start + (lines[index]?.length ?? 0);
    if (layout) {
      return { from: start, to: end, insert: layoutDirective(layout) };
    }
    // Remove the line and its newline so the next line takes its place.
    const next = end < markdown.length && markdown[end] === "\n" ? end + 1 : end;
    return { from: start, to: next, insert: "" };
  }

  if (!layout) return null;

  const index = Math.max(0, Math.min(slide.startLine - 1, lines.length - 1));
  const at = offsets[index] ?? markdown.length;
  return { from: at, to: at, insert: `${layoutDirective(layout)}\n\n` };
}
