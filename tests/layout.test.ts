import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeck } from "../src/lib/parser.ts";
import { setLayoutInMarkdown } from "../src/lib/slideLayout.ts";
import {
  renderSlideMarkdown,
  slideContentClass,
  splitHtmlBlocks,
} from "../src/lib/markdown.ts";
import {
  MIN_BODY_FONT,
  MIN_TITLE_FONT,
  SECTION_MAX_BODY_FONT,
  SECTION_MAX_TITLE_FONT,
  fitFontSize,
} from "../src/lib/autofit.ts";

const DECK = `---
title: Demo
---

<!-- layout: section -->

# Hola

Sub
`;

test("the layout directive is extracted and the slide lines stay intact", () => {
  const slide = parseDeck(DECK).slides[0];
  assert.equal(slide.layout, "section");
  assert.equal(slide.layoutWarning, null);
  assert.equal(slide.layoutLine, 5);
  assert.equal(slide.startLine, 5);
  assert.equal(slide.endLine, 9);
  assert.equal(slide.markdown, "# Hola\n\nSub");
});

test("an unknown layout is ignored but remembered for a warning", () => {
  const slide = parseDeck("<!-- layout: whatever -->\n\n# Hola\n").slides[0];
  assert.equal(slide.layout, null);
  assert.equal(slide.layoutWarning, "whatever");
  assert.equal(slide.layoutLine, 1);
  assert.equal(slide.markdown, "# Hola");
});

test("only the first non-empty line is a directive", () => {
  const slide = parseDeck("# Hola\n\n<!-- layout: section -->\n").slides[0];
  assert.equal(slide.layout, null);
  assert.equal(slide.layoutWarning, null);
  assert.match(slide.markdown, /<!-- layout: section -->/);
});

test("layout ids are normalized", () => {
  const slide = parseDeck("<!-- layout: Content_2C -->\n\n# Hola\n").slides[0];
  assert.equal(slide.layout, "content-2c");
});

function apply(markdown: string, from: number, to: number, insert: string): string {
  return markdown.slice(0, from) + insert + markdown.slice(to);
}

test("a layout directive can be added, changed and removed", () => {
  const base = "---\ntitle: Demo\n---\n\n# Hola\n\nSub\n";
  const slide = parseDeck(base).slides[0];
  assert.equal(slide.layout, null);

  const add = setLayoutInMarkdown(base, slide, "content-2c");
  assert.ok(add);
  const withLayout = apply(base, add.from, add.to, add.insert);
  assert.equal(parseDeck(withLayout).slides[0].layout, "content-2c");
  assert.match(withLayout, /^---\ntitle: Demo\n---\n\n<!-- layout: content-2c -->\n\n# Hola/m);

  const added = parseDeck(withLayout).slides[0];
  const change = setLayoutInMarkdown(withLayout, added, "section");
  assert.ok(change);
  const changed = apply(withLayout, change.from, change.to, change.insert);
  assert.equal(parseDeck(changed).slides[0].layout, "section");
  assert.equal((changed.match(/layout:/g) ?? []).length, 1);

  const changedSlide = parseDeck(changed).slides[0];
  const remove = setLayoutInMarkdown(changed, changedSlide, null);
  assert.ok(remove);
  const removed = apply(changed, remove.from, remove.to, remove.insert);
  assert.equal(parseDeck(removed).slides[0].layout, null);
  assert.ok(!removed.includes("<!-- layout"));
});

test("removing a layout that does not exist is a no-op", () => {
  const markdown = "# Hola\n";
  const slide = parseDeck(markdown).slides[0];
  assert.equal(setLayoutInMarkdown(markdown, slide, null), null);
});

test("content layouts split the first heading into the title zone", () => {
  const render = renderSlideMarkdown(
    "# Título\n\nCuerpo uno\n\nCuerpo dos",
    (src) => src,
    "content-2c",
  );
  assert.equal(render.layout, "content-2c");
  assert.equal(render.hasBody, true);
  assert.match(render.html, /class="layout-title"><h1>Título<\/h1>/);
  assert.match(render.html, /layout-flow layout-flow-2c/);
  assert.ok(render.html.indexOf("layout-title") < render.html.indexOf("Cuerpo uno"));
  assert.match(slideContentClass(render), /slide-has-layout/);
  assert.doesNotMatch(slideContentClass(render), /layout-centered/);
});

test("section centers the block vertically and content layouts do not", () => {
  const section = renderSlideMarkdown("# Título\n\nTexto", (src) => src, "section");
  assert.match(slideContentClass(section), /layout-centered/);
  assert.match(section.html, /class="layout-title"/);

  const content = renderSlideMarkdown("# Título\n\nTexto", (src) => src, "content-1c");
  assert.doesNotMatch(slideContentClass(content), /layout-centered/);
});

test("without a directive the rendering is unchanged", () => {
  const render = renderSlideMarkdown("# Título\n\nCuerpo", (src) => src);
  assert.equal(render.layout, null);
  assert.equal(render.hasBody, false);
  assert.ok(!render.html.includes("layout-"));
  assert.equal(slideContentClass(render), "slide-content");
});

test("floating images join the body of a two-column slide", () => {
  const render = renderSlideMarkdown(
    "# Título\n\n![left](foto.png)\n\nTexto que envuelve la imagen",
    (src) => src,
    "content-2c",
  );
  const image = render.html.indexOf("slide-img-left");
  assert.ok(image > render.html.indexOf("layout-title"));
  assert.ok(image < render.html.indexOf("Texto que envuelve"));
});

test("text-only two-column slides keep the balanced CSS columns", () => {
  const render = renderSlideMarkdown(
    "# Título\n\nPrimer párrafo\n\nSegundo párrafo",
    (src) => src,
    "content-2c",
  );
  assert.match(render.html, /layout-flow-2c layout-flow-balanced/);
  assert.doesNotMatch(render.html, /layout-columns/);
});

test("text before an image goes left and the image goes right", () => {
  const render = renderSlideMarkdown(
    "# Título\n\nTexto de la izquierda\n\n![right](foto.png)\n\nTexto de la derecha",
    (src) => src,
    "content-2c",
  );
  assert.match(
    render.html,
    /<div class="layout-col"><p>Texto de la izquierda<\/p>\s*<p>Texto de la derecha<\/p><\/div><div class="layout-col"><img[^>]*slide-img-right/,
  );
});

test("all text before the first special block shares the left column", () => {
  const render = renderSlideMarkdown(
    "# Título\n\nPrimero\n\nSegundo\n\n![left](foto.png)",
    (src) => src,
    "content-2c",
  );
  assert.match(
    render.html,
    /<div class="layout-col"><p>Primero<\/p>\s*<p>Segundo<\/p><\/div><div class="layout-col"><img/,
  );
});

test("an image first chooses the left column and the text goes right", () => {
  const render = renderSlideMarkdown(
    "# Título\n\n![left](foto.png)\n\nTexto a la derecha",
    (src) => src,
    "content-2c",
  );
  assert.match(
    render.html,
    /<div class="layout-col"><img[^>]*slide-img-left[^>]*><\/div><div class="layout-col"><p>Texto a la derecha/,
  );
});

test("code blocks and diagrams also get their own column", () => {
  const code = renderSlideMarkdown(
    "# Título\n\nIntroducción\n\n```ts\nconst a = 1;\n```",
    (src) => src,
    "content-2c",
  );
  assert.match(
    code.html,
    /<div class="layout-col"><p>Introducción<\/p><\/div><div class="layout-col"><pre/,
  );

  const mermaid = renderSlideMarkdown(
    "# Título\n\nIntroducción\n\n```mermaid\nflowchart LR\n  A --> B\n```",
    (src) => src,
    "content-2c",
  );
  assert.match(
    mermaid.html,
    /<div class="layout-col"><p>Introducción<\/p><\/div><div class="layout-col"><div class="mermaid-block"/,
  );
});

test("splitHtmlBlocks keeps nested blocks together", () => {
  const blocks = splitHtmlBlocks(
    '<p>Uno</p>\n<ul><li>A</li><li>B</li></ul>\n<pre><code>x</code></pre>\n<div class="mermaid-block"><span>x</span></div>',
  );
  assert.equal(blocks.length, 4);
  assert.match(blocks[1], /^<ul>/);
  assert.match(blocks[2], /^<pre>/);
  assert.match(blocks[3], /^<div class="mermaid-block">/);
});

test("each region has its own minimum font size", () => {
  assert.equal(MIN_TITLE_FONT, 28);
  assert.equal(MIN_BODY_FONT, 13);
});

test("section uses a larger title and a quieter body", () => {
  assert.ok(SECTION_MAX_TITLE_FONT > 82);
  assert.ok(SECTION_MAX_BODY_FONT < 74);
});

test("fitFontSize finds the largest size that fits", () => {
  const size = fitFontSize(13, 74, (value) => value <= 40);
  assert.ok(size <= 40 && size > 39.5, `unexpected size ${size}`);
  assert.equal(fitFontSize(13, 74, () => true), 74);
  assert.equal(fitFontSize(13, 74, () => false), 13);
});
