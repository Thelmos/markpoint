import type { SlideLayout } from "../types";
import { SLIDE_LAYOUTS } from "../lib/slideLayout";
import { useT } from "../lib/i18n";

const LABEL_KEYS: Record<SlideLayout, string> = {
  section: "layoutSection",
  "content-1c": "layoutContent1c",
  "content-2c": "layoutContent2c",
};

interface LayoutPickerProps {
  value: SlideLayout | null;
  /** True when the slide has a directive with an unknown layout id. */
  invalid?: boolean;
  onChange: (layout: SlideLayout | null) => void;
}

/** Selects the layout of the active slide and writes its Markdown directive. */
export function LayoutPicker({ value, invalid = false, onChange }: LayoutPickerProps) {
  const t = useT();
  const current = invalid && !value ? "__invalid__" : (value ?? "");
  return (
    <label className="layout-picker" title={t("layoutTooltip")}>
      <span className="layout-picker-label">{t("layout")}</span>
      <select
        className="select layout-select"
        value={current}
        aria-label={t("layout")}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "__invalid__" ? null : next ? (next as SlideLayout) : null);
        }}
      >
        {invalid && !value ? (
          <option value="__invalid__" disabled>
            {t("layoutInvalidOption")}
          </option>
        ) : null}
        <option value="">{t("layoutNone")}</option>
        {SLIDE_LAYOUTS.map((layout) => (
          <option key={layout} value={layout}>
            {t(LABEL_KEYS[layout])}
          </option>
        ))}
      </select>
    </label>
  );
}
