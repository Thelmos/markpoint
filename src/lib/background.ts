import type { ImageFit, Slide } from "../types";
import { encodeAssetPath } from "./assets.ts";

export interface MarkdownEdit {
  from: number;
  to: number;
  insert: string;
}

export interface DeckBackground {
  /** Normalized path or URL, ready to be written back to the Markdown. */
  src: string;
  fit: ImageFit;
}

/** A line that only contains a background image, with an optional fit. */
const BACKGROUND_LINE = /^\s*!\[bg(?::([a-z]+))?\]\(\s*(.+?)\s*\)\s*$/i;
const FENCE_LINE = /^\s{0,3}(`{3,}|~{3,})/;

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

function normalizeBackgroundPath(value: string): string {
  let path = value.trim();
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep the raw path */
  }
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

/** Reads a background from a single Markdown line, or returns null. */
function backgroundFromLine(line: string): DeckBackground | null {
  const match = BACKGROUND_LINE.exec(line);
  if (!match) return null;
  let src = match[2].trim();
  if (src.startsWith("<") && src.endsWith(">")) {
    src = src.slice(1, -1).trim();
  } else {
    src = src.replace(/\s+(?:"[^"]*"|'[^']*')\s*$/, "");
  }
  src = normalizeBackgroundPath(src);
  if (!src) return null;
  return { src, fit: match[1]?.toLowerCase() === "contain" ? "contain" : "cover" };
}

/** Backgrounds used in a slide, in Markdown order and outside code fences. */
export function backgroundsInMarkdown(markdown: string): DeckBackground[] {
  const found: DeckBackground[] = [];
  let fence: string | null = null;
  for (const line of markdown.split("\n")) {
    const fenceMatch = FENCE_LINE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence) continue;
    const background = backgroundFromLine(line);
    if (background) found.push(background);
  }
  return found;
}

/** Every distinct background used in the deck, in the order it appears. */
export function collectBackgrounds(slides: Slide[]): DeckBackground[] {
  const map = new Map<string, DeckBackground>();
  for (const slide of slides) {
    for (const background of backgroundsInMarkdown(slide.markdown)) {
      const key = `${background.src}|${background.fit}`;
      if (!map.has(key)) map.set(key, background);
    }
  }
  return Array.from(map.values());
}

export function backgroundOfSlide(slide: Slide): DeckBackground | null {
  return backgroundsInMarkdown(slide.markdown)[0] ?? null;
}

function backgroundLine(background: DeckBackground): string {
  const src = /^(https?:|data:|blob:)/i.test(background.src)
    ? background.src
    : encodeAssetPath(background.src);
  return `![bg${background.fit === "contain" ? ":contain" : ""}](${src})`;
}

function editBackground(
  markdown: string,
  slide: Slide,
  background: DeckBackground | null,
): MarkdownEdit | null {
  const starts = lineStarts(markdown);
  const lines = starts.length;
  if (slide.startLine < 1 || slide.startLine > lines) return null;
  const start = Math.max(0, Math.min(slide.startLine - 1, lines - 1));
  const end = Math.max(start, Math.min(slide.endLine - 1, lines - 1));

  const indexes: number[] = [];
  let fence: string | null = null;
  for (let index = start; index <= end; index += 1) {
    const text = lineText(markdown, starts, index);
    const fenceMatch = FENCE_LINE.exec(text);
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
    let to = starts[last] + lineText(markdown, starts, last).length;
    const kept: string[] = [];
    for (let index = first; index <= last; index += 1) {
      if (indexes.includes(index)) continue;
      kept.push(lineText(markdown, starts, index));
    }
    if (!background && last < end && lineText(markdown, starts, last + 1).trim() === "") {
      // Remove the blank line after the background instead of leaving two.
      to = starts[last + 2] ?? markdown.length;
    }
    const next = background ? [backgroundLine(background), ...kept] : kept;
    return { from, to, insert: next.join("\n") };
  }

  if (!background) return null;

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
  const prefix = insertion > start ? "\n" : "";
  const insert =
    current.trim() === ""
      ? `${prefix}${backgroundLine(background)}\n`
      : `${prefix}${backgroundLine(background)}\n\n`;
  return { from, to: from, insert };
}

/**
 * Replaces the background of a slide, or inserts one at the start of the
 * slide. A layout directive stays first so the layout is not lost.
 */
export function setBackgroundInMarkdown(
  markdown: string,
  slide: Slide,
  assetPath: string,
  fit: ImageFit = "cover",
): MarkdownEdit | null {
  return editBackground(markdown, slide, { src: assetPath, fit });
}

/** Removes every background from a slide. */
export function removeBackgroundFromMarkdown(
  markdown: string,
  slide: Slide,
): MarkdownEdit | null {
  return editBackground(markdown, slide, null);
}
