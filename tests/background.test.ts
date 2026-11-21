import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeck } from "../src/lib/parser.ts";
import {
  backgroundOfSlide,
  backgroundsInMarkdown,
  collectBackgrounds,
  removeBackgroundFromMarkdown,
  setBackgroundInMarkdown,
} from "../src/lib/background.ts";

function apply(markdown: string, edit: { from: number; to: number; insert: string }): string {
  return markdown.slice(0, edit.from) + edit.insert + markdown.slice(edit.to);
}

test("backgrounds are read with their fit and code fences are ignored", () => {
  const markdown = `# Hola

![bg](assets/cover.png)

\`\`\`md
![bg](assets/inside.png)
\`\`\`

![bg:contain](assets/logo%20blanco.svg)
`;
  const found = backgroundsInMarkdown(markdown);
  assert.deepEqual(found, [
    { src: "assets/cover.png", fit: "cover" },
    { src: "assets/logo blanco.svg", fit: "contain" },
  ]);
});

test("the deck collects each background once and the slide exposes the first", () => {
  const deck = parseDeck(`![bg](assets/cover.png)

Texto

---

# Otra

![bg](assets/cover.png)

![bg:contain](assets/logo.svg)

---

# Tercera

![bg](assets/fondo.png)
`);
  assert.deepEqual(collectBackgrounds(deck.slides), [
    { src: "assets/cover.png", fit: "cover" },
    { src: "assets/logo.svg", fit: "contain" },
    { src: "assets/fondo.png", fit: "cover" },
  ]);
  assert.deepEqual(backgroundOfSlide(deck.slides[1]), {
    src: "assets/cover.png",
    fit: "cover",
  });
  assert.equal(backgroundOfSlide(deck.slides[2])?.src, "assets/fondo.png");
});

test("selecting a background keeps its fit", () => {
  const deck = "---\ntitle: Demo\n---\n\n<!-- layout: content-1c -->\n\n# Hola\n\nTexto\n";
  const slide = parseDeck(deck).slides[0];
  const edit = setBackgroundInMarkdown(deck, slide, "assets/logo.svg", "contain");
  assert.ok(edit);
  const result = apply(deck, edit);
  assert.match(result, /!\[bg:contain\]\(assets\/logo\.svg\)/);
  assert.equal(parseDeck(result).slides[0].layout, "content-1c");
});

test("external background URLs are written without percent-encoding", () => {
  const deck = "# Hola\n\nTexto\n";
  const slide = parseDeck(deck).slides[0];
  const edit = setBackgroundInMarkdown(deck, slide, "https://example.com/a b.png");
  assert.ok(edit);
  const result = apply(deck, edit);
  assert.match(result, /!\[bg\]\(https:\/\/example\.com\/a b\.png\)/);
});

test("the active background can be removed without touching the content", () => {
  const deck = `<!-- layout: section -->

![bg](assets/cover.png)

# Hola

Texto
`;
  const slide = parseDeck(deck).slides[0];
  const edit = removeBackgroundFromMarkdown(deck, slide);
  assert.ok(edit);
  const result = apply(deck, edit);
  assert.doesNotMatch(result, /!\[bg/);
  assert.match(result, /<!-- layout: section -->/);
  assert.match(result, /# Hola/);
  assert.match(result, /Texto/);
});

test("removing a background that does not exist is a no-op", () => {
  const deck = "# Hola\n";
  const slide = parseDeck(deck).slides[0];
  assert.equal(removeBackgroundFromMarkdown(deck, slide), null);
});
