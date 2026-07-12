import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { GapPanel } from "../components/GapPanel";
import { ImportZone } from "../components/ImportZone";
import { SystemView, type FillInfo } from "../components/SystemView";
import { importLabel } from "../state/pool";
import { useSession } from "../state/SessionProvider";
import { routeForAddToken, routeForRole } from "./nav";

/** The auto-completed draft — the first thing you see after import. */
export function SystemOverview() {
  const navigate = useNavigate();
  const {
    pool,
    vm,
    addImport,
    startOver,
    setProjectName,
    setAccent,
    editWithUndoToast,
    resetDerivedValue,
    setToast,
  } = useSession();

  const resumeRef = useRef(true);

  useEffect(() => {
    if (!resumeRef.current) return;
    resumeRef.current = false;
    setToast(
      vm.created
        ? "Welcome back — your system's ready. Ship it."
        : "Welcome back — your system is drafted and auto-saved.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const fills: Record<string, FillInfo> = Object.fromEntries(
    vm.draftFills.map((f) => [
      f.role,
      { origin: f.origin, method: f.method, derivedFrom: f.derivedFrom },
    ]),
  );

  const goToRole = (role: string) => navigate(routeForRole(role));

  const goToGaps = () => {
    const firstGap = vm.checklist.items.find((i) => i.status === "gap");
    if (firstGap?.action?.role) {
      goToRole(firstGap.action.role);
      return;
    }
    if (firstGap?.id === "manual-foundations") {
      navigate("/describe");
      return;
    }
    document.getElementById("gaps-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-8">
      <header className="flex w-full flex-col gap-2">
        <h1 className="font-heading text-page-title font-bold">Your system</h1>
        <p className="text-base text-text-muted">
          {vm.total} token{vm.total === 1 ? "" : "s"} from{" "}
          {pool.imports.map((imp) => importLabel(imp.meta)).join(" + ")} —{" "}
          {vm.summary.derivedCount > 0
            ? `${vm.summary.derivedCount} value${vm.summary.derivedCount === 1 ? "" : "s"} filled in automatically. `
            : ""}
          Auto-saved.
        </p>
        <label className="flex items-center gap-2">
          <span className="sr-only">Project name</span>
          <input
            value={vm.projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Project name"
            className="h-btn-sm w-48 rounded-sm border-2 border-border-default bg-surface-card px-2 text-caption text-text-primary"
          />
        </label>
      </header>

      <SystemView
        tokens={vm.systemTokens}
        assignments={vm.resolvedAssignments}
        fills={fills}
        accent={vm.accent}
        accentHarmony={pool.accentChoice?.harmony}
        onAccentHarmony={(harmony) => setAccent({ harmony })}
        onAccentDismiss={() => setAccent({ dismissed: true })}
        onEditDerived={editWithUndoToast}
        onResetDerived={resetDerivedValue}
        onGoToGaps={goToGaps}
      />

      {vm.gapCount > 0 && (
        <div id="gaps-section">
          <GapPanel
            checklist={vm.checklist}
            onAssignRole={goToRole}
            onAddToken={(preset) => {
              const { pathname, state } = routeForAddToken(preset);
              navigate(pathname, { state });
            }}
            onOpenNotes={() => navigate("/describe")}
          />
        </div>
      )}

      <section className="flex flex-col gap-4 border-t-2 border-border-default pt-8">
        <h2 className="font-heading text-card-title font-bold">Import another capture</h2>
        <ImportZone onImport={addImport} />
        <Button
          variant="destructive"
          onClick={() => {
            if (window.confirm("Start over? This clears every imported token.")) startOver();
          }}
        >
          Start over
        </Button>
      </section>
    </div>
  );
}
