export interface ThemeHints {
  /** 1-based first line of the theme block. */
  from: number;
  /** 1-based last line of the theme block. */
  to: number;
  hints: Record<string, string>;
}

export const THEME_HINT_KEYS = [
  "theme",
  "name",
  "base",
  "dark",
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
  "mark",
  "scrim",
  "font",
  "headingFont",
  "padX",
  "padY",
  "syntax",
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "type",
  "tag",
  "attr",
  "builtIn",
  "fonts",
  "family",
  "file",
  "weight",
  "style",
] as const;

export const THEME_HINT_GROUPS: Array<{ titleKey: string; keys: string[] }> = [
  { titleKey: "themeGuideMeta", keys: ["theme", "name", "base", "dark"] },
  {
    titleKey: "themeGuideColors",
    keys: [
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
      "mark",
      "scrim",
    ],
  },
  { titleKey: "themeGuideType", keys: ["font", "headingFont", "padX", "padY"] },
  {
    titleKey: "themeGuideSyntax",
    keys: [
      "syntax",
      "keyword",
      "string",
      "number",
      "comment",
      "function",
      "type",
      "tag",
      "attr",
      "builtIn",
    ],
  },
  { titleKey: "themeGuideFonts", keys: ["fonts", "family", "file", "weight", "style"] },
];

/** `codeBg` → `themeHintCodeBg`. */
export function hintKeyFor(key: string): string {
  return `themeHint${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}
