import { useMemo } from "react";
import type { ResolvedTheme } from "../types";
import type { SrcResolver } from "../lib/markdown";
import { fontFaceCss } from "../lib/themeCss";

/** Injects the `@font-face` rules of the bundled theme fonts. */
export function ThemeStyle({
  theme,
  resolve,
}: {
  theme: ResolvedTheme;
  resolve: SrcResolver;
}) {
  const css = useMemo(() => fontFaceCss(theme, resolve), [theme, resolve]);
  if (!css) return null;
  return <style>{css}</style>;
}
