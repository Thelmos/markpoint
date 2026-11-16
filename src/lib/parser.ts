import { load as loadYaml } from "js-yaml";
import type { FrontMatter, ParsedDeck, Slide } from "../types";

const SEPARATOR = /^ {0,3}-{3,}[ \t]*$/;
const NOTES = /<!--\s*notes:\s*([\s\S]*?)-->/gi;

function stripNotes(markdown: string): { content: string; notes: string } {
  const notes: string[] = [];
  const content = markdown.replace(NOTES, (_match, note: string) => {
    notes.push(note.trim());
    return "";
  });
  return { content: content.trim(), notes: notes.join("\n\n").trim() };
}

function makeSlide(
  index: number,
  raw: string,
  startLine: number,
  endLine: number,
  separatorLine: number | null,
): Slide {
  const { content, notes } = stripNotes(raw);
  return {
    index,
    markdown: content,
    startLine,
    endLine,
    separatorLine,
    notes,
    empty: content.length === 0,
  };
}

/**
 * Parses a markdown document into slides.
 *
 * - An optional YAML front matter block at the very start (`--- ... ---`).
 * - Slides are separated by lines containing three or more dashes.
 * - A trailing `<!-- notes: ... -->` comment in a slide becomes speaker notes.
 */
export function parseDeck(source: string): ParsedDeck {
  const text = source.replace(/\r\n/g, "\n");
  const lines = text.split("\n");

  let frontMatter: FrontMatter = {};
  let frontMatterRange: ParsedDeck["frontMatterRange"] = null;
  let contentStart = 0;

  if (lines.length > 0 && SEPARATOR.test(lines[0])) {
    let end = -1;
    for (let i = 1; i < lines.length; i += 1) {
      if (SEPARATOR.test(lines[i])) {
        end = i;
        break;
      }
    }
    if (end !== -1) {
      const yamlText = lines.slice(1, end).join("\n");
      try {
        const parsed = loadYaml(yamlText);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          frontMatter = parsed as FrontMatter;
          frontMatterRange = { start: 1, end: end + 1 };
          contentStart = end + 1;
        }
      } catch {
        // Invalid YAML: keep the whole block as regular markdown content.
      }
    }
  }

  const slides: Slide[] = [];
  let chunkStart = contentStart;
  /** Separator line that opens the next slide once it is pushed. */
  let pendingSeparator: number | null = null;

  const push = (from: number, to: number) => {
    if (to < from) return;
    let start = from;
    let end = to;
    while (start <= end && lines[start].trim() === "") start += 1;
    while (end >= start && lines[end].trim() === "") end -= 1;

    // Ignore accidental empty slides; an empty deck gets one placeholder below.
    if (start > end) return;

    const raw = lines.slice(start, end + 1).join("\n");
    slides.push(makeSlide(slides.length, raw, start + 1, end + 1, pendingSeparator));
    pendingSeparator = null;
  };

  let fence: string | null = null;
  for (let i = contentStart; i < lines.length; i += 1) {
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (!fence && SEPARATOR.test(lines[i])) {
      push(chunkStart, i - 1);
      pendingSeparator = i + 1;
      chunkStart = i + 1;
    }
  }
  push(chunkStart, lines.length - 1);

  if (slides.length === 0) {
    const line = Math.max(1, contentStart + 1);
    slides.push(makeSlide(0, "", line, line, null));
  }

  return { frontMatter, slides, frontMatterRange };
}

/**
 * Finds the slide that owns a 1-based source line.
 *
 * The blank lines that close a slide and its `---` separator belong to that
 * slide, so the preview keeps showing what is being edited. Blank lines after
 * the separator already belong to the following slide. Lines before the first
 * slide (front matter, leading blanks) fall back to it.
 */
export function slideAtLine(slides: Slide[], line: number): number {
  if (slides.length === 0) return 0;
  let current = 0;
  for (let i = 0; i < slides.length; i += 1) {
    if (slides[i].startLine > line) break;
    current = i;
  }
  const next = slides[current + 1];
  if (next) {
    const separator = next.separatorLine ?? next.startLine - 1;
    if (line > separator) return current + 1;
  }
  return current;
}

/** Returns the source line where a slide starts (clamped to the document). */
export function lineForSlide(slides: Slide[], index: number): number {
  const slide = slides[Math.min(Math.max(index, 0), slides.length - 1)];
  return slide ? slide.startLine : 1;
}

export function deckTitle(frontMatter: FrontMatter, fallback: string): string {
  const title = typeof frontMatter.title === "string" ? frontMatter.title.trim() : "";
  return title || fallback;
}
