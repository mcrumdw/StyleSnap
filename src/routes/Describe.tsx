import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { AdjectivePicker } from "../components/AdjectivePicker";
import { PostCaptureWelcomeModal } from "../components/PostCaptureWelcomeModal";
import { SystemNotesPanel } from "../components/SystemNotesPanel";
import { InfoHint } from "../components/Tooltip";
import { styleProfileFromFamily } from "../engine/style-profile";
import { FAMILY_PACKS } from "../engine/templates";
import { DEFAULT_ROUTE } from "./AppShell";
import { useSession } from "../state/SessionProvider";

/** FR-19b — system description, project name, and session management. */
export function Describe() {
  const { pool, vm, setNote, applyTemplate, setProjectName } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const fromImport = Boolean(
    (location.state as { fromImport?: boolean } | null)?.fromImport,
  );
  const [welcomeOpen, setWelcomeOpen] = useState(fromImport);

  useEffect(() => {
    if (!fromImport) return;
    navigate(".", { replace: true, state: {} });
  }, [fromImport, navigate]);

  const latestImport = pool.imports[pool.imports.length - 1];
  const welcomeTokens = useMemo(
    () => latestImport?.tokens ?? [],
    [latestImport],
  );

  const styleFamily = pool.styleFamily;
  const styleBadge = styleFamily
    ? FAMILY_PACKS.find((p) => p.family === styleFamily)?.badgeLabel
    : undefined;
  const styleProfile = styleFamily ? styleProfileFromFamily(styleFamily) : undefined;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      {welcomeOpen && (
        <PostCaptureWelcomeModal
          tokens={welcomeTokens}
          meta={latestImport?.meta}
          onSetVibe={() => {
            setWelcomeOpen(false);
            requestAnimationFrame(() => {
              document.getElementById("vibe-picker")?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
            });
          }}
          onSkipToColors={() => {
            setWelcomeOpen(false);
            navigate(DEFAULT_ROUTE);
          }}
          onClose={() => setWelcomeOpen(false)}
        />
      )}

      <header className="flex flex-col gap-2">
        <label className="flex w-full max-w-xs flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-caption font-medium text-text-primary">Project Name</span>
          <input
            value={vm.projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Project name"
            className="h-btn-sm w-full rounded-sm border-2 border-border-default bg-surface-card px-2 text-caption text-text-primary sm:w-48"
          />
        </label>
        <p className="flex flex-wrap items-center gap-2 text-caption text-text-muted">
          Set the vibe — then continue to colors.
          <InfoHint
            label="Why vibe first?"
            content="Picks shape empty slots only — type scale, secondary, radius, shadows. Your captured colors stay. Notes go in design.md; Figma export works without them."
          />
        </p>
      </header>

      <section
        id="vibe-picker"
        className="scroll-mt-[calc(var(--session-mobile-nav-height,0px)+1rem)] rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card sm:p-6"
      >
        <AdjectivePicker
          tokens={vm.exportInput.tokens}
          anchors={vm.anchors}
          initial={pool.adjectives}
          onApply={applyTemplate}
          livePreview
        />
        {styleProfile && styleBadge && (
          <p className="mt-4 text-caption text-text-muted">
            Style bias: <span className="font-medium text-text-primary">{styleBadge}</span> — type
            ratio {styleProfile.typeRatio}, {styleProfile.harmony} secondary, radius ×
            {styleProfile.radiusScale}, {styleProfile.shadowStyle} shadows.
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button size="sm" onClick={() => navigate(DEFAULT_ROUTE)}>
            Continue to colors
          </Button>
        </div>
      </section>

      <SystemNotesPanel
        notes={pool.systemNotes ?? {}}
        noteSources={pool.noteSources}
        onChange={setNote}
      />
    </div>
  );
}
