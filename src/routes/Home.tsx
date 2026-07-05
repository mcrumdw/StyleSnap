import { useCallback, useEffect, useState } from "react";
import type { TokenType } from "../contract/types";
import { Button } from "../components/Button";
import { CreateSystemDialog } from "../components/CreateSystemDialog";
import { EmptyState } from "../components/EmptyState";
import { ExportDrawer } from "../components/ExportDrawer";
import { GapDrawer } from "../components/GapDrawer";
import { ImportZone } from "../components/ImportZone";
import { SessionBar, type SessionView } from "../components/SessionBar";
import { SystemView } from "../components/SystemView";
import { Toast } from "../components/Toast";
import { Workspace, type EditSubTab } from "../components/Workspace";
import { importLabel } from "../state/pool";
import { usePool } from "../state/usePool";
import { useSessionViewModel } from "../state/useSessionViewModel";

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
    createSystem,
    startOver,
  } = usePool();

  const vm = useSessionViewModel(pool);
  const hasTokens = pool.imports.length > 0;

  const [view, setView] = useState<SessionView>("edit");
  const [editSubTab, setEditSubTab] = useState<EditSubTab>("captured");
  const [focusRoleId, setFocusRoleId] = useState<string | undefined>();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showGapDrawer, setShowGapDrawer] = useState(false);
  const [showExportDrawer, setShowExportDrawer] = useState(false);
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
      setToast("Couldn't reach the clipboard — open Export… instead.");
    }
  }, [vm.designMd]);

  const handleAssignRoleFromGap = useCallback((role: string) => {
    setShowGapDrawer(false);
    setView("edit");
    setEditSubTab("roles");
    setFocusRoleId(role);
    requestAnimationFrame(() => {
      document.getElementById(`role-${role.replace(/\//g, "-")}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  const handleAddTokenFromGap = useCallback(
    (preset: { tokenType: TokenType; role?: string }) => {
      setShowGapDrawer(false);
      setView("edit");
      setEditSubTab("captured");
      setAddTokenPreset(preset);
    },
    [],
  );

  // Keyboard: 1 = Edit, 2 = System (when session active)
  useEffect(() => {
    if (!hasTokens) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "1") setView("edit");
      if (e.key === "2") setView("system");
      if (e.key === "Escape") {
        setShowGapDrawer(false);
        setShowExportDrawer(false);
        setShowCreateDialog(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasTokens]);

  const pageTitle =
    view === "edit"
      ? editSubTab === "roles"
        ? "Edit — assign roles"
        : editSubTab === "captured"
          ? "Edit — captured primitives"
          : "Edit — all tokens"
      : "System — review your design system";

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
            <h1 className="font-heading text-page-title font-bold">{pageTitle}</h1>
            <p className="text-base text-text-muted">
              {vm.total} token{vm.total === 1 ? "" : "s"} from{" "}
              {pool.imports.map((imp) => importLabel(imp.meta)).join(" + ")}. Auto-saved.
            </p>
          </header>

          <SessionBar
            view={view}
            onViewChange={setView}
            projectName={vm.projectName}
            onProjectNameChange={setProjectName}
            checklist={vm.checklist}
            gapCount={vm.gapCount}
            created={vm.created}
            onOpenGaps={() => setShowGapDrawer(true)}
            onCreateSystem={() => setShowCreateDialog(true)}
            onCopyDesignMd={() => void copyDesignMd()}
            onOpenExport={() => setShowExportDrawer(true)}
          />

          {view === "edit" ? (
            <Workspace
              entries={vm.entries}
              merges={pool.merges}
              decisions={pool.decisions}
              assignments={pool.assignments}
              editSubTab={editSubTab}
              onEditSubTabChange={(tab) => {
                setEditSubTab(tab);
                setFocusRoleId(undefined);
              }}
              focusRoleId={focusRoleId}
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
          ) : (
            <SystemView
              tokens={vm.systemTokens}
              assignments={vm.resolvedAssignments}
              onOpenGaps={() => setShowGapDrawer(true)}
            />
          )}

          {/* Collapsed import — expand on demand */}
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

          {showGapDrawer && (
            <GapDrawer
              checklist={vm.checklist}
              onClose={() => setShowGapDrawer(false)}
              onAssignRole={handleAssignRoleFromGap}
              onAddToken={handleAddTokenFromGap}
            />
          )}

          {showExportDrawer && (
            <ExportDrawer
              projectName={vm.projectName}
              designMd={vm.designMd}
              exportInput={vm.exportInput}
              gapCount={vm.gapCount}
              onClose={() => setShowExportDrawer(false)}
            />
          )}

          {showCreateDialog && (
            <CreateSystemDialog
              projectName={vm.projectName}
              reviewedCount={vm.exportInput.tokens.length}
              rawCount={vm.exportInput.rawTokenCount}
              mergeCount={vm.exportInput.mergeCount}
              checklist={vm.checklist}
              onPreviewExport={() => {
                setShowCreateDialog(false);
                setShowExportDrawer(true);
              }}
              onConfirm={() => {
                createSystem();
                setShowCreateDialog(false);
                if (vm.checklist.complete) void copyDesignMd();
              }}
              onClose={() => setShowCreateDialog(false)}
            />
          )}

          {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
        </>
      )}
    </main>
  );
}
