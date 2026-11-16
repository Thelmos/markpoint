export type ThemeId = "light" | "dark" | "ocean" | "sand";
export type Lang = "es" | "en";
export type ImageFit = "cover" | "contain";

export interface FrontMatter {
  title?: string;
  author?: string;
  paginate?: boolean;
  [key: string]: unknown;
}

export interface BackgroundImage {
  src: string;
  fit: ImageFit;
}

export interface Slide {
  index: number;
  /** Markdown content without the notes comment. */
  markdown: string;
  /** 1-based line where the slide content starts. */
  startLine: number;
  /** 1-based line where the slide content ends. */
  endLine: number;
  /** 1-based line of the `---` separator that precedes the slide, or null. */
  separatorLine: number | null;
  notes: string;
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
  theme: ThemeId;
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
}
