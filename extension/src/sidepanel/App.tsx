import { useEffect, useState, useCallback } from "react";
import type {
  PickerMessage,
  StyleSnapToken,
  StyleSnapExport,
} from "../shared/types";
import { TokenList } from "./TokenList";

export function App() {
  const [active, setActive] = useState(false);
  const [tokens, setTokens] = useState<StyleSnapToken[]>([]);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Listen for captures + state changes from the content script.
  useEffect(() => {
    const handler = (msg: PickerMessage) => {
      if (msg.kind === "picker/captured") {
        setTokens((prev) => [...prev, ...msg.tokens]);
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
    setTimeout(() => setToast(null), 2200);
  };

  const togglePick = useCallback(async () => {
    const next = !active;
    setActive(next);
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs
        .sendMessage(tab.id, {
          kind: "picker/setActive",
          active: next,
        } as PickerMessage)
        .catch(() => flash("Picking doesn't work on this page."));
    }
  }, [active]);

  const remove = (id: string) =>
    setTokens((prev) => prev.filter((t) => t.id !== id));

  const clearAll = () => setTokens([]);

  const copy = async () => {
    const payload: StyleSnapExport = {
      meta: {
        source: "browser-extension",
        exportedAt: new Date().toISOString(),
        pageUrl: pageUrl || undefined,
        version: "1.0",
      },
      tokens,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    flash(`Copied ${tokens.length} tokens — paste into StyleSnap`);
  };

  return (
    <div className="app">
      <header className="header">
        <span className="wordmark">
          Style<span className="accent">Snap</span>
        </span>
        <button
          className={`toggle ${active ? "on" : ""}`}
          onClick={togglePick}
          aria-pressed={active}
        >
          {active ? "Picking… (Esc to stop)" : "Start picking"}
        </button>
      </header>

      <main className="body">
        {tokens.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nothing picked yet</p>
            <p className="empty-sub">
              Start picking and click anything on the page.
            </p>
          </div>
        ) : (
          <TokenList tokens={tokens} onRemove={remove} />
        )}
      </main>

      <footer className="footer">
        <button
          className="primary"
          onClick={copy}
          disabled={tokens.length === 0}
        >
          Copy to StyleSnap
        </button>
        <button
          className="ghost"
          onClick={clearAll}
          disabled={tokens.length === 0}
        >
          Clear all
        </button>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
