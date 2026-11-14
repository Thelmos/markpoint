import type { ThemeId } from "../types";

export interface ThemeOption {
  id: ThemeId;
  labelKey: string;
  swatch: string;
}

export const THEMES: ThemeOption[] = [
  { id: "light", labelKey: "themeLight", swatch: "linear-gradient(135deg,#fbfaf7,#dbe6f7)" },
  { id: "dark", labelKey: "themeDark", swatch: "linear-gradient(135deg,#1a2130,#0b0f16)" },
  { id: "ocean", labelKey: "themeOcean", swatch: "linear-gradient(135deg,#0b3357,#0a5b7a)" },
  { id: "sand", labelKey: "themeSand", swatch: "linear-gradient(135deg,#f7f0e1,#dcc29a)" },
];
