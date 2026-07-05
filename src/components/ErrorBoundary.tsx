import { Component, type ReactNode } from "react";
import { DRAFT_STORAGE_KEY } from "../state/pool";
import { Button } from "./Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * DESIGN.md §6 — errors are never a dead end. If rendering ever throws, offer
 * a reload (the localStorage draft restores the session, FR-29) and, as the
 * last resort, a start-over that clears a potentially poisoned draft.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="mx-auto flex max-w-container flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="font-heading text-page-title font-bold">Something snapped — the wrong way.</h1>
        <p className="max-w-xl text-base text-text-muted">
          The app hit an unexpected error. Your work is auto-saved, so reloading should put you
          right back where you were.
        </p>
        <p className="max-w-xl font-mono text-caption text-text-muted">{this.state.error.message}</p>
        <div className="flex gap-4">
          <Button onClick={() => window.location.reload()}>Reload — restore my session</Button>
          <Button
            variant="destructive"
            onClick={() => {
              try {
                window.localStorage.removeItem(DRAFT_STORAGE_KEY);
              } catch {
                // storage unavailable — reload alone will have to do
              }
              window.location.reload();
            }}
          >
            Start fresh
          </Button>
        </div>
      </main>
    );
  }
}
