import type { ThemeId } from "../types";

type MermaidModule = typeof import("mermaid").default;

let loader: Promise<MermaidModule> | null = null;
let initializedTheme: ThemeId | null = null;

async function getMermaid(): Promise<MermaidModule> {
  if (!loader) loader = import("mermaid").then((mod) => mod.default);
  return loader;
}

function mermaidTheme(theme: ThemeId): "default" | "dark" {
  return theme === "dark" || theme === "ocean" ? "dark" : "default";
}

export async function initMermaid(theme: ThemeId): Promise<MermaidModule> {
  const mermaid = await getMermaid();
  if (initializedTheme !== theme) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose",
      theme: mermaidTheme(theme),
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      themeVariables: {
        fontSize: "18px",
      },
      flowchart: { htmlLabels: true, curve: "basis" },
    });
    initializedTheme = theme;
  }
  return mermaid;
}

let counter = 0;

/** Replaces every pending `.mermaid-block` under `root` with rendered SVG. */
export async function renderMermaidBlocks(root: ParentNode, theme: ThemeId): Promise<void> {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(".mermaid-block:not([data-rendered])"));
  if (blocks.length === 0) return;
  const mermaid = await initMermaid(theme);

  for (const block of blocks) {
    const encoded = block.dataset.code ?? "";
    let code = "";
    try {
      code = decodeURIComponent(encoded);
    } catch {
      code = encoded;
    }
    block.dataset.rendered = "1";
    const id = `mermaid-${++counter}`;
    try {
      const { svg } = await mermaid.render(id, code);
      block.innerHTML = svg;
      block.classList.add("mermaid-rendered");
    } catch (error) {
      block.innerHTML = `<pre class="mermaid-error">${escapeHtml(code)}\n\n${escapeHtml(
        error instanceof Error ? error.message : String(error),
      )}</pre>`;
      block.classList.add("mermaid-failed");
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
