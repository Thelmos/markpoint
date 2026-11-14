import MarkdownIt from "markdown-it";
import { full as emoji } from "markdown-it-emoji";
import taskLists from "markdown-it-task-lists";
import texmath from "markdown-it-texmath";
import katex from "katex";
import hljs from "highlight.js/lib/common";
import type { BackgroundImage, Slide, SlideRender, ThemeId } from "../types";
import { escapeAttr, escapeHtml, parseImageAlt, type SrcResolver } from "./layout";

export { escapeAttr, escapeHtml } from "./layout";
export type { SrcResolver } from "./layout";

interface RenderEnv {
  backgrounds: BackgroundImage[];
  resolve: SrcResolver;
  [key: string]: unknown;
}

function highlight(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      const value = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      return `<pre class="hljs"><code class="language-${escapeAttr(lang)}">${value}</code></pre>`;
    } catch {
      /* fall through */
    }
  }
  return `<pre class="hljs"><code>${escapeHtml(code)}</code></pre>`;
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight,
});

md.use(emoji as never);
md.use(taskLists as never, { label: true, labelAfter: true });
md.use(texmath as never, {
  engine: katex,
  delimiters: "dollars",
  katexOptions: {
    throwOnError: false,
    output: "html",
    strict: false,
  },
});

const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim().split(/\s+/)[0]?.toLowerCase();
  if (info === "mermaid") {
    return `<div class="mermaid-block" data-code="${escapeAttr(encodeURIComponent(token.content))}"></div>`;
  }
  return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
};

md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const alt = token.content ?? "";
  const rawSrc = String(token.attrGet("src") ?? "");
  const spec = parseImageAlt(alt);
  const renderEnv = env as unknown as RenderEnv;
  const src = renderEnv.resolve(rawSrc);

  if (spec.kind === "bg") {
    renderEnv.backgrounds.push({ src, fit: spec.fit });
    // Keep an inline marker so markdown-it doesn't leave an empty paragraph.
    return `<span class="layout-marker" aria-hidden="true"></span>`;
  }

  if (spec.kind === "normal") {
    const title = String(token.attrGet("title") ?? "");
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${title ? ` title="${escapeAttr(title)}"` : ""}>`;
  }

  return `<img src="${escapeAttr(src)}" alt="" class="slide-img slide-img-${spec.kind}" style="width:${spec.width}%">`;
};

const defaultLinkOpen = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = String(tokens[idx].attrGet("href") ?? "");
  if (/^https?:/i.test(href)) {
    tokens[idx].attrSet("target", "_blank");
    tokens[idx].attrSet("rel", "noopener noreferrer");
  }
  return defaultLinkOpen
    ? defaultLinkOpen(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

/** Renders slide markdown, extracting background images along the way. */
export function renderSlideMarkdown(markdown: string, resolve: SrcResolver): SlideRender {
  const env: RenderEnv = { backgrounds: [], resolve };
  let html = md.render(markdown, env as unknown as Record<string, unknown>);
  html = html.replace(/<p>\s*<span class="layout-marker"[^>]*><\/span>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*<\/p>/g, "");
  return { html, backgrounds: env.backgrounds };
}

export function cssUrl(src: string): string {
  return `url(${JSON.stringify(src)})`;
}

export interface SlideMarkupOptions {
  theme: ThemeId;
  resolve: SrcResolver;
  index: number;
  showPageNumber: boolean;
}

export function slideMarkup(slide: Slide, options: SlideMarkupOptions): string {
  const { html, backgrounds } = renderSlideMarkdown(slide.markdown, options.resolve);
  const layers = backgrounds
    .map(
      (bg) =>
        `<div class="slide-bg" style="background-image:${escapeAttr(cssUrl(bg.src))};background-size:${bg.fit}"></div>`,
    )
    .join("");
  const page = options.showPageNumber
    ? `<div class="slide-number">${options.index + 1}</div>`
    : "";
  return `<section class="slide" data-theme="${options.theme}">${layers}<div class="slide-content">${html}</div>${page}</section>`;
}

/** Parses a markdown image path so callers can look it up in the bundle. */
export function normalizeAssetPath(src: string): string {
  let value = src.trim();
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  try {
    value = decodeURIComponent(value);
  } catch {
    /* keep raw */
  }
  value = value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  return value;
}
