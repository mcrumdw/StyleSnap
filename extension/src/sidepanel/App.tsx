import { useEffect, useState, useCallback } from "react";
import type {
  PickerMessage,
  Capture,
  StyleSnapExport,
  StyleSnapToken,
  CaptureFoundations,
} from "../shared/types";
import { CaptureList } from "./CaptureList";
import { InfoHint } from "./InfoHint";

/** Production webtool — paste copied JSON here. */
const WEBAPP_URL = "https://stylesnap-lac.vercel.app";

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

  /** Prefer the browsing window the user was on — not an odd side-panel focus edge case. */
  const getTargetTab = useCallback(async () => {
    const [tab] =
      (await chrome.tabs.query({ active: true, lastFocusedWindow: true })) ?? [];
    if (tab?.id && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("chrome-extension://")) {
      return tab;
    }
    const [fallback] = await chrome.tabs.query({ active: true, currentWindow: true });
    return fallback?.id ? fallback : null;
  }, []);

  /** Inject picker if the page loaded before the extension (or script was killed). */
  const ensurePicker = useCallback(async (tabId: number): Promise<boolean> => {
    try {
      const pong = (await chrome.tabs.sendMessage(tabId, {
        kind: "picker/ping",
      } satisfies PickerMessage)) as PickerMessage | undefined;
      if (pong?.kind === "picker/pong") return true;
    } catch {
      /* not injected yet */
    }
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["src/content/picker.ts"],
      });
      // Brief pause so the listener is registered before the next message.
      await new Promise((r) => setTimeout(r, 50));
      const pong = (await chrome.tabs.sendMessage(tabId, {
        kind: "picker/ping",
      } satisfies PickerMessage)) as PickerMessage | undefined;
      return pong?.kind === "picker/pong";
    } catch {
      return false;
    }
  }, []);

  const sendToTab = useCallback(
    async (msg: PickerMessage) => {
      const tab = await getTargetTab();
      if (!tab?.id) {
        flash("No active page tab — open a website and try again.");
        return null;
      }
      const url = tab.url ?? "";
      if (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("https://chrome.google.com/webstore") ||
        url.startsWith("https://chromewebstore.google.com")
      ) {
        flash("Picking doesn't work on this page.");
        return null;
      }

      const ready = await ensurePicker(tab.id);
      if (!ready) {
        flash("Picking doesn't work on this page.");
        return null;
      }

      try {
        return await chrome.tabs.sendMessage(tab.id, msg);
      } catch {
        flash("Picking doesn't work on this page.");
        return null;
      }
    },
    [ensurePicker, getTargetTab],
  );

  const togglePick = useCallback(async () => {
    const next = !active;
    const res = await sendToTab({
      kind: "picker/setActive",
      active: next,
      patternMode,
    });
    if (res === null) {
      setActive(false);
      return;
    }
    setActive(next);
    if (next) {
      flash(
        patternMode
          ? "Picking with parent — click an element"
          : "Click an element on the page",
      );
    }
  }, [active, patternMode, sendToTab]);

  const togglePattern = useCallback(async () => {
    const next = !patternMode;
    const res = await sendToTab({ kind: "picker/setPatternMode", enabled: next });
    if (res === null) return;
    setPatternMode(next);
    flash(
      next
        ? "Include parent on — next picks also capture the parent"
        : "Include parent off",
    );
  }, [patternMode, sendToTab]);

  const scanFoundations = useCallback(async () => {
    const res = (await sendToTab({
      kind: "picker/scanFoundations",
    })) as PickerMessage | null;
    if (!res) return;
    if (res.kind === "picker/foundations") {
      setFoundations(res.foundations);
      let pageBgNote = "";
      if (res.tokens && res.tokens.length > 0) {
        const pageCap: Capture = {
          captureId: "cap-page-scan",
          source: "page surface (scan)",
          tokens: res.tokens,
        };
        setCaptures((prev) => {
          const without = prev.filter((c) => c.source !== "page surface (scan)");
          return [...without, withUniqueIds(without, pageCap)];
        });
        const bg = res.tokens.find((t) => t.type === "color");
        if (bg && bg.type === "color") pageBgNote = ` · page ${bg.value}`;
      }
      const bp = res.foundations.breakpointsPx?.length ?? 0;
      const motion = res.foundations.motion?.length ?? 0;
      const z = res.foundations.zIndex?.length ?? 0;
      flash(
        bp + motion + z > 0 || pageBgNote
          ? `Scanned — ${bp} breakpoints · ${motion} motion · ${z} z-index${pageBgNote}`
          : "No page foundations found on this page",
      );
      return;
    }
    flash("Scan failed — try Start picking once, then Scan page again.");
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
        <div className="toolbar-group">
          <label className="switch">
            <input
              type="checkbox"
              checked={patternMode}
              onChange={() => void togglePattern()}
              aria-label="Include parent"
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
            <span className="switch-label">Include parent</span>
          </label>
          <InfoHint
            label="What Include parent does"
            content="When you click an element, also capture its parent. That gives StyleSnap denser structure for component sketches."
          />
        </div>
        <div className="toolbar-group">
          <button className="btn btn-ghost btn-sm" onClick={scanFoundations}>
            Scan page
          </button>
          <InfoHint
            label="What Scan page does"
            content="Reads this page’s breakpoints, motion, z-index, and the main page background color. Adds the page fill to your capture so StyleSnap can seed surface/page."
          />
        </div>
        {foundations && (
          <span className="foundations-chip">
            {[
              foundations.breakpointsPx?.length
                ? `${foundations.breakpointsPx.length} bp`
                : null,
              foundations.motion?.length ? `${foundations.motion.length} motion` : null,
              foundations.zIndex?.length ? `z×${foundations.zIndex.length}` : null,
              "page bg",
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
              Start picking and click any element on the page. Turn on Include
              parent for denser sketches; Scan page for breakpoints, motion, and
              the page background color.
            </p>
          </div>
        ) : (
          <CaptureList captures={captures} onRemove={removeCapture} />
        )}
      </main>

      <footer className="footer">
        <div className="footer-actions">
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
        </div>
        <a
          className="webapp-link"
          href={WEBAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open StyleSnap web app
          <span className="webapp-link-arrow" aria-hidden="true">
            →
          </span>
        </a>
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
