import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { StyleSnapToken, TokenType } from "../contract/types";
import { AddTokenDialog } from "../components/AddTokenDialog";
import { Button } from "../components/Button";
import { AnchorsStep } from "../components/AnchorsStep";
import { CapturedFonts } from "../components/CapturedFonts";
import { TypeAnchorStep } from "../components/TypeAnchorStep";
import { GapPanel } from "../components/GapPanel";
import { GiveMeaningStep } from "../components/GiveMeaningStep";
import { isTokenCategory } from "../components/shell/SideNav";
import { DEFAULT_ROUTE } from "./AppShell";
import { useSession } from "../state/SessionProvider";
import { resolveAssignments } from "../state/pool";
import { routeForAddToken, routeForRole } from "./nav";

import type { TokenCategory } from "../components/shell/SideNav";

const ROLE_PREFIX: Record<
  Exclude<TokenCategory, "colors">,
  "type/" | "space/" | "radius/" | "border-width/" | "shadow/"
> = {
  typography: "type/",
  spacing: "space/",
  radius: "radius/",
  borders: "border-width/",
  effects: "shadow/",
};

const CATEGORY_TITLES: Record<TokenCategory, string> = {
  colors: "Colors",
  typography: "Typography",
  spacing: "Spacing",
  radius: "Radius",
  borders: "Borders",
  effects: "Effects",
};

type AddTokenPreset = { tokenType: TokenType; role?: string };

/** Which token type a category's custom "Add a value" creates. */
const CATEGORY_TOKEN_TYPE: Record<TokenCategory, TokenType> = {
  colors: "color",
  typography: "typography",
  spacing: "spacing",
  radius: "border-radius",
  borders: "border-width",
  effects: "shadow",
};

function manualValueLabel(t: StyleSnapToken): string {
  switch (t.type) {
    case "color":
      return t.value + (t.opacity < 1 ? ` @ ${Math.round(t.opacity * 100)}%` : "");
    case "typography":
      return `${t.value.fontFamily} ${t.value.fontSize}/${t.value.lineHeight}`;
    case "spacing":
    case "border-radius":
    case "border-width":
      return `${t.value}px`;
    default:
      return t.name ?? t.id;
  }
}

/** One token category per route — anchors are edited on Colors. */
export function TokenCategory() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const focusRoleId = searchParams.get("focus") ?? undefined;

  const { pool, vm, setAnchor, assign, unassign, addManual, removeManual, editWithUndoToast, resetDerivedValue, setAccent, setToast } =
    useSession();

  const secondaryFill = vm.draftFills.find((f) => f.role === "color/action/secondary");

  const fills = useMemo(
    () =>
      Object.fromEntries(
        vm.draftFills.map((f) => [
          f.role,
          { origin: f.origin, method: f.method, derivedFrom: f.derivedFrom },
        ]),
      ),
    [vm.draftFills],
  );

  const userAssignments = useMemo(
    () => resolveAssignments(pool.assignments, pool.merges),
    [pool.assignments, pool.merges],
  );

  const handleEditDerived = editWithUndoToast;

  const locationPreset = (location.state as { addTokenPreset?: AddTokenPreset } | null)
    ?.addTokenPreset;
  const [addTokenPreset, setAddTokenPreset] = useState<AddTokenPreset | undefined>(locationPreset);
  const resumeRef = useRef(category === "colors");

  useEffect(() => {
    if (locationPreset) setAddTokenPreset(locationPreset);
  }, [locationPreset]);

  useEffect(() => {
    if (!resumeRef.current) return;
    resumeRef.current = false;
    setToast(
      vm.created
        ? "Welcome back — your system's ready. Ship it."
        : "Welcome back — your system is drafted and auto-saved.",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on first Colors visit
  }, []);

  useEffect(() => {
    if (!focusRoleId) return;
    requestAnimationFrame(() => {
      document.getElementById(`role-${focusRoleId.replace(/\//g, "-")}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, [focusRoleId, category]);

  const rolePrefix = useMemo((): (typeof ROLE_PREFIX)[Exclude<TokenCategory, "colors">] | undefined => {
    if (!category || category === "colors") return undefined;
    return ROLE_PREFIX[category as Exclude<TokenCategory, "colors">];
  }, [category]);

  // Legacy routes from the old shell.
  if (category === "anchors" || category === "captured") {
    return <Navigate to={DEFAULT_ROUTE} replace />;
  }
  if (category === "shadows") {
    return <Navigate to={`/tokens/effects${location.search}`} replace />;
  }

  if (!isTokenCategory(category)) return <Navigate to={DEFAULT_ROUTE} replace />;

  const title = CATEGORY_TITLES[category];
  const categoryType = CATEGORY_TOKEN_TYPE[category];
  // Custom values you added (not from a capture) — the free "ceiling" on top of
  // the required roles. Effects/shadows aren't manually addable via the dialog.
  const canAddValue = category !== "effects";
  const manualTokens = (pool.manual ?? []).filter((t) => t.type === categoryType);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-section-header font-bold sm:text-page-title">{title}</h1>
        {category === "colors" && (
          <p className="text-caption text-text-muted">
            Your primary and secondary colors — then every color role in the system.
          </p>
        )}
        {category === "typography" && (
          <p className="text-caption text-text-muted">
            Your text style anchor — then assign every type role in the system.
          </p>
        )}
        {category === "spacing" && (
          <p className="text-caption text-text-muted">
            Gaps and padding between elements — preview shows how much space this value adds.
          </p>
        )}
        {category === "radius" && (
          <p className="text-caption text-text-muted">
            Corner rounding on cards, buttons, and inputs — preview shows the curve on a square.
          </p>
        )}
        {category === "borders" && (
          <p className="text-caption text-text-muted">
            Stroke thickness for outlines and dividers — preview shows the border on a card.
          </p>
        )}
        {category === "effects" && (
          <p className="text-caption text-text-muted">
            Elevation and depth — drop shadows, inner shadows, and (when captured) blur and similar
            treatments. One effect can fill several roles.
          </p>
        )}
        {rolePrefix && category !== "typography" && category !== "effects" && (
          <p className="text-caption text-text-muted">
            Assign semantic roles for this category. One primitive can fill several roles.
          </p>
        )}
      </header>

      {canAddValue && (
        <section className="flex flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
                Your values
              </h4>
              <p className="text-badge text-text-muted">
                Add as many custom values as you like — required roles stay filled either way.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setAddTokenPreset({ tokenType: categoryType })}
            >
              + Add a value
            </Button>
          </div>
          {manualTokens.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {manualTokens.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2 rounded-sm border-2 border-border-default bg-surface-page px-2 py-1"
                >
                  {t.type === "color" && (
                    <span
                      className="h-4 w-4 rounded-sm border border-border-default"
                      style={{ backgroundColor: t.value }}
                      aria-hidden
                    />
                  )}
                  <span className="font-mono text-badge text-text-primary">
                    {manualValueLabel(t)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      removeManual(t.id);
                      setToast("Value removed.");
                    }}
                    aria-label={`Remove ${manualValueLabel(t)}`}
                    className="font-mono text-caption leading-none text-text-muted hover:text-error"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {category === "colors" && (
        <>
          <AnchorsStep
            anchors={vm.anchors}
            tokens={vm.exportInput.tokens}
            accent={vm.accent}
            accentHarmony={pool.accentChoice?.harmony}
            onSetAnchor={setAnchor}
            secondaryToken={secondaryFill?.token}
            secondaryOrigin={secondaryFill?.origin}
            onAccentHarmony={(harmony) => setAccent({ harmony })}
            onEditSecondary={(token) => handleEditDerived("color/action/secondary", token)}
            onResetSecondary={() => resetDerivedValue("color/action/secondary")}
          />
          <GiveMeaningStep
            entries={vm.entries}
            merges={pool.merges}
            decisions={pool.decisions}
            assignments={vm.resolvedAssignments}
            systemTokens={vm.systemTokens}
            draftFills={vm.draftFills}
            roleDisplayTokens={vm.roleDisplayTokens}
            fills={fills}
            focusRoleId={focusRoleId}
            rolePrefix="color/"
            onAssign={assign}
            onUnassign={unassign}
            userAssignments={userAssignments}
            onEditDerived={handleEditDerived}
            onResetDerived={resetDerivedValue}
          />
          {vm.gapCount > 0 && (
            <GapPanel
              checklist={vm.checklist}
              onAssignRole={(role) => navigate(routeForRole(role))}
              onAddToken={(preset) => {
                const { pathname, state } = routeForAddToken(preset);
                navigate(pathname, { state });
              }}
              onOpenNotes={() => navigate("/describe")}
            />
          )}
        </>
      )}

      {category === "typography" && (
        <>
          <TypeAnchorStep
            anchors={vm.anchors}
            tokens={vm.exportInput.tokens}
            onSetAnchor={setAnchor}
          />
          <CapturedFonts
            tokens={vm.exportInput.tokens}
            assignments={vm.resolvedAssignments}
            onAssign={assign}
          />
          <GiveMeaningStep
            entries={vm.entries}
            merges={pool.merges}
            decisions={pool.decisions}
            assignments={vm.resolvedAssignments}
            systemTokens={vm.systemTokens}
            draftFills={vm.draftFills}
            roleDisplayTokens={vm.roleDisplayTokens}
            fills={fills}
            focusRoleId={focusRoleId}
            rolePrefix="type/"
            onAssign={assign}
            onUnassign={unassign}
            userAssignments={userAssignments}
            onEditDerived={handleEditDerived}
            onResetDerived={resetDerivedValue}
          />
        </>
      )}

      {rolePrefix && category !== "typography" && (
        <GiveMeaningStep
          entries={vm.entries}
          merges={pool.merges}
          decisions={pool.decisions}
          assignments={vm.resolvedAssignments}
          systemTokens={vm.systemTokens}
          draftFills={vm.draftFills}
          roleDisplayTokens={vm.roleDisplayTokens}
          fills={fills}
          focusRoleId={focusRoleId}
          rolePrefix={rolePrefix}
          onAssign={assign}
          onUnassign={unassign}
          userAssignments={userAssignments}
          onEditDerived={handleEditDerived}
          onResetDerived={resetDerivedValue}
        />
      )}

      {addTokenPreset && (
        <AddTokenDialog
          presetType={addTokenPreset.tokenType}
          presetRole={addTokenPreset.role}
          onSave={(token, role) => {
            addManual(token, role);
            setAddTokenPreset(undefined);
            setToast(role ? `Added — ${role} has a home now.` : "Token added.");
          }}
          onClose={() => setAddTokenPreset(undefined)}
        />
      )}
    </div>
  );
}
