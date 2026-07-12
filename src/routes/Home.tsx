import { Navigate, useNavigate } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ImportZone } from "../components/ImportZone";
import { DEFAULT_ROUTE } from "./AppShell";
import { useSession } from "../state/SessionProvider";

/** Landing — import a capture to begin. Restored drafts skip straight to the shell. */
export function Home() {
  const { hasTokens, pool, addImport } = useSession();
  const navigate = useNavigate();

  const describeFirst = !pool.adjectives?.length;

  if (hasTokens) {
    return <Navigate to={describeFirst ? "/describe" : DEFAULT_ROUTE} replace />;
  }

  const handleImport: typeof addImport = (data, notes) => {
    addImport(data, notes);
    navigate("/describe");
  };

  return (
    <main id="main" className="mx-auto flex w-full max-w-container flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-8">
      <EmptyState heading="Nothing snapped yet" message="Drop a capture to begin." />
      <ImportZone onImport={handleImport} />
    </main>
  );
}
