import { test } from "node:test";
import assert from "node:assert/strict";
import { zipSync } from "fflate";
import { parseDeck } from "../src/lib/parser.ts";
import { setBackgroundInMarkdown } from "../src/lib/background.ts";
import {
  createProjectFromTemplate,
  decodeTemplateZip,
  encodeTemplateZip,
  setFrontMatterTitle,
  templateArchiveFromEntries,
  type TemplateArchive,
  type TemplatePack,
} from "../src/lib/templates.ts";
import { BUILTIN_TEMPLATE } from "../src/lib/builtinTemplate.ts";
import { bytesToText, textToBytes } from "../src/lib/assets.ts";

function apply(markdown: string, edit: { from: number; to: number; insert: string }): string {
  return markdown.slice(0, edit.from) + edit.insert + markdown.slice(edit.to);
}

function builtinPack(): TemplatePack {
  const arts: TemplatePack["arts"] = {};
  for (const layout of ["cover", "section", "content-1c", "content-2c"] as const) {
    const bytes = BUILTIN_TEMPLATE.arts[layout];
    if (bytes) arts[layout] = bytes;
  }
  return {
    id: "editorial",
    name: "Editorial",
    description: "Demo",
    themeYaml: BUILTIN_TEMPLATE.themeYaml,
    theme: { name: "Editorial", base: "light", accent: "#2563eb" },
    example: BUILTIN_TEMPLATE.example,
    arts,
    fonts: [],
  };
}

test("a background is inserted at the start of the slide", () => {
  const deck = "---\ntitle: Demo\n---\n\n## Hola\n\nTexto\n";
  const slide = parseDeck(deck).slides[0];
  const edit = setBackgroundInMarkdown(deck, slide, "assets/fondo azul.png");
  assert.ok(edit);
  const result = apply(deck, edit);
  assert.match(result, /## Hola|# Hola|!\[bg\]\(assets\/fondo%20azul\.png\)/);
  assert.equal(parseDeck(result).slides[0].markdown.split("\n")[0], "![bg](assets/fondo%20azul.png)");
  assert.equal(parseDeck(result).slides[0].layout, null);
});

test("a background keeps the layout directive first", () => {
  const deck = "<!-- layout: section -->\n\n# Hola\n\nTexto\n";
  const slide = parseDeck(deck).slides[0];
  const edit = setBackgroundInMarkdown(deck, slide, "assets/bg.png");
  assert.ok(edit);
  const result = apply(deck, edit);
  const parsed = parseDeck(result);
  assert.equal(parsed.slides[0].layout, "section");
  assert.equal(parsed.slides[0].markdown.split("\n")[0], "![bg](assets/bg.png)");
});

test("an existing background is replaced and duplicates are removed", () => {
  const deck = `# Hola

![bg](assets/old.png)

Texto

![bg:contain](assets/older.png)

Final
`;
  const slide = parseDeck(deck).slides[0];
  const edit = setBackgroundInMarkdown(deck, slide, "assets/new.png");
  assert.ok(edit);
  const result = apply(deck, edit);
  assert.equal((result.match(/!\[bg/g) ?? []).length, 1);
  assert.match(result, /!\[bg\]\(assets\/new\.png\)/);
  assert.match(result, /Texto/);
  assert.match(result, /Final/);
});

test("a background line inside a code block is not treated as a background", () => {
  const deck = `# Hola

\`\`\`md
![bg](assets/inside.png)
\`\`\`

Texto
`;
  const slide = parseDeck(deck).slides[0];
  const edit = setBackgroundInMarkdown(deck, slide, "assets/new.png");
  assert.ok(edit);
  const result = apply(deck, edit);
  assert.match(result, /!\[bg\]\(assets\/inside\.png\)/);
  assert.match(result, /!\[bg\]\(assets\/new\.png\)/);
  assert.equal((result.match(/!\[bg/g) ?? []).length, 2);
});

test("the front matter title can be replaced or created", () => {
  const withTitle = "---\ntitle: Old\nauthor: Me\n---\n\n# Hola\n";
  assert.match(setFrontMatterTitle(withTitle, "New"), /title: "New"/);
  assert.doesNotMatch(setFrontMatterTitle(withTitle, "New"), /title: "Old"/);
  assert.match(setFrontMatterTitle(withTitle, "New"), /author: Me/);

  const without = "# Hola\n";
  const created = setFrontMatterTitle(without, "Mi título");
  assert.match(created, /^---\ntitle: "Mi título"\n---\n\n# Hola/);
});

test("a template archive validates its files", () => {
  const archive = templateArchiveFromEntries(
    new Map([
      ["theme.yaml", textToBytes("name: Prueba\ndescription: Demo\nbase: light\n")],
      ["example.md", textToBytes("# Hola\n")],
      [
        "cover.svg",
        textToBytes('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'),
      ],
    ]),
    "Prueba",
  );
  assert.ok((archive.arts.cover?.byteLength ?? 0) > 0);
  assert.equal(archive.fonts.length, 0);
});

test("an archive with a parent path is rejected", () => {
  assert.throws(
    () =>
      templateArchiveFromEntries(
        new Map([
          ["../theme.yaml", textToBytes("name: Prueba\nbase: light\n")],
          ["example.md", textToBytes("# Hola\n")],
        ]),
        "Prueba",
      ),
    /Invalid/,
  );
});

test("an archive with a missing theme is rejected", () => {
  assert.throws(
    () =>
      templateArchiveFromEntries(
        new Map([["example.md", textToBytes("# Hola\n")]]),
        "Prueba",
      ),
    /theme\.yaml/,
  );
});

test("a zip with a missing referenced background is rejected", () => {
  assert.throws(
    () =>
      templateArchiveFromEntries(
        new Map([
          ["theme.yaml", textToBytes("name: Rota\nbase: light\n")],
          ["example.md", textToBytes("![bg](cover.svg)\n")],
        ]),
        "Rota",
      ),
    /cover\.svg is missing/,
  );
});

test("a template zip round-trips theme, art and example", () => {
  const pack = builtinPack();
  const zip = encodeTemplateZip(pack);
  const decoded = decodeTemplateZip(zip, "Editorial");
  assert.equal(decoded.name, "Editorial");
  assert.equal(decoded.arts.cover?.byteLength, pack.arts.cover?.byteLength);
  assert.match(decoded.example, /layout: content-2c/);
});

test("a zip with an invalid path is rejected before creating a pack", () => {
  const bytes = zipSync({
    "theme.yaml": textToBytes("name: Malo\nbase: light\n"),
    "example.md": textToBytes("# Hola\n"),
    "../evil.svg": textToBytes('<svg xmlns="http://www.w3.org/2000/svg"/>'),
  });
  assert.throws(() => decodeTemplateZip(bytes, "Malo"), /Invalid path/);
});

test("a zip with a missing declared font is rejected", () => {
  const bytes = zipSync({
    "theme.yaml": textToBytes(
      "name: Fuente\nbase: light\nfonts:\n  - family: Inter\n    file: fonts/inter.woff2\n",
    ),
    "example.md": textToBytes("# Hola\n"),
  });
  assert.throws(() => decodeTemplateZip(bytes, "Fuente"), /missing/);
});

test("creating a project copies art and injects the theme", () => {
  const pack = builtinPack();
  const project = createProjectFromTemplate(pack);
  assert.equal(project.manifest.title, "Editorial");
  assert.ok(project.files.has("assets/cover.svg"));
  assert.ok(project.files.has("assets/section.svg"));
  assert.ok(project.files.has("assets/content-1c.svg"));
  assert.ok(project.files.has("assets/content-2c.svg"));
  assert.match(project.markdown, /theme:/);
  assert.match(project.markdown, /title: "Editorial"/);
  assert.match(project.markdown, /!\[bg\]\(assets\/cover\.svg\)/);
  assert.doesNotMatch(project.markdown, /!\[bg\]\(cover\.svg\)/);
  assert.equal(parseDeck(project.markdown).slides.length, 4);
});

test("creating a project copies fonts and rewrites their paths", () => {
  const archive: TemplateArchive = {
    themeYaml:
      "name: Con fuente\nbase: light\nfont: \"Inter\", system-ui, sans-serif\nfonts:\n  - family: Inter\n    file: fonts/inter.woff2\n",
    example: "---\ntitle: Demo\n---\n\n# Hola\n",
    arts: {},
    fonts: [{ path: "inter.woff2", bytes: new Uint8Array([1, 2, 3]) }],
  };
  const pack: TemplatePack = {
    id: "con-fuente",
    name: "Con fuente",
    description: "",
    themeYaml: archive.themeYaml,
    theme: {
      name: "Con fuente",
      base: "light",
      fonts: [{ family: "Inter", file: "fonts/inter.woff2" }],
    },
    example: archive.example,
    arts: {},
    fonts: archive.fonts,
  };
  const project = createProjectFromTemplate(pack);
  assert.ok(project.files.has("assets/fonts/inter.woff2"));
  assert.match(bytesToText(textToBytes(project.markdown)), /assets\/fonts\/inter\.woff2/);
  assert.match(project.markdown, /font: .*Inter/);
});
