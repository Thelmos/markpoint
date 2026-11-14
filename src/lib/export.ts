import type { Lang, Slide, ThemeId } from "../types";
import { escapeHtml, normalizeAssetPath, slideMarkup, type SrcResolver } from "./markdown";
import { fitSlide, imagesReady } from "./autofit";
import { renderMermaidBlocks } from "./mermaid";
import { fileToDataUrl } from "./assets";
import slidesCss from "../styles/slides.css?inline";
import themesCss from "../styles/themes.css?inline";
import katexCss from "../styles/katex-inline.generated.css?inline";
import deckCss from "../styles/deck.css?inline";
import printCss from "../styles/print.css?inline";

export interface DeckExportOptions {
  slides: Slide[];
  theme: ThemeId;
  lang: Lang;
  paginate: boolean;
  title: string;
  files: Map<string, Uint8Array>;
}

/** Resolves bundle files to data URLs so exports are fully self-contained. */
export function createDataUrlResolver(files: Map<string, Uint8Array>): SrcResolver {
  const cache = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const path of files.keys()) {
    const name = path.split("/").pop();
    if (name && !byName.has(name)) byName.set(name, path);
  }

  return (rawSrc: string) => {
    const path = normalizeAssetPath(rawSrc);
    if (/^(https?:|data:|blob:)/i.test(path)) return rawSrc;

    const resolved =
      (files.has(path) && path) ||
      (files.has(`assets/${path}`) && `assets/${path}`) ||
      byName.get(path.split("/").pop() ?? "");

    if (!resolved) return rawSrc;
    const cached = cache.get(resolved);
    if (cached) return cached;
    const data = fileToDataUrl(files.get(resolved)!, resolved);
    cache.set(resolved, data);
    return data;
  };
}

/** Renders all slides with data URLs, SVG diagrams and fitted text. */
export async function renderDeckMarkup(options: DeckExportOptions): Promise<string> {
  const resolver = createDataUrlResolver(options.files);
  const root = document.createElement("div");
  root.className = "export-render";
  root.style.cssText = "position:fixed;left:-20000px;top:0;width:1280px;";
  document.body.appendChild(root);

  try {
    root.innerHTML = options.slides
      .map(
        (slide) =>
          `<div class="export-slide">${slideMarkup(slide, {
            theme: options.theme,
            resolve: resolver,
            index: slide.index,
            showPageNumber: options.paginate,
          })}</div>`,
      )
      .join("");

    if (document.fonts?.ready) await document.fonts.ready;
    await renderMermaidBlocks(root, options.theme);
    await imagesReady(root);
    root.querySelectorAll<HTMLElement>(".slide").forEach((slide) => fitSlide(slide));
    return root.innerHTML;
  } finally {
    root.remove();
  }
}

function baseDocument(title: string, lang: Lang, styles: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="MarkPoint">
<title>${escapeHtml(title)}</title>
<style>${themesCss}\n${slidesCss}\n${katexCss}\n${styles}</style>
</head>
<body>
${body}
${script ? `<script>${script}</script>` : ""}
</body>
</html>`;
}

export function buildStandaloneHtml(markup: string, title: string, lang: Lang): string {
  const hint =
    lang === "es"
      ? "← → · Espacio · F pantalla completa"
      : "← → · Space · F fullscreen";
  const script = `(() => {
  const slides = Array.from(document.querySelectorAll('.deck .export-slide'));
  if (!slides.length) return;
  let current = 0;
  try {
    const hash = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(hash)) current = Math.min(slides.length - 1, Math.max(0, hash - 1));
  } catch (e) {}
  const fit = () => {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    slides.forEach((wrap) => {
      wrap.style.width = (1280 * s) + 'px';
      wrap.style.height = (720 * s) + 'px';
      const slide = wrap.querySelector('.slide');
      if (slide) slide.style.transform = 'scale(' + s + ')';
    });
  };
  const show = (index) => {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((wrap, i) => wrap.classList.toggle('is-active', i === current));
    const counter = document.getElementById('mp-counter');
    if (counter) counter.textContent = (current + 1) + ' / ' + slides.length;
    const progress = document.getElementById('mp-progress');
    if (progress) progress.style.width = ((current + 1) / slides.length * 100) + '%';
    try { history.replaceState(null, '', '#' + (current + 1)); } catch (e) {}
  };
  window.addEventListener('resize', fit);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault(); show(current + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp' || event.key === 'Backspace') {
      event.preventDefault(); show(current - 1);
    } else if (event.key === 'Home') { event.preventDefault(); show(0); }
    else if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
    else if (event.key === 'f' || event.key === 'F') {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.().catch(() => {});
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.mp-chrome')) return;
    show(current + (event.clientX < window.innerWidth * 0.22 ? -1 : 1));
  });
  fit();
  show(current);
})();`;

  return baseDocument(
    title,
    lang,
    deckCss,
    `<div class="deck">${markup}</div>
<div class="mp-progress"><span id="mp-progress"></span></div>
<div class="mp-counter mp-chrome" id="mp-counter"></div>
<div class="mp-hint">${escapeHtml(hint)}</div>`,
    script,
  );
}

export function buildPrintHtml(markup: string, title: string, lang: Lang): string {
  return baseDocument(
    title,
    lang,
    printCss,
    `<div class="print-deck">${markup}</div>`,
  );
}
