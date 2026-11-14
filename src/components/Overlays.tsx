import { Icon } from "./Icons";

export interface ToastItem {
  id: number;
  text: string;
  kind: "info" | "success" | "error";
}

export function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`toast ${item.kind}`}>
          <Icon name={item.kind === "error" ? "alert" : item.kind === "success" ? "check" : "message"} size={15} />
          <span>{item.text}</span>
        </div>
      ))}
    </div>
  );
}

export function BusyOverlay({ label }: { label: string }) {
  return (
    <div className="busy-overlay">
      <div className="busy-card">
        <span className="spinner" />
        <span>{label}</span>
      </div>
    </div>
  );
}
