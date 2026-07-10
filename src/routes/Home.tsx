import { useCallback, useEffect, useRef, useState } from "react";
import type { TokenType } from "../contract/types";
import { AnchorsStep } from "../components/AnchorsStep";
import { Button } from "../components/Button";
import { CleanupStep } from "../components/CleanupStep";
import { CreateSystemDialog } from "../components/CreateSystemDialog";
import { EmptyState } from "../components/EmptyState";
import { ExportSection } from "../components/ExportSection";
import { GapPanel } from "../components/GapPanel";
import { GiveMeaningStep } from "../components/GiveMeaningStep";
import { ImportZone } from "../components/ImportZone";
import { SystemNotesPanel } from "../components/SystemNotesPanel";
import { SystemView, type FillInfo } from "../components/SystemView";
import { Toast } from "../components/Toast";
import { importLabel } from "../state/pool";
import { usePool } from "../state/usePool";
import { useSessionViewModel } from "../state/useSessionViewModel";

/**
 * One page, no steps (user testing 2026-07-06): the auto-completed system IS
 * the app. Merges happen silently at import; fine-tuning (anchors, roles,
 * captured grid) lives in collapsible sections below the draft.
 */
export function Home() {
  const {
    pool,
    addImport,
    mergeCluster,
    unmerge,
    setName,
    assign,
    unassign,
    addManual,
    updateManual,
    removeManual,
    setProjectName,
    setNote,
    setAnchor,
    editDerivedValue,
    resetDerivedValue,
    setAccent,
    createSystem,
    startOver,
  } = usePool();

  const vm = useSessionViewModel(pool);
  const hasTokens = pool.imports.length > 0;

  const [focusRoleId, setFocusRoleId] = useState<string | undefined>();
  const [tuneOpen, setTuneOpen] = useState(false);
  const [capturedOpen, setCapturedOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGuardrail, setShowGuardrail] = useState(false);
  const guardrailSeenRef = useRef(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addTokenPreset, setAddTokenPreset] = useState<
    { tokenType: TokenType; role?: string } | undefined
  >();

  const copyDesignMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(vm.designMd);
      setToast("design.md copied — paste it into your AI coding tool.");
    } catch {
      setToast("Couldn't reach the clipboard — use Copy in the export section below.");
    }
  }, [vm.designMd]);

  const totalValues = Object.keys(vm.resolvedAssignments).length;

  // Export guardrail: informs ONCE about unreviewed automation, never blocks.
  const copyWithGuardrail = useCallback(() => {
    if (!guardrailSeenRef.current && vm.summary.derivedCount > 0) {
      guardrailSeenRef.current = true;
      setShowGuardrail(true);
      return;
    }
    void copyDesignMd();
  }, [vm.summary.derivedCount, copyDesignMd]);

  /** Open the fine-tune section and scroll a role slot into view. */
  const goToRole = useCallback((role: string) => {
    setTuneOpen(true);
    setFocusRoleId(role);
    requestAnimationFrame(() => {
      document.getElementById(`role-${role.replace(/\//g, "-")}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  const goToGaps = useCallback(() => {
    const firstGap = vm.checklist.items.find((i) => i.status === "gap");
    if (firstGap?.action?.role) {
      goToRole(firstGap.action.role);
      return;
    }
    document.getElementById("gaps-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (firstGap?.id === "manual-foundations") setNotesOpen(true);
  }, [vm.checklist.items, goToRole]);

  // Esc closes dialogs.
  useEffect(() => {
    if (!hasTokens) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowCreateDialog(false);
        setShowGuardrail(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasTokens]);

  // Resume orientation: a restored draft says hello with the state of things.
  const resumeRef = useRef(hasTokens);
  useEffect(() => {
    if (!resumeRef.current) return;
    resumeRef.current = false;
    setToast(
      vm.created
        ? "Welcome back — your system's ready. Ship it."
        : "Welcome back — your system is drafted and auto-saved.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on restore
  }, []);

  const fills: Record<string, FillInfo> = Object.fromEntries(
    vm.draftFills.map((f) => [
      f.role,
      { origin: f.origin, method: f.method, derivedFrom: f.derivedFrom },
    ]),
  );

  return (
    <main id="main" className="mx-auto flex max-w-container flex-col gap-8 px-6 py-8">
      {!hasTokens ? (
        <>
          <EmptyState heading="Nothing snapped yet" message="Drop a capture to begin." />
          <ImportZone onImport={addImport} />
        </>
      ) : (
        <>
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
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2">
                <span className="sr-only">Project name</span>
                <input
                  value={vm.projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  aria-label="Project name"
                  className="h-btn-sm w-48 rounded-sm border-2 border-border-default bg-surface-card px-2 text-caption text-text-primary"
                />
              </label>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => {
                  if (vm.created) copyWithGuardrail();
                  else setShowCreateDialog(true);
                }}
              >
                {vm.created ? "Copy design.md" : "Create System"}
              </Button>
            </div>
          </header>

          <SystemView
            tokens={vm.systemTokens}
            assignments={vm.resolvedAssignments}
            fills={fills}
            accent={vm.accent}
            accentHarmony={pool.accentChoice?.harmony}
            onAccentHarmony={(harmony) => setAccent({ harmony })}
            onAccentDismiss={() => setAccent({ dismissed: true })}
            onEditDerived={editDerivedValue}
            onResetDerived={resetDerivedValue}
            onGoToGaps={goToGaps}
          />

          {vm.gapCount > 0 && (
            <GapPanel
              checklist={vm.checklist}
              onAssignRole={goToRole}
              onAddToken={(preset) => {
                setAddTokenPreset(preset);
                setCapturedOpen(true);
              }}
              onOpenNotes={() => {
                setNotesOpen(true);
                requestAnimationFrame(() => {
                  document.getElementById("system-notes")?.scrollIntoView({ behavior: "smooth" });
                });
              }}
            />
          )}

          {/* Fine-tuning lives BELOW the finished draft — edit by intent. */}
          <section className="flex w-full flex-col gap-4 border-t-2 border-border-default pt-8">
            <button
              type="button"
              onClick={() => setTuneOpen((o) => !o)}
              aria-expanded={tuneOpen}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex flex-col">
                <h2 className="font-heading text-card-title font-bold">
                  Fine-tune — anchors & roles
                </h2>
                <span className="text-caption text-text-muted">
                  Swap the {vm.summary.anchorsPicked} anchors everything was built from, or
                  re-point any role.
                </span>
              </span>
              <span className="font-mono text-caption text-text-muted">{tuneOpen ? "▲" : "▼"}</span>
            </button>
            {tuneOpen && (
              <AnchorsStep anchors={vm.anchors} tokens={vm.exportInput.tokens} onSetAnchor={setAnchor}>
                <GiveMeaningStep
                  entries={vm.entries}
                  merges={pool.merges}
                  decisions={pool.decisions}
                  assignments={pool.assignments}
                  focusRoleId={focusRoleId}
                  onAssign={assign}
                  onUnassign={unassign}
                />
              </AnchorsStep>
            )}
          </section>

          <section className="flex w-full flex-col gap-4 border-t-2 border-border-default pt-8">
            <button
              type="button"
              onClick={() => setCapturedOpen((o) => !o)}
              aria-expanded={capturedOpen}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex flex-col">
                <h2 className="font-heading text-card-title font-bold">Captured tokens</h2>
                <span className="text-caption text-text-muted">
                  Everything from your capture — rename, un-merge, add or remove tokens.
                </span>
              </span>
              <span className="font-mono text-caption text-text-muted">
                {capturedOpen ? "▲" : "▼"}
              </span>
            </button>
            {capturedOpen && (
              <CleanupStep
                entries={vm.entries}
                merges={pool.merges}
                decisions={pool.decisions}
                assignments={pool.assignments}
                addTokenPreset={addTokenPreset}
                onAddTokenPresetConsumed={() => setAddTokenPreset(undefined)}
                onMergeCluster={mergeCluster}
                onUnmerge={unmerge}
                onSetName={setName}
                onAssign={assign}
                onUnassign={unassign}
                onAddManual={(token, role) => {
                  addManual(token, role);
                  if (addTokenPreset) setAddTokenPreset(undefined);
                }}
                onUpdateManual={updateManual}
                onRemoveManual={removeManual}
                locked={vm.created}
              />
            )}
          </section>

          <section
            id="system-notes"
            className="flex w-full flex-col gap-8 border-t-2 border-border-default pt-8"
          >
            <button
              type="button"
              onClick={() => setNotesOpen((o) => !o)}
              aria-expanded={notesOpen}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex flex-col">
                <h2 className="font-heading text-card-title font-bold">System notes</h2>
                <span className="text-caption text-text-muted">
                  Mood, motion, voice — optional, flagged in export when empty.
                </span>
              </span>
              <span className="font-mono text-caption text-text-muted">{notesOpen ? "▲" : "▼"}</span>
            </button>
            {notesOpen && <SystemNotesPanel notes={pool.systemNotes ?? {}} onChange={setNote} />}
            {!vm.created && (
              <section className="flex flex-col gap-4 rounded-md border-2 border-dashed border-border-default bg-surface-page p-6">
                <p className="text-caption text-text-muted">
                  Happy with the draft? Create your system to finalize — exports below become
                  official.
                </p>
                <Button variant="secondary" onClick={() => setShowCreateDialog(true)}>
                  Create System
                </Button>
              </section>
            )}
            <ExportSection
              projectName={vm.projectName}
              designMd={vm.designMd}
              exportInput={vm.exportInput}
              gapCount={vm.gapCount}
              onCopyDesignMd={copyWithGuardrail}
            />
          </section>

          <section className="flex w-full flex-col gap-4 border-t-2 border-border-default pt-8">
            <button
              type="button"
              onClick={() => setImportOpen((o) => !o)}
              className="flex w-full items-center justify-between text-left"
            >
              <h2 className="font-heading text-card-title font-bold">Import another capture</h2>
              <span className="font-mono text-caption text-text-muted">{importOpen ? "▲" : "▼"}</span>
            </button>
            {importOpen && (
              <>
                <ImportZone onImport={addImport} />
                <div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm("Start over? This clears every imported token.")) {
                        startOver();
                      }
                    }}
                  >
                    Start over
                  </Button>
                </div>
              </>
            )}
          </section>

          {showCreateDialog && (
            <CreateSystemDialog
              projectName={vm.projectName}
              reviewedCount={vm.exportInput.tokens.length}
              rawCount={vm.exportInput.rawTokenCount}
              mergeCount={vm.exportInput.mergeCount}
              checklist={vm.checklist}
              derivedCount={vm.summary.derivedCount}
              totalValues={totalValues}
              onConfirm={() => {
                createSystem();
                setShowCreateDialog(false);
                if (vm.checklist.complete) void copyDesignMd();
              }}
              onClose={() => setShowCreateDialog(false)}
            />
          )}

          {showGuardrail && (
            <div
              className="fixed inset-0 z-modal flex items-center justify-center bg-text-primary/50 p-6"
              onClick={() => setShowGuardrail(false)}
            >
              <div
                role="alertdialog"
                aria-modal="true"
                aria-label="Export check"
                className="w-full max-w-md rounded-lg border-2 border-border-default bg-surface-card p-6 shadow-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="font-heading text-card-title font-medium">
                  Quick check before you ship
                </h2>
                <p className="mt-2 text-caption text-text-primary">
                  {vm.summary.derivedCount} of {totalValues} values were filled in automatically
                  and not hand-reviewed. They're all flagged in the export — ship anyway, or take
                  a quick look?
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Button
                    onClick={() => {
                      setShowGuardrail(false);
                      void copyDesignMd();
                    }}
                  >
                    Export anyway
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowGuardrail(false);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Review first
                  </Button>
                </div>
              </div>
            </div>
          )}

          {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        </>
      )}
    </main>
  );
}
