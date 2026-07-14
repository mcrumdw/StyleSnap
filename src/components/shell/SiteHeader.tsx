import { Link } from "react-router-dom";
import { Wordmark } from "../Wordmark";

/** Landing / marketing pages — logo only, not sticky (footer handles session chrome). */
export function SiteHeader() {
  return (
    <header className="border-b-2 border-border-default bg-surface-page">
      <div className="mx-auto flex max-w-container items-center px-4 py-3 sm:px-6">
        <Link to="/" aria-label="StyleSnap home">
          <Wordmark />
        </Link>
      </div>
    </header>
  );
}
