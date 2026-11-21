export type Lang = "es" | "en";
export type ImageFit = "cover" | "contain";

/** Slide layouts that can be selected with a `<!-- layout: ... -->` directive. */
export type SlideLayout = "section" | "content-1c" | "content-2c";

export interface ThemeSyntax {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  type: string;
  tag: string;
  attr: string;
  builtIn: string;
}

/** Every value a theme can define, with all inherited values already filled. */
export interface ThemeValues {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  accent2: string;
  border: string;
  codeBg: string;
  codeFg: string;
  quoteBg: string;
  quoteBorder: string;
  tableHead: string;
  tableLines: string;
  tableRowLines: boolean;
  tableColumnLines: boolean;
  mark: string;
  scrim: string;
  font: string;
  headingFont: string;
  padX: number;
  padY: number;
  syntax: ThemeSyntax;
}

export interface ThemeFont {
  family: string;
  /** Path inside the project bundle, e.g. `assets/fonts/inter.woff2`. */
  file: string;
  weight?: string;
  style?: "normal" | "italic";
}

/** The shape of the `theme` key in the front matter. */
export type ThemeSpec = Partial<Omit<ThemeValues, "syntax">> & {
  name?: string;
  base?: string;
  dark?: boolean;
  fonts?: ThemeFont[];
  syntax?: Partial<ThemeSyntax>;
};

export interface ResolvedTheme {
  /** Preset id when the theme is exactly a built-in preset, otherwise null. */
  presetId: string | null;
  /** Preset the theme inherits from. */
  base: string;
  /** Custom name written in the front matter, if any. */
  name: string | null;
  dark: boolean;
  values: ThemeValues;
  vars: Record<string, string>;
  fonts: ThemeFont[];
  warnings: string[];
}

export interface FrontMatter {
  title?: string;
  author?: string;
  paginate?: boolean;
  theme?: unknown;
  [key: string]: unknown;
}

export interface BackgroundImage {
  src: string;
  fit: ImageFit;
}

export interface Slide {
  index: number;
  /** Markdown content without the notes comment or the layout directive. */
  markdown: string;
  /** 1-based line where the slide content starts. */
  startLine: number;
  /** 1-based line where the slide content ends. */
  endLine: number;
  /** 1-based line of the `---` separator that precedes the slide, or null. */
  separatorLine: number | null;
  notes: string;
  /** Layout selected by the directive, or null for the default rendering. */
  layout: SlideLayout | null;
  /** Raw value of an unknown layout directive, so the UI can warn about it. */
  layoutWarning: string | null;
  /** 1-based line of the layout directive, whether it is valid or not. */
  layoutLine: number | null;
  /** True when the slide has no content at all. */
  empty: boolean;
}

export interface ParsedDeck {
  frontMatter: FrontMatter;
  slides: Slide[];
  /** 1-based inclusive range of the YAML front matter delimiters, or null. */
  frontMatterRange: { start: number; end: number } | null;
}

export interface Manifest {
  format: "markpoint";
  version: 1;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  markdownPath: string;
  markdown: string;
  manifest: Manifest;
  /** Every other file in the bundle, keyed by normalized zip path. */
  files: Map<string, Uint8Array>;
}

export interface SlideRender {
  html: string;
  backgrounds: BackgroundImage[];
  /** True when the content is split into a leading title and a body block. */
  hasBody: boolean;
  /** Layout applied to the slide, or null for the default rendering. */
  layout: SlideLayout | null;
}
