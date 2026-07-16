import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { AdjectivePicker } from "../components/AdjectivePicker";
import { SystemNotesPanel } from "../components/SystemNotesPanel";
import { styleProfileFromFamily } from "../engine/style-profile";
import { FAMILY_PACKS } from "../engine/templates";
import { DEFAULT_ROUTE } from "./AppShell";
import { useSession } from "../state/SessionProvider";

/** FR-19b — system description, project name, and session management. */
export function Describe() {
  const { pool, vm, setNote, applyTemplate, setProjectName } = useSession();
  const navigate = useNavigate();

  const styleFamily = pool.styleFamily;
  const styleBadge = styleFamily
    ? FAMILY_PACKS.find((p) => p.family === styleFamily)?.badgeLabel
    : undefined;
  const styleProfile = styleFamily ? styleProfileFromFamily(styleFamily) : undefined;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-caption text-text-muted">
          Set the vibe first — your picks tune auto-filled type scale, secondary harmony, radius, and
          shadows. Captured values stay yours; only derived gaps feel the style. System notes appear
          in design.md for your AI agent; Figma export works without them.
        </p>
        <label className="flex w-full max-w-xs flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span className="font-mono text-caption text-text-muted">Project</span>
          <input
            value={vm.projectName}
            onChange={(e) => setProjectName(e.target.value)}
            aria-label="Project name"
            className="h-btn-sm w-full rounded-sm border-2 border-border-default bg-surface-card px-2 text-caption text-text-primary sm:w-48"
          />
        </label>
      </header>

      <section className="rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
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
