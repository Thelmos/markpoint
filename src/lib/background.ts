import type { Slide } from "../types";
import { encodeAssetPath } from "./assets.ts";

export interface MarkdownEdit {
  from: number;
  to: number;
  insert: string;
}

/** A line that only contains a background image, with an optional fit. */
const BACKGROUND_LINE = /^\s*!\[bg(?::[a-z]+)?\]\([^)\n]*\)\s*$/i;

function lineStarts(markdown: string): number[] {
  const starts = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function lineText(markdown: string, starts: number[], index: number): string {
  const start = starts[index] ?? markdown.length;
  const end = starts[index + 1] ?? markdown.length + 1;
  let stop = Math.min(markdown.length, end - 1);
  if (stop > start && markdown[stop - 1] === "\r") stop -= 1;
  return markdown.slice(start, stop);
}

/**
 * Replaces the background of a slide, or inserts one at the start of the
 * slide. A layout directive stays first so the layout is not lost.
 *
 * Returns null when the slide does not belong to the document.
 */
export function setBackgroundInMarkdown(
  markdown: string,
  slide: Slide,
  assetPath: string,
): MarkdownEdit | null {
  const starts = lineStarts(markdown);
  const lines = starts.length;
  const start = Math.max(0, Math.min(slide.startLine - 1, lines - 1));
  const end = Math.max(start, Math.min(slide.endLine - 1, lines - 1));
  if (slide.startLine < 1 || slide.startLine > lines) return null;

  const background = `![bg](${encodeAssetPath(assetPath)})`;
  const indexes: number[] = [];
  let fence: string | null = null;
  for (let index = start; index <= end; index += 1) {
    const text = lineText(markdown, starts, index);
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(text);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (!fence && BACKGROUND_LINE.test(text)) indexes.push(index);
  }

  if (indexes.length > 0) {
    const first = indexes[0];
    const last = indexes[indexes.length - 1];
    const from = starts[first];
    const to = starts[last] + lineText(markdown, starts, last).length;
    const kept: string[] = [];
    for (let index = first; index <= last; index += 1) {
      if (indexes.includes(index)) continue;
      kept.push(lineText(markdown, starts, index));
    }
    return { from, to, insert: [background, ...kept].join("\n") };
  }

  // The directive must remain the first non-empty line of the slide.
  let insertion = start;
  if (
    slide.layoutLine &&
    slide.layoutLine >= slide.startLine &&
    slide.layoutLine <= slide.endLine
  ) {
    insertion = Math.min(slide.layoutLine, lines - 1);
  }

  const from = starts[insertion] ?? markdown.length;
  const current = lineText(markdown, starts, insertion);
  const insert = current.trim() === "" ? `${background}\n` : `${background}\n\n`;
  return { from, to: from, insert };
}
