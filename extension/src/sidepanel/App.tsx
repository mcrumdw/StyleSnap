import { useEffect, useState, useCallback } from "react";
import type {
  PickerMessage,
  CapturedElement,
  ElementRole,
  StyleSnapExport,
} from "../shared/types";
import { ElementList } from "./ElementList";

export function App() {
  const [active, setActive] = useState(false);
  const [elements, setElements] = useState<CapturedElement[]>([]);
  const [pageUrl, setPageUrl] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Listen for captures + state changes from the content script.
  useEffect(() => {
    const handler = (msg: PickerMessage) => {
      if (msg.kind === "picker/captured") {
        setElements((prev) => [...prev, msg.element]);
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

  const removeElement = (id: string) =>
    setElements((prev) => prev.filter((el) => el.id !== id));

  const setRole = (id: string, role: ElementRole) =>
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, role } : el))
    );

  const clearAll = () => setElements([]);

  const tokenCount = elements.reduce((n, el) => n + el.tokens.length, 0);

  const copy = async () => {
    const payload: StyleSnapExport = {
      meta: {
        source: "browser-extension",
        exportedAt: new Date().toISOString(),
        pageUrl: pageUrl || undefined,
        version: "1.0",
      },
      elements,
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    flash(`Copied ${elements.length} elements — paste into StyleSnap`);
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
        {elements.length === 0 ? (
          <div className="empty">
            <p className="empty-title">Nothing picked yet</p>
            <p className="empty-sub">
              Start picking and click any element on the page.
            </p>
          </div>
        ) : (
          <ElementList
            elements={elements}
            onRemove={removeElement}
            onSetRole={setRole}
          />
        )}
      </main>

      <footer className="footer">
        <button
          className="primary"
          onClick={copy}
          disabled={elements.length === 0}
        >
          Copy to StyleSnap
          {elements.length > 0 && (
            <span className="badge-inline">
              {elements.length} el · {tokenCount} tk
            </span>
          )}
        </button>
        <button
          className="ghost"
          onClick={clearAll}
          disabled={elements.length === 0}
        >
          Clear all
        </button>
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
