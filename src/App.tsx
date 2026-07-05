import { Link, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Wordmark } from "./components/Wordmark";
import { Home } from "./routes/Home";
import { KitchenSink } from "./routes/KitchenSink";

export function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-toast focus:rounded-md focus:border-2 focus:border-border-default focus:bg-surface-card focus:px-4 focus:py-2 focus:font-medium focus:shadow-card"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-sticky border-b-2 border-border-default bg-surface-page">
        <div className="mx-auto flex h-btn-lg max-w-container items-center px-6">
          <Link to="/" aria-label="StyleSnap home">
            <Wordmark />
          </Link>
        </div>
      </header>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/kitchen-sink" element={<KitchenSink />} />
        </Routes>
      </ErrorBoundary>
    </>
  );
}
