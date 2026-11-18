import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDeck } from "../src/lib/parser.ts";
import { hasThemeOverrides, resolveTheme, specFromResolved } from "../src/lib/themes.ts";
import { setThemeInMarkdown, themeBlockLines, themeText } from "../src/lib/themeBlock.ts";

test("a preset resolves to its CSS variables", () => {
  const theme = resolveTheme("ocean");
  assert.equal(theme.presetId, "ocean");
  assert.equal(theme.vars["--slide-bg"], theme.values.bg);
  assert.match(theme.vars["--slide-bg"], /gradient/);
  assert.equal(theme.warnings.length, 0);
});

test("a map overrides the base preset", () => {
  const theme = resolveTheme({ base: "dark", accent: "#ff0000", padX: 120 });
  assert.equal(theme.presetId, null);
  assert.equal(theme.values.accent, "#ff0000");
  assert.equal(theme.values.padX, 120);
  assert.equal(theme.values.bg, resolveTheme("dark").values.bg);
});

test("unsafe values are ignored", () => {
  const base = resolveTheme("light");
  const theme = resolveTheme({
    base: "light",
    bg: "url(https://evil.test/a.png)",
    accent: "var(--app-accent)",
    font: "Inter; background:url(x)",
  });
  assert.equal(theme.values.bg, base.values.bg);
  assert.equal(theme.values.accent, base.values.accent);
  assert.equal(theme.values.font, base.values.font);
  assert.ok(theme.warnings.length >= 3);
});

test("padding is clamped", () => {
  const theme = resolveTheme({ base: "light", padX: 9999, padY: -4 });
  assert.equal(theme.values.padX, 200);
  assert.equal(theme.values.padY, 0);
  assert.equal(theme.warnings.length, 0);
});

test("table lines follow the border colour unless overridden", () => {
  const base = resolveTheme("light");
  assert.equal(base.values.tableLines, base.values.border);
  assert.equal(base.values.tableRowLines, true);
  assert.equal(base.values.tableColumnLines, false);

  const border = resolveTheme({ base: "light", border: "#ff0000" });
  assert.equal(border.values.tableLines, "#ff0000");

  const explicit = resolveTheme({ base: "light", tableLines: "#00ff00" });
  assert.equal(explicit.values.tableLines, "#00ff00");
  assert.equal(explicit.vars["--slide-table-border"], "#00ff00");
});

test("table line toggles map to border widths", () => {
  const theme = resolveTheme({ base: "light", tableRowLines: false, tableColumnLines: true });
  assert.equal(theme.vars["--slide-table-row-width"], "0px");
  assert.equal(theme.vars["--slide-table-col-width"], "1px");

  const invalid = resolveTheme({ base: "light", tableRowLines: "no" });
  assert.equal(invalid.values.tableRowLines, true);
  assert.ok(invalid.warnings.length > 0);
});

test("themeText writes the table settings", () => {
  const text = themeText({
    base: "light",
    tableLines: "#ff0000",
    tableRowLines: false,
    tableColumnLines: true,
  });
  assert.match(text, /tableLines: "#ff0000"/);
  assert.match(text, /tableRowLines: false/);
  assert.match(text, /tableColumnLines: true/);
});

test("overrides are detected", () => {
  assert.equal(hasThemeOverrides("ocean"), false);
  assert.equal(hasThemeOverrides({ base: "ocean", name: "X" }), false);
  assert.equal(hasThemeOverrides({ base: "ocean", accent: "#ffffff" }), true);
  assert.equal(hasThemeOverrides({ base: "ocean", fonts: [] }), true);
});

test("a resolved theme round-trips into a spec", () => {
  const theme = resolveTheme({ base: "sand", accent: "#123456" });
  const spec = specFromResolved(theme, { name: "Mío" });
  assert.equal(spec.name, "Mío");
  assert.equal(spec.base, "sand");
  assert.equal(spec.accent, "#123456");
  assert.ok(spec.syntax?.keyword);
  const resolved = resolveTheme(spec);
  assert.equal(resolved.values.accent, "#123456");
  assert.equal(resolved.values.bg, theme.values.bg);
});

test("the theme block is inserted into existing front matter", () => {
  const markdown = "---\ntitle: Demo\n---\n\n# Slide\n";
  const deck = parseDeck(markdown);
  const edit = setThemeInMarkdown(markdown, deck.frontMatterRange, "ocean");
  const next = markdown.slice(0, edit.from) + edit.insert + markdown.slice(edit.to);
  assert.match(next, /title: Demo\ntheme: ocean\n---/);
  assert.equal(parseDeck(next).frontMatter.theme, "ocean");
});

test("front matter is created when missing", () => {
  const markdown = "# Slide\n\nBody\n";
  const deck = parseDeck(markdown);
  const edit = setThemeInMarkdown(markdown, deck.frontMatterRange, "dark");
  const next = edit.insert + markdown;
  assert.equal(parseDeck(next).frontMatter.theme, "dark");
  assert.equal(parseDeck(next).slides[0].markdown, "# Slide\n\nBody");
});

test("an existing theme map is replaced as a whole", () => {
  const markdown =
    '---\ntitle: Demo\ntheme:\n  name: Old\n  base: light\n  accent: "#000000"\nauthor: Me\n---\n\n# Slide\n';
  const deck = parseDeck(markdown);
  const edit = setThemeInMarkdown(markdown, deck.frontMatterRange, "sand");
  const next = markdown.slice(0, edit.from) + edit.insert + markdown.slice(edit.to);
  assert.match(next, /author: Me/);
  assert.match(next, /theme: sand/);
  assert.doesNotMatch(next, /accent/);
  assert.equal(parseDeck(next).frontMatter.theme, "sand");
});

test("themeText writes nested syntax and fonts", () => {
  const text = themeText({
    name: "Mi tema",
    base: "light",
    accent: "#0ea5e9",
    syntax: { keyword: "#ff0000" },
    fonts: [{ family: "Inter", file: "assets/fonts/inter.woff2", weight: "400" }],
  });
  assert.match(text, /theme:\n  name: "Mi tema"/);
  assert.match(text, /  syntax:\n    keyword: "#ff0000"/);
  assert.match(text, /  fonts:\n    - family: "Inter"/);
});

test("themeBlockLines returns the theme range", () => {
  const markdown =
    '---\ntitle: Demo\ntheme:\n  base: light\n  bg: "#fff"\nauthor: Me\n---\n\n# Slide\n';
  const deck = parseDeck(markdown);
  assert.deepEqual(themeBlockLines(markdown, deck.frontMatterRange), { from: 3, to: 5 });
});

test("themeBlockLines is null without a theme key", () => {
  const markdown = "---\ntitle: Demo\n---\n\n# Slide\n";
  const deck = parseDeck(markdown);
  assert.equal(themeBlockLines(markdown, deck.frontMatterRange), null);
});
