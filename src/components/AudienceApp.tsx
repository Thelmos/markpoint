import { useCallback, useEffect, useMemo, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import type { AudienceInit } from "../lib/audience";
import {
  AUDIENCE_EXIT,
  AUDIENCE_INDEX,
  AUDIENCE_INIT,
  AUDIENCE_NAV,
  AUDIENCE_READY,
} from "../lib/audience";
import { normalizeAssetPath, type SrcResolver } from "../lib/markdown";
import { SlideView } from "./SlideView";
import { SlideViewport } from "./SlideViewport";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function send(event: string, payload?: unknown): void {
  void emit(event, payload).catch(() => undefined);
}

/**
 * Second window shown to the audience. It receives a rendered deck snapshot
 * from the editor window and only displays the current slide fullscreen.
 */
export function AudienceApp() {
  const [init, setInit] = useState<AudienceInit | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let unlistenInit: (() => void) | undefined;
    let unlistenIndex: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        unlistenInit = await listen<AudienceInit>(AUDIENCE_INIT, (event) => {
          setInit(event.payload);
          setIndex(event.payload.index);
        });
        unlistenIndex = await listen<number>(AUDIENCE_INDEX, (event) => {
          setIndex(event.payload);
        });
      } catch {
        /* running outside Tauri */
      }
      if (!cancelled) send(AUDIENCE_READY);
    })();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        send(AUDIENCE_EXIT);
      } else if (
        event.key === "ArrowRight" ||
        event.key === "ArrowDown" ||
        event.key === "PageDown" ||
        event.key === " " ||
        event.key === "Enter"
      ) {
        event.preventDefault();
        send(AUDIENCE_NAV, 1);
      } else if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowUp" ||
        event.key === "PageUp" ||
        event.key === "Backspace"
      ) {
        event.preventDefault();
        send(AUDIENCE_NAV, -1);
      } else if (event.key === "Home") {
        event.preventDefault();
        send(AUDIENCE_NAV, -100000);
      } else if (event.key === "End") {
        event.preventDefault();
        send(AUDIENCE_NAV, 100000);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      unlistenInit?.();
      unlistenIndex?.();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("audience-mode");
    return () => document.body.classList.remove("audience-mode");
  }, []);

  if (!init) return <div className="audience-waiting" aria-hidden="true" />;
  return <AudienceStage init={init} index={index} />;
}

function AudienceStage({ init, index }: { init: AudienceInit; index: number }) {
  const total = init.slides.length;
  const safeIndex = clamp(index, 0, Math.max(0, total - 1));
  const slide = init.slides[safeIndex];

  const byName = useMemo(() => {
    const map = new Map<string, string>();
    for (const [path, url] of Object.entries(init.assets)) {
      const name = path.split("/").pop();
      if (name && !map.has(name)) map.set(name, url);
    }
    return map;
  }, [init.assets]);

  const resolve = useCallback<SrcResolver>(
    (raw) => {
      const path = normalizeAssetPath(raw);
      if (/^(https?:|data:|blob:)/i.test(path)) return raw;
      return (
        init.assets[path] ??
        init.assets[`assets/${path}`] ??
        byName.get(path.split("/").pop() ?? "") ??
        raw
      );
    },
    [init.assets, byName],
  );

  useEffect(() => {
    document.title = init.title || "MarkPoint";
  }, [init.title]);

  if (!slide) return <div className="audience-waiting" />;

  return (
    <div
      className="audience-root"
      onClick={(event) => {
        const x = event.clientX;
        send(AUDIENCE_NAV, x < window.innerWidth * 0.2 ? -1 : 1);
      }}
    >
      <SlideViewport className="audience-viewport">
        <SlideView
          key={safeIndex}
          slide={slide}
          theme={init.theme}
          resolve={resolve}
          showPageNumber={init.paginate}
          pageNumber={safeIndex + 1}
          lazyDiagrams={false}
        />
      </SlideViewport>
    </div>
  );
}
