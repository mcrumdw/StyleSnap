import { Navigate, Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SiteHeader } from "./components/shell/SiteHeader";
import { AppShell, DEFAULT_ROUTE } from "./routes/AppShell";
import { Describe } from "./routes/Describe";
import { Home } from "./routes/Home";
import { KitchenSink } from "./routes/KitchenSink";
import { TokenCategory } from "./routes/TokenCategory";
import { SessionProvider } from "./state/SessionProvider";

export function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 z-toast focus:rounded-md focus:border-2 focus:border-border-default focus:bg-surface-card focus:px-4 focus:py-2 focus:font-medium focus:shadow-card sm:left-6 sm:top-6"
      >
        Skip to content
      </a>
      <ErrorBoundary>
        <SessionProvider>
          <Routes>
            <Route
              path="/"
              element={
                <>
                  <SiteHeader />
                  <Home />
                </>
              }
            />
            <Route
              path="/kitchen-sink"
              element={
                <>
                  <SiteHeader />
                  <KitchenSink />
                </>
              }
            />
            <Route element={<AppShell />}>
              {/* No `index` here: it would shadow the explicit "/" Home route
                  (both match "/"), and with an empty pool AppShell's
                  !hasTokens redirect to "/" then loops into itself, rendering
                  a blank page. Home owns "/" and does the in-session redirect. */}
              <Route path="/system" element={<Navigate to={DEFAULT_ROUTE} replace />} />
              <Route path="/export" element={<Navigate to={DEFAULT_ROUTE} replace />} />
              <Route path="/describe" element={<Describe />} />
              <Route path="/tokens/:category" element={<TokenCategory />} />
            </Route>
          </Routes>
        </SessionProvider>
      </ErrorBoundary>
    </>
  );
}
