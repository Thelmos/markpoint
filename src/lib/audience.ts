import type { Lang, ResolvedTheme, Slide } from "../types";

export const AUDIENCE_INIT = "audience-init";
export const AUDIENCE_INDEX = "audience-index";
export const AUDIENCE_READY = "audience-ready";
export const AUDIENCE_NAV = "audience-nav";
export const AUDIENCE_EXIT = "audience-exit";

export interface AudienceInit {
  slides: Slide[];
  theme: ResolvedTheme;
  paginate: boolean;
  lang: Lang;
  title: string;
  index: number;
  /** Image paths mapped to data URLs, so the second webview is independent. */
  assets: Record<string, string>;
}

export interface AudienceDisplay {
  name: string;
  position: { x: number; y: number };
}
