import { useEffect, useState, useCallback } from "react";
import type {
  PickerMessage,
  Capture,
  StyleSnapExport,
  StyleSnapToken,
  CaptureFoundations,
} from "../shared/types";
import { CaptureList } from "./CaptureList";

/** Sequential ids owned by the side panel — survives page navigations. */
const nextExtId = (n: number) => `ext_${String(n).padStart(3, "0")}`;

/**
 * Content-script counters reset on every page load, but the panel keeps prior
 * captures. Remap ids + captureId here so a multi-site session never exports
 * colliding ext_001… ids (webtool FR-2 rejects those).
 */
function withUniqueIds(prev: Capture[], incoming: Capture): Capture {
  let i = prev.reduce((n, c) => n + c.tokens.length, 0);
  const captureId = `cap-${prev.length + 1}`;
  const tokens: StyleSnapToken[] = incoming.tokens.map((t) => ({
    ...t,
    id: nextExtId(++i),
    captureId,
  }));
  return { ...incoming, captureId, tokens };
}

export function App() {
  const [active, setActive] = useState(false);
  const [patternMode, setPatternMode] = useState(false);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [foundations, setFoundations] = useState<CaptureFoundations | undefined>();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const handler = (msg: PickerMessage) => {
      if (msg.kind === "picker/captured") {
        setCaptures((prev) => [...prev, withUniqueIds(prev, msg.capture)]);
        setPageUrl(msg.pageUrl);
      } else if (msg.kind === "picker/state") {
        setActive(msg.active);
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 2600);
  };

  const sendToTab = useCallback(async (msg: PickerMessage) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    try {
      return await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      flash("Picking doesn't work on this page.");
      return null;
    }
  }, []);

  const togglePick = useCallback(async () => {
    const next = !active;
    setActive(next);
    await sendToTab({
      kind: "picker/setActive",
      active: next,
      patternMode,
    });
  }, [active, patternMode, sendToTab]);

  const togglePattern = useCallback(async () => {
    const next = !patternMode;
    setPatternMode(next);
    await sendToTab({ kind: "picker/setPatternMode", enabled: next });
  }, [patternMode, sendToTab]);

  const scanFoundations = useCallback(async () => {
    const res = (await sendToTab({
      kind: "picker/scanFoundations",
    })) as PickerMessage | null;
    if (res && res.kind === "picker/foundations") {
      setFoundations(res.foundations);
      const n =
        (res.foundations.breakpointsPx?.length ?? 0) +
        (res.foundations.motion?.length ?? 0) +
        (res.foundations.zIndex?.length ?? 0);
      flash(
        n > 0
          ? `Scanned foundations — ${res.foundations.breakpointsPx?.length ?? 0} breakpoints`
          : "No page foundations found",
      );
    }
  }, [sendToTab]);

  const removeCapture = (captureId: string) =>
    setCaptures((prev) => prev.filter((c) => c.captureId !== captureId));

  const clearAll = () => {
    setCaptures([]);
    setFoundations(undefined);
  };

  const tokens = captures.flatMap((c) => c.tokens);
  const tokenCount = tokens.length;

  const copy = async () => {
    const payload: StyleSnapExport = {
      meta: {
        source: "browser-extension",
        exportedAt: new Date().toISOString(),
        pageUrl: pageUrl || undefined,
        version: "2.1",
        foundations,
      },
      tokens,
    };

    const invalid = payload.tokens.find(
      (t) => !t.id || !t.captureId || !t.type,
    );
    if (payload.tokens.length === 0 || invalid) {
      flash("Nothing valid to export");
      return;
    }

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    flash(`Copied ${tokenCount} tokens — paste into StyleSnap`);
  };

  return (
    <div className="app">
      <header className="header">
        <span className="wordmark">
          Style<span className="accent">Snap</span>
        </span>
        <button
          className={`btn btn-secondary toggle ${active ? "on" : ""}`}
          onClick={togglePick}
          aria-pressed={active}
        >
          {active ? "Picking… (Esc to stop)" : "Start picking"}
        </button>
      </header>

      <div className="toolbar">
        <button
          className={`btn btn-ghost btn-sm ${patternMode ? "on" : ""}`}
          onClick={togglePattern}
          aria-pressed={patternMode}
          title="Also capture the parent element for denser component sketches"
        >
          Pattern pick
        </button>
        <button className="btn btn-ghost btn-sm" onClick={scanFoundations}>
          Scan page
        </button>
        {foundations && (
          <span className="foundations-chip">
            {[
              foundations.breakpointsPx?.length
                ? `${foundations.breakpointsPx.length} bp`
                : null,
              foundations.motion?.length ? `${foundations.motion.length} motion` : null,
              foundations.zIndex?.length ? `z×${foundations.zIndex.length}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "scanned"}
          </span>
        )}
      </div>

      <main className="body">
        {captures.length === 0 ? (
          <div className="empty">
            <h2 className="empty-title">Nothing snapped yet</h2>
            <p className="empty-sub">
              Start picking and click any element on the page. Scan page for
              breakpoints and motion.
            </p>
          </div>
        ) : (
          <CaptureList captures={captures} onRemove={removeCapture} />
        )}
      </main>

      <footer className="footer">
        <button
          className="btn btn-primary"
          onClick={copy}
          disabled={captures.length === 0}
        >
          Copy to StyleSnap
          {captures.length > 0 && (
            <span className="badge-inline">
              {captures.length} el · {tokenCount} tk
            </span>
          )}
        </button>
        <button
          className="btn btn-ghost"
          onClick={clearAll}
          disabled={captures.length === 0 && !foundations}
        >
          Clear all
        </button>
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
