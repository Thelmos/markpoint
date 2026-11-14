import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./styles/app.css";
import "./styles/themes.css";
import "./styles/slides.css";
import "katex/dist/katex.min.css";
import App from "./App";
import { AudienceApp } from "./components/AudienceApp";

const params = new URLSearchParams(window.location.search);
const audienceByLabel = (() => {
  try {
    return isTauri() && getCurrentWebviewWindow().label.startsWith("audience");
  } catch {
    return false;
  }
})();
const isAudience = params.get("view") === "audience" || audienceByLabel;

createRoot(document.getElementById("root")!).render(
  isAudience ? <AudienceApp /> : <App />,
);
