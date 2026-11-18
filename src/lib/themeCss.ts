import type { ResolvedTheme } from "../types";
import type { SrcResolver } from "./markdown";

function formatOf(file: string): string {
  const extension = file.toLowerCase().split(".").pop() ?? "";
  return ["woff2", "woff", "ttf", "otf"].includes(extension) ? extension : "woff2";
}

/**
 * Builds the `@font-face` rules for the bundled families of a theme.
 * Unresolved files are skipped so a missing asset never breaks the slide.
 */
export function fontFaceCss(theme: ResolvedTheme, resolve: SrcResolver): string {
  const rules: string[] = [];
  for (const font of theme.fonts) {
    const url = resolve(font.file);
    if (!url || (!/^(?:blob:|data:|file:)/i.test(url) && !/^https?:/i.test(url))) continue;
    const safeUrl = url.replace(/"/g, "%22").replace(/[\r\n]/g, "");
    const weight = font.weight ?? "400";
    const style = font.style ?? "normal";
    rules.push(
      `@font-face{font-family:"${font.family}";src:url("${safeUrl}") format("${formatOf(font.file)}");font-weight:${weight};font-style:${style};font-display:swap}`,
    );
  }
  return rules.join("\n");
}
