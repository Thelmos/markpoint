import type {
  ResolvedTheme,
  ThemeFont,
  ThemeSpec,
  ThemeSyntax,
  ThemeValues,
} from "../types";

/* ------------------------------------------------------------------ presets */

export interface ThemePreset {
  id: string;
  labelKey: string;
  swatch: string;
  dark: boolean;
  values: ThemeValues;
}

const SEGOE = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif';
const SEGOE_DISPLAY =
  '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif';

const LIGHT: ThemeValues = {
  bg: "#fbfaf7",
  fg: "#1b2430",
  muted: "#5d6b7e",
  accent: "#2563eb",
  accent2: "#7c3aed",
  border: "#dbe2ec",
  codeBg: "#f0f3f8",
  codeFg: "#253044",
  quoteBg: "#edf3ff",
  quoteBorder: "#7aa7ff",
  tableHead: "#edf2fa",
  tableLines: "#dbe2ec",
  tableRowLines: true,
  tableColumnLines: false,
  mark: "#fde68a",
  scrim: "rgba(251, 250, 247, 0.35)",
  font: SEGOE,
  headingFont: SEGOE_DISPLAY,
  padX: 96,
  padY: 78,
  syntax: {
    keyword: "#a21caf",
    string: "#15803d",
    number: "#b45309",
    comment: "#8a94a6",
    function: "#1d4ed8",
    type: "#0e7490",
    tag: "#b91c1c",
    attr: "#b45309",
    builtIn: "#7c3aed",
  },
};

const DARK: ThemeValues = {
  bg: "#151a23",
  fg: "#e9eff9",
  muted: "#9aa9be",
  accent: "#7aa2ff",
  accent2: "#b692ff",
  border: "#2c3648",
  codeBg: "#0c1119",
  codeFg: "#dbe5f3",
  quoteBg: "#1b2434",
  quoteBorder: "#6ea8ff",
  tableHead: "#202938",
  tableLines: "#2c3648",
  tableRowLines: true,
  tableColumnLines: false,
  mark: "#facc15",
  scrim: "rgba(9, 13, 20, 0.58)",
  font: SEGOE,
  headingFont: SEGOE_DISPLAY,
  padX: 96,
  padY: 78,
  syntax: {
    keyword: "#c4a7ff",
    string: "#9be28f",
    number: "#ffc46b",
    comment: "#6b7a90",
    function: "#8ab4ff",
    type: "#6fe3e1",
    tag: "#ff8f8f",
    attr: "#ffc46b",
    builtIn: "#b692ff",
  },
};

const OCEAN: ThemeValues = {
  bg: "linear-gradient(135deg, #061a34 0%, #0b3357 48%, #075066 100%)",
  fg: "#eaf5ff",
  muted: "#a6c2da",
  accent: "#67e8f9",
  accent2: "#a5b4fc",
  border: "rgba(255, 255, 255, 0.2)",
  codeBg: "rgba(2, 12, 24, 0.55)",
  codeFg: "#e2f2ff",
  quoteBg: "rgba(103, 232, 249, 0.09)",
  quoteBorder: "#67e8f9",
  tableHead: "rgba(255, 255, 255, 0.1)",
  tableLines: "rgba(255, 255, 255, 0.2)",
  tableRowLines: true,
  tableColumnLines: false,
  mark: "#fde68a",
  scrim: "rgba(3, 14, 28, 0.52)",
  font: SEGOE,
  headingFont: SEGOE_DISPLAY,
  padX: 100,
  padY: 82,
  syntax: {
    keyword: "#b8a4ff",
    string: "#9df0c7",
    number: "#ffd28a",
    comment: "#7d9ab5",
    function: "#8fd8ff",
    type: "#8cf1f0",
    tag: "#ff9fae",
    attr: "#ffd28a",
    builtIn: "#d3b4ff",
  },
};

const SAND: ThemeValues = {
  bg: "linear-gradient(155deg, #f9f2e3 0%, #f1e5cd 55%, #ecdcc0 100%)",
  fg: "#3a3024",
  muted: "#71614d",
  accent: "#b45309",
  accent2: "#9d174d",
  border: "#dcc9a6",
  codeBg: "#f3e9d6",
  codeFg: "#3b3022",
  quoteBg: "#f0e2c5",
  quoteBorder: "#b45309",
  tableHead: "#ecdcbe",
  tableLines: "#dcc9a6",
  tableRowLines: true,
  tableColumnLines: false,
  mark: "#fcd34d",
  scrim: "rgba(249, 242, 227, 0.32)",
  font: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  headingFont: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  padX: 96,
  padY: 78,
  syntax: {
    keyword: "#9d174d",
    string: "#3f6212",
    number: "#b45309",
    comment: "#8a7a63",
    function: "#1d4ed8",
    type: "#0f766e",
    tag: "#b91c1c",
    attr: "#b45309",
    builtIn: "#7c3aed",
  },
};

export const PRESETS: ThemePreset[] = [
  {
    id: "light",
    labelKey: "themeLight",
    swatch: "linear-gradient(135deg,#fbfaf7,#dbe6f7)",
    dark: false,
    values: LIGHT,
  },
  {
    id: "dark",
    labelKey: "themeDark",
    swatch: "linear-gradient(135deg,#1a2130,#0b0f16)",
    dark: true,
    values: DARK,
  },
  {
    id: "ocean",
    labelKey: "themeOcean",
    swatch: "linear-gradient(135deg,#0b3357,#0a5b7a)",
    dark: true,
    values: OCEAN,
  },
  {
    id: "sand",
    labelKey: "themeSand",
    swatch: "linear-gradient(135deg,#f7f0e1,#dcc29a)",
    dark: false,
    values: SAND,
  },
];

export const PRESET_MAP: Record<string, ThemePreset> = Object.fromEntries(
  PRESETS.map((preset) => [preset.id, preset]),
);

export function presetById(id: string | null | undefined): ThemePreset | null {
  return id ? (PRESET_MAP[id] ?? null) : null;
}

/* --------------------------------------------------------------- validation */

const COLOR_KEYS = [
  "bg",
  "fg",
  "muted",
  "accent",
  "accent2",
  "border",
  "codeBg",
  "codeFg",
  "quoteBg",
  "quoteBorder",
  "tableHead",
  "tableLines",
  "mark",
  "scrim",
] as const;

const FONT_KEYS = ["font", "headingFont"] as const;

const SYNTAX_KEYS = [
  "keyword",
  "string",
  "number",
  "comment",
  "function",
  "type",
  "tag",
  "attr",
  "builtIn",
] as const;

const NAMED_COLORS = new Set([
  "transparent",
  "currentcolor",
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "orange",
  "purple",
  "pink",
  "gray",
  "grey",
  "silver",
  "maroon",
  "navy",
  "teal",
  "olive",
  "lime",
  "aqua",
  "cyan",
  "magenta",
  "fuchsia",
  "brown",
  "gold",
  "indigo",
  "violet",
  "coral",
  "salmon",
  "khaki",
  "beige",
  "ivory",
  "lavender",
  "turquoise",
  "crimson",
  "tomato",
  "chocolate",
  "plum",
  "orchid",
  "tan",
  "wheat",
  "azure",
]);

const DANGEROUS = /[;{}]|url\s*\(|var\s*\(|env\s*\(|expression|@import|image-set\s*\(/i;

function isSafeColor(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || DANGEROUS.test(text)) return false;
  if (/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text)) return true;
  if (/^(?:rgb|rgba|hsl|hsla)\([0-9.,%/\s+-]+\)$/i.test(text)) return true;
  return NAMED_COLORS.has(text.toLowerCase());
}

function isSafeGradient(value: string): boolean {
  const text = value.trim();
  if (!/^(?:linear|radial|conic)-gradient\(/i.test(text)) return false;
  if (DANGEROUS.test(text)) return false;
  return /^[-a-z0-9#%.,()\s/+]+$/i.test(text);
}

function isSafeBackground(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return isSafeColor(text) || isSafeGradient(text);
}

function isSafeFontFamily(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > 200 || DANGEROUS.test(text)) return false;
  if (/[()@]/.test(text)) return false;
  return /^[-a-z0-9 ,"'_]+$/i.test(text);
}

function isSafeFontFile(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.includes("..") || value.includes("\\")) return false;
  return /^[a-z0-9._/-]+\.(?:woff2|woff|ttf|otf)$/i.test(value);
}

function isSafeFamilyName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > 60) return false;
  return /^[-a-z0-9 _]+$/i.test(text);
}

function normalizeFonts(raw: unknown, warnings: string[]): ThemeFont[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    warnings.push("fonts: expected a list");
    return [];
  }
  const fonts: ThemeFont[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== "object") {
      warnings.push("fonts: invalid entry");
      continue;
    }
    const entry = item as Record<string, unknown>;
    if (!isSafeFamilyName(entry.family)) {
      warnings.push("fonts: invalid family");
      continue;
    }
    if (!isSafeFontFile(entry.file)) {
      warnings.push("fonts: invalid file");
      continue;
    }
    const font: ThemeFont = {
      family: String(entry.family).trim(),
      file: String(entry.file).trim(),
    };
    if (typeof entry.weight === "string" && /^(?:[1-9]00|normal|bold)$/.test(entry.weight)) {
      font.weight = entry.weight;
    }
    if (entry.style === "italic") font.style = "italic";
    fonts.push(font);
  }
  return fonts;
}

/* ------------------------------------------------------------------ resolve */

const VAR_NAMES: Record<string, string> = {
  bg: "--slide-bg",
  fg: "--slide-fg",
  muted: "--slide-muted",
  accent: "--slide-accent",
  accent2: "--slide-accent-2",
  border: "--slide-border",
  codeBg: "--slide-code-bg",
  codeFg: "--slide-code-fg",
  quoteBg: "--slide-quote-bg",
  quoteBorder: "--slide-quote-border",
  tableHead: "--slide-table-head",
  tableLines: "--slide-table-border",
  mark: "--slide-mark",
  scrim: "--slide-bg-scrim",
  font: "--slide-font",
  headingFont: "--slide-heading-font",
};

const SYNTAX_VARS: Record<string, string> = {
  keyword: "--hl-keyword",
  string: "--hl-string",
  number: "--hl-number",
  comment: "--hl-comment",
  function: "--hl-function",
  type: "--hl-type",
  tag: "--hl-tag",
  attr: "--hl-attr",
  builtIn: "--hl-built-in",
};

function varsFor(values: ThemeValues): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const key of COLOR_KEYS) vars[VAR_NAMES[key]] = values[key];
  for (const key of FONT_KEYS) vars[VAR_NAMES[key]] = values[key];
  vars["--slide-pad-x"] = `${values.padX}px`;
  vars["--slide-pad-y"] = `${values.padY}px`;
  vars["--slide-table-row-width"] = values.tableRowLines ? "1px" : "0px";
  vars["--slide-table-col-width"] = values.tableColumnLines ? "1px" : "0px";
  for (const key of SYNTAX_KEYS) {
    const varName = SYNTAX_VARS[key];
    const color = values.syntax[key as keyof ThemeSyntax];
    if (varName && color) vars[varName] = color;
  }
  return vars;
}

function resolvedTheme(
  base: ThemePreset,
  values: ThemeValues,
  presetId: string | null,
  name: string | null,
  fonts: ThemeFont[],
  warnings: string[],
  dark: boolean,
): ResolvedTheme {
  return {
    presetId,
    base: base.id,
    name,
    dark,
    values,
    vars: varsFor(values),
    fonts,
    warnings,
  };
}

/** Resolves the raw `theme` front matter value into CSS variables. */
export function resolveTheme(raw: unknown): ResolvedTheme {
  const warnings: string[] = [];

  if (typeof raw === "string") {
    const preset = PRESET_MAP[raw.trim()];
    if (!preset) {
      warnings.push(`Unknown theme "${raw}"`);
      return resolvedTheme(
        PRESET_MAP.light,
        PRESET_MAP.light.values,
        PRESET_MAP.light.id,
        null,
        [],
        warnings,
        PRESET_MAP.light.dark,
      );
    }
    return resolvedTheme(preset, preset.values, preset.id, null, [], warnings, preset.dark);
  }

  let base = PRESET_MAP.light;
  let spec: ThemeSpec = {};
  let name: string | null = null;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    spec = raw as ThemeSpec;
    if (typeof spec.base === "string" && spec.base.trim()) {
      const preset = PRESET_MAP[spec.base.trim()];
      if (preset) base = preset;
      else warnings.push(`Unknown base theme "${spec.base}"`);
    }
    if (typeof spec.name === "string" && spec.name.trim()) {
      name = spec.name.trim().slice(0, 80);
    }
  } else if (raw !== undefined && raw !== null) {
    warnings.push("theme: expected a preset name or a map");
  }

  const values: ThemeValues = { ...base.values, syntax: { ...base.values.syntax } };
  let custom = false;

  for (const key of COLOR_KEYS) {
    const value = spec[key];
    if (value === undefined) continue;
    const valid = key === "bg" ? isSafeBackground(value) : isSafeColor(value);
    if (!valid) {
      warnings.push(`${key}: invalid value`);
      continue;
    }
    values[key] = String(value).trim();
    custom = true;
  }

  // Table lines follow the border colour unless the theme overrides them.
  if (spec.tableLines === undefined || !isSafeColor(spec.tableLines)) {
    values.tableLines = values.border;
  }

  for (const key of FONT_KEYS) {
    const value = spec[key];
    if (value === undefined) continue;
    if (!isSafeFontFamily(value)) {
      warnings.push(`${key}: invalid value`);
      continue;
    }
    values[key] = String(value).trim();
    custom = true;
  }

  for (const key of ["padX", "padY"] as const) {
    const value = spec[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      warnings.push(`${key}: invalid value`);
      continue;
    }
    values[key] = Math.min(200, Math.max(0, Math.round(value)));
    custom = true;
  }

  for (const key of ["tableRowLines", "tableColumnLines"] as const) {
    const value = spec[key];
    if (value === undefined) continue;
    if (typeof value !== "boolean") {
      warnings.push(`${key}: invalid value`);
      continue;
    }
    values[key] = value;
    custom = true;
  }

  if (spec.syntax !== undefined && spec.syntax !== null) {
    if (typeof spec.syntax !== "object" || Array.isArray(spec.syntax)) {
      warnings.push("syntax: expected a map");
    } else {
      for (const key of SYNTAX_KEYS) {
        const value = (spec.syntax as Partial<ThemeSyntax>)[key];
        if (value === undefined) continue;
        if (!isSafeColor(value)) {
          warnings.push(`syntax.${key}: invalid value`);
          continue;
        }
        values.syntax[key] = String(value).trim();
        custom = true;
      }
    }
  }

  const fonts = normalizeFonts(spec.fonts, warnings);
  if (fonts.length > 0) custom = true;

  let dark = base.dark;
  if (typeof spec.dark === "boolean") {
    dark = spec.dark;
    custom = true;
  }

  return resolvedTheme(
    base,
    values,
    custom ? null : base.id,
    custom ? name : null,
    fonts,
    warnings,
    dark,
  );
}

/** True when the front matter theme defines values beyond `base` and `name`. */
export function hasThemeOverrides(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  return Object.keys(raw).some((key) => key !== "base" && key !== "name");
}

/** Builds a full spec from a resolved theme, for saving or writing the map. */
export function specFromResolved(
  theme: ResolvedTheme,
  options: { name?: string; fonts?: ThemeFont[] } = {},
): ThemeSpec {
  const spec: ThemeSpec = {
    ...(options.name ?? theme.name ? { name: options.name ?? theme.name ?? undefined } : {}),
    base: theme.base,
    ...theme.values,
    syntax: { ...theme.values.syntax },
  };
  const fonts = options.fonts ?? theme.fonts;
  if (fonts.length > 0) spec.fonts = fonts.map((font) => ({ ...font }));
  const baseDark = PRESET_MAP[theme.base]?.dark ?? false;
  if (theme.dark !== baseDark) spec.dark = theme.dark;
  return spec;
}

export function swatchFor(theme: ResolvedTheme): string {
  const bg = theme.values.bg;
  if (/gradient\(/i.test(bg)) return bg;
  return `linear-gradient(135deg, ${bg}, ${theme.values.accent})`;
}

export function defaultTheme(): ResolvedTheme {
  return resolveTheme(undefined);
}

/** `inter-display.woff2` → `Inter Display`. */
export function familyFromFileName(fileName: string): string {
  const base = fileName
    .split(/[\\/]/)
    .pop()
    ?.replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Custom";
  return base.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

/** Puts a bundled family in front of the existing stack, without duplicates. */
export function stackWithFamily(current: string, family: string): string {
  if (current.toLowerCase().includes(family.toLowerCase())) return current;
  const quoted = `"${family}"`;
  return current.trim() ? `${quoted}, ${current}` : `${quoted}, system-ui, sans-serif`;
}
