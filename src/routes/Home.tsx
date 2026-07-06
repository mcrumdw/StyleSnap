import { useCallback, useEffect, useRef, useState } from "react";
import type { TokenType } from "../contract/types";
import { AnchorsStep } from "../components/AnchorsStep";
import { Button } from "../components/Button";
import { CleanupStep } from "../components/CleanupStep";
import { CreateSystemDialog } from "../components/CreateSystemDialog";
import { EmptyState } from "../components/EmptyState";
import { ExportSection } from "../components/ExportSection";
import { GiveMeaningStep } from "../components/GiveMeaningStep";
import { ImportZone } from "../components/ImportZone";
import { MergeQueueStep } from "../components/MergeQueueStep";
import { StepBar } from "../components/StepBar";
import { SummaryStrip } from "../components/SummaryStrip";
import { SystemNotesPanel } from "../components/SystemNotesPanel";
import { SystemView, type FillInfo } from "../components/SystemView";
import { Toast } from "../components/Toast";
import { importLabel } from "../state/pool";
import type { PipelineStep } from "../state/pipeline";
import { usePool } from "../state/usePool";
import { useSessionViewModel } from "../state/useSessionViewModel";
import { furthestIncompleteStep, stepPageTitle, welcomeBackMessage } from "../state/pipeline";

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
    rejectCluster,
    createSystem,
    setStep,
    startOver,
  } = usePool();

  const vm = useSessionViewModel(pool);
  const hasTokens = pool.imports.length > 0;
  const step = vm.step;

  const [focusRoleId, setFocusRoleId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGuardrail, setShowGuardrail] = useState(false);
  const guardrailSeenRef = useRef(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [addTokenPreset, setAddTokenPreset] = useState<
    { tokenType: TokenType; role?: string } | undefined
  >();

  const goToStep = useCallback(
    (next: PipelineStep) => {
      setStep(next);
      setFocusRoleId(undefined);
    },
    [setStep],
  );

  const copyDesignMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(vm.designMd);
      setToast("design.md copied — paste it into your AI coding tool.");
    } catch {
      setToast("Couldn't reach the clipboard — use Copy in the export section below.");
    }
  }, [vm.designMd]);

  const totalValues = Object.keys(vm.resolvedAssignments).length;

  // Export guardrail (10b): informs ONCE about unreviewed automation, never blocks.
  const copyWithGuardrail = useCallback(() => {
    const unreviewed = vm.summary.proposedMerges;
    if (!guardrailSeenRef.current && (unreviewed > 0 || vm.summary.derivedCount > 0)) {
      guardrailSeenRef.current = true;
      setShowGuardrail(true);
      return;
    }
    void copyDesignMd();
  }, [vm.summary, copyDesignMd]);

  const handlePrimaryAction = useCallback(() => {
    switch (step) {
      case 1:
        goToStep(2);
        break;
      case 2:
        goToStep(3);
        break;
      case 3:
        goToStep(4);
        break;
      case 4:
        if (vm.created) {
          copyWithGuardrail();
        } else {
          setShowCreateDialog(true);
        }
        break;
    }
  }, [step, goToStep, vm.created, copyWithGuardrail]);

  const handleAssignRoleFromGap = useCallback(
    (role: string) => {
      goToStep(2);
      setFocusRoleId(role);
      requestAnimationFrame(() => {
        document.getElementById(`role-${role.replace(/\//g, "-")}`)?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
    },
    [goToStep],
  );

  // Keyboard: 1–4 = steps, Esc closes dialogs
  useEffect(() => {
    if (!hasTokens) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") goToStep(1);
      if (e.key === "2") goToStep(2);
      if (e.key === "3") goToStep(3);
      if (e.key === "4") goToStep(4);
      if (e.key === "Escape") {
        setShowCreateDialog(false);
        setShowGuardrail(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasTokens, goToStep]);

  const progress = {
    openClusters: vm.summary.proposedMerges,
    rolesMet: vm.checklist.requiredMet,
    rolesTotal: vm.checklist.requiredTotal,
    gaps: vm.gapCount,
    derivedCount: vm.summary.derivedCount,
    created: vm.created,
  };

  // Resume orientation (P9, derivation-first): a restored draft lands on the
  // complete system, never a work queue; the toast carries the counts.
  const resumeRef = useRef(hasTokens);
  useEffect(() => {
    if (!resumeRef.current) return;
    resumeRef.current = false;
    setStep(furthestIncompleteStep(progress));
    setToast(welcomeBackMessage(progress));
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
          <header className="flex w-full flex-col gap-1">
            <h1 className="font-heading text-page-title font-bold">{stepPageTitle(step)}</h1>
            <p className="text-base text-text-muted">
              {vm.total} token{vm.total === 1 ? "" : "s"} from{" "}
              {pool.imports.map((imp) => importLabel(imp.meta)).join(" + ")}. Auto-saved.
            </p>
          </header>

          <StepBar
            step={step}
            onStepChange={goToStep}
            projectName={vm.projectName}
            onProjectNameChange={setProjectName}
            progress={progress}
            onPrimaryAction={handlePrimaryAction}
          />

          <SummaryStrip
            proposedMerges={vm.summary.proposedMerges}
            anchorsPicked={vm.summary.anchorsPicked}
            derivedCount={vm.summary.derivedCount}
            onGoToStep={goToStep}
          />

          {step === 1 && (
            <MergeQueueStep
              queue={vm.mergeQueue}
              onAccept={mergeCluster}
              onReject={rejectCluster}
              onCelebrate={setToast}
              everything={
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
              }
            />
          )}

          {step === 2 && (
            <AnchorsStep
              anchors={vm.anchors}
              tokens={vm.exportInput.tokens}
              onSetAnchor={setAnchor}
            >
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

          {step === 3 && (
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
              onGoToGaps={() => handleAssignRoleFromGap("color/text/primary")}
            />
          )}

          {step === 4 && (
            <div className="flex w-full flex-col gap-8">
              <SystemNotesPanel notes={pool.systemNotes ?? {}} onChange={setNote} />
              {!vm.created && (
                <section className="flex flex-col gap-4 rounded-md border-2 border-dashed border-border-default bg-surface-page p-6">
                  <p className="text-caption text-text-muted">
                    Happy with the draft? Create your system to finalize — merges lock, exports
                    below become official.
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
            </div>
          )}

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
              unreviewedMerges={vm.summary.proposedMerges}
              derivedCount={vm.summary.derivedCount}
              totalValues={totalValues}
              onPreviewExport={() => {
                setShowCreateDialog(false);
                goToStep(4);
              }}
              onConfirm={() => {
                createSystem();
                setShowCreateDialog(false);
                goToStep(4);
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
                <h2 className="font-heading text-card-title font-medium">Quick check before you ship</h2>
                <p className="mt-2 text-caption text-text-primary">
                  {vm.summary.proposedMerges > 0 &&
                    `${vm.summary.proposedMerges} merge${vm.summary.proposedMerges === 1 ? "" : "s"} unreviewed · `}
                  {vm.summary.derivedCount} of {totalValues} values were made for you and not
                  hand-reviewed. They're all flagged in the export — ship anyway, or take the
                  two-minute tour?
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
                      goToStep(vm.summary.proposedMerges > 0 ? 1 : 3);
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
