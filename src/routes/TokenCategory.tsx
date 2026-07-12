import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { StyleSnapToken, TokenType } from "../contract/types";
import { AddTokenDialog } from "../components/AddTokenDialog";
import { AnchorsStep } from "../components/AnchorsStep";
import { TypeAnchorStep } from "../components/TypeAnchorStep";
import { GapPanel } from "../components/GapPanel";
import { GiveMeaningStep } from "../components/GiveMeaningStep";
import { isTokenCategory } from "../components/shell/SideNav";
import { DEFAULT_ROUTE } from "./AppShell";
import { useSession } from "../state/SessionProvider";
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
  shadows: "shadow/",
};

const CATEGORY_TITLES: Record<TokenCategory, string> = {
  colors: "Colors",
  typography: "Typography",
  spacing: "Spacing",
  radius: "Radius",
  borders: "Borders",
  shadows: "Shadows",
};

type AddTokenPreset = { tokenType: TokenType; role?: string };

/** One token category per route — anchors are edited on Colors. */
export function TokenCategory() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const focusRoleId = searchParams.get("focus") ?? undefined;

  const { pool, vm, setAnchor, assign, unassign, addManual, editDerivedValue, resetDerivedValue, setAccent, setToast, undo } =
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

  const handleEditDerived = (role: string, token: StyleSnapToken) => {
    editDerivedValue(role, token);
    const label = token.type === "color" ? token.value : role.split("/").pop()?.replace(/-/g, " ") ?? role;
    setToast(`Updated ${label} · Undo`, { undo });
  };

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

  if (!isTokenCategory(category)) return <Navigate to={DEFAULT_ROUTE} replace />;

  const title = CATEGORY_TITLES[category];

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
        {rolePrefix && category !== "typography" && (
          <p className="text-caption text-text-muted">
            Assign semantic roles for this category. One primitive can fill several roles.
          </p>
        )}
      </header>

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
            fills={fills}
            focusRoleId={focusRoleId}
            rolePrefix="color/"
            onAssign={assign}
            onUnassign={unassign}
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
          <GiveMeaningStep
            entries={vm.entries}
            merges={pool.merges}
            decisions={pool.decisions}
            assignments={vm.resolvedAssignments}
            systemTokens={vm.systemTokens}
            draftFills={vm.draftFills}
            fills={fills}
            focusRoleId={focusRoleId}
            rolePrefix="type/"
            onAssign={assign}
            onUnassign={unassign}
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
          fills={fills}
          focusRoleId={focusRoleId}
          rolePrefix={rolePrefix}
          onAssign={assign}
          onUnassign={unassign}
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
