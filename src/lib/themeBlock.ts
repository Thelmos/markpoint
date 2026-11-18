import type { ThemeSpec } from "../types";

export interface ThemeEdit {
  from: number;
  to: number;
  insert: string;
}

const SIMPLE_KEYS: Array<keyof ThemeSpec> = [
  "name",
  "base",
  "bg",
  "fg",
  "muted",
  "accent",
  "accent2",
  "border",
  "codeBg",
  "codeFg",
  "quoteBg",
  "quoteBorder",
  "tableHead",
  "tableLines",
  "tableRowLines",
  "tableColumnLines",
  "mark",
  "scrim",
  "font",
  "headingFont",
  "padX",
  "padY",
  "dark",
];

const SYNTAX_KEYS = [
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "type",
  "tag",
  "attr",
  "builtIn",
] as const;

function yamlValue(value: unknown): string {
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

/** Serializes a theme into the YAML form used inside the front matter. */
export function themeText(target: string | ThemeSpec): string {
  if (typeof target === "string") return `theme: ${target}`;

  const lines: string[] = ["theme:"];
  for (const key of SIMPLE_KEYS) {
    const value = target[key];
    if (value === undefined || value === null) continue;
    lines.push(`  ${key}: ${yamlValue(value)}`);
  }

  const syntax = target.syntax;
  if (syntax && Object.keys(syntax).length > 0) {
    lines.push("  syntax:");
    for (const key of SYNTAX_KEYS) {
      const value = syntax[key];
      if (value === undefined || value === null) continue;
      lines.push(`    ${key}: ${yamlValue(value)}`);
    }
  }

  if (target.fonts && target.fonts.length > 0) {
    lines.push("  fonts:");
    for (const font of target.fonts) {
      lines.push(`    - family: ${yamlValue(font.family)}`);
      lines.push(`      file: ${yamlValue(font.file)}`);
      if (font.weight) lines.push(`      weight: ${yamlValue(font.weight)}`);
      if (font.style) lines.push(`      style: ${yamlValue(font.style)}`);
    }
  }

  return lines.join("\n");
}

function lineOffsets(markdown: string): number[] {
  const offsets = [0];
  for (let index = 0; index < markdown.length; index += 1) {
    if (markdown[index] === "\n") offsets.push(index + 1);
  }
  return offsets;
}

interface ThemeBlockLines {
  themeLine: number;
  last: number;
}

function findThemeBlock(
  lines: string[],
  firstContent: number,
  closingIndex: number,
): ThemeBlockLines | null {
  let themeLine = -1;
  for (let index = firstContent; index < closingIndex; index += 1) {
    if (/^theme\s*:/.test(lines[index])) {
      themeLine = index;
      break;
    }
  }
  if (themeLine === -1) return null;

  let last = themeLine;
  for (let index = themeLine + 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (line.trim() === "") {
      let next = index + 1;
      while (next < closingIndex && lines[next].trim() === "") next += 1;
      if (next < closingIndex && /^[ \t]/.test(lines[next])) {
        last = index;
        continue;
      }
      break;
    }
    if (/^[ \t]/.test(line)) {
      last = index;
      continue;
    }
    break;
  }

  return { themeLine, last };
}

/** 1-based line range of the `theme` block, or null when it is absent. */
export function themeBlockLines(
  markdown: string,
  frontMatterRange: { start: number; end: number } | null,
): { from: number; to: number } | null {
  if (!frontMatterRange || frontMatterRange.end <= frontMatterRange.start) return null;
  const lines = markdown.split("\n");
  const closingIndex = Math.min(frontMatterRange.end - 1, lines.length - 1);
  const found = findThemeBlock(lines, frontMatterRange.start, closingIndex);
  return found ? { from: found.themeLine + 1, to: found.last + 1 } : null;
}

/**
 * Returns the edit that writes `target` as the `theme` key of the front matter.
 * Existing front matter and its other keys are preserved.
 */
export function setThemeInMarkdown(
  markdown: string,
  frontMatterRange: { start: number; end: number } | null,
  target: string | ThemeSpec,
): ThemeEdit {
  const text = themeText(target);

  if (!frontMatterRange || frontMatterRange.end <= frontMatterRange.start) {
    return { from: 0, to: 0, insert: `---\n${text}\n---\n\n` };
  }

  const lines = markdown.split("\n");
  const offsets = lineOffsets(markdown);
  const closingIndex = Math.min(frontMatterRange.end - 1, lines.length - 1);
  const found = findThemeBlock(lines, frontMatterRange.start, closingIndex);

  if (!found) {
    return {
      from: offsets[closingIndex] ?? markdown.length,
      to: offsets[closingIndex] ?? markdown.length,
      insert: `${text}\n`,
    };
  }

  const { themeLine, last } = found;
  return {
    from: offsets[themeLine] ?? 0,
    to: (offsets[last] ?? 0) + lines[last].length,
    insert: text,
  };
}
