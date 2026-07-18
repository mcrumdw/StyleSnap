import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { TokenType } from "../contract/types";
import { AddTokenDialog } from "../components/AddTokenDialog";
import { AnchorsStep } from "../components/AnchorsStep";
import { Button } from "../components/Button";
import { CapturedColors } from "../components/CapturedColors";
import { CapturedFonts } from "../components/CapturedFonts";
import { CapturedFoundations } from "../components/CapturedFoundations";
import {
  CategoryLayerNav,
  LayerSection,
  type CategoryLayerId,
} from "../components/CategoryLayerNav";
import { DesignAccents } from "../components/DesignAccents";
import { TypeAnchorStep } from "../components/TypeAnchorStep";
import { GapPanel } from "../components/GapPanel";
import { GiveMeaningStep } from "../components/GiveMeaningStep";
import { PrimitiveInventory } from "../components/PrimitiveInventory";
import { isTokenCategory } from "../components/shell/SideNav";
import { DEFAULT_ROUTE } from "./AppShell";
import { useSession } from "../state/SessionProvider";
import { resolveAssignments } from "../state/pool";
import { effectiveAccentIds } from "../engine/accents";
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

const CATEGORY_TOKEN_TYPE: Record<TokenCategory, TokenType> = {
  colors: "color",
  typography: "typography",
  spacing: "spacing",
  radius: "border-radius",
  borders: "border-width",
  effects: "shadow",
};

const ADD_LABELS: Record<TokenCategory, string> = {
  colors: "Add color",
  typography: "Add type",
  spacing: "Add spacing",
  radius: "Add radius",
  borders: "Add border width",
  effects: "Add effect",
};

const FOUNDATION_TYPE: Partial<
  Record<TokenCategory, "spacing" | "border-radius" | "border-width" | "shadow">
> = {
  spacing: "spacing",
  radius: "border-radius",
  borders: "border-width",
  effects: "shadow",
};

type AddTokenPreset = { tokenType: TokenType; role?: string };

const LAYER_TIPS = {
  snap: "Everything this capture brought in — assign roles or exclude noise.",
  primitives: "Named values the system keeps after merges — rename, un-merge, or remove.",
  roles: "Appendix B semantic slots pointing at primitives.",
} as const;

const DEFAULT_OPEN: Record<CategoryLayerId, boolean> = {
  "from-snap": false,
  primitives: true,
  "system-roles": true,
};

/** One token category per route — three layers: From snap → Primitives → System roles. */
export function TokenCategory() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const focusRoleId = searchParams.get("focus") ?? undefined;

  const {
    pool,
    vm,
    setAnchor,
    assign,
    unassign,
    addManual,
    setName,
    unmerge,
    exclude,
    restore,
    removeManual,
    editWithUndoToast,
    resetDerivedValue,
    setAccent,
    setAccentIds,
    setToast,
    undo,
  } = useSession();

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
  const [layerOpen, setLayerOpen] = useState<Record<CategoryLayerId, boolean>>(DEFAULT_OPEN);

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
    setLayerOpen((prev) => ({ ...prev, "system-roles": true }));
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

  const fontOptions = useMemo(() => {
    const families = new Set<string>();
    for (const t of vm.workingTokens) {
      if (t.type === "typography" && !t.id.startsWith("derived_")) {
        families.add(t.value.fontFamily);
      }
    }
    return [...families].sort((a, b) => a.localeCompare(b));
  }, [vm.workingTokens]);

  // Legacy routes from the old shell.
  if (category === "anchors" || category === "captured") {
    return <Navigate to={DEFAULT_ROUTE} replace />;
  }
  if (category === "shadows") {
    return <Navigate to={`/tokens/effects${location.search}`} replace />;
  }

  if (!isTokenCategory(category)) return <Navigate to={DEFAULT_ROUTE} replace />;

  const title = CATEGORY_TITLES[category];
  const tokenType = CATEGORY_TOKEN_TYPE[category];
  const foundationType = FOUNDATION_TYPE[category];
  const addLabel = ADD_LABELS[category];

  const workingOfType = vm.workingTokens.filter(
    (t) => t.type === tokenType && !t.id.startsWith("derived_"),
  );
  const excludedOfType = vm.excludedTokens.filter((t) => t.type === tokenType);
  const roleCount = vm.draftFills.filter((f) => {
    if (category === "colors") return f.role.startsWith("color/");
    if (!rolePrefix) return false;
    return f.role.startsWith(rolePrefix);
  }).length;

  const insight =
    category === "spacing"
      ? vm.insights.spacing.summary
      : category === "radius"
        ? vm.insights.radius.summary
        : category === "typography"
          ? vm.insights.type.summary
          : undefined;

  const handleExclude = (tokenId: string) => {
    exclude(tokenId);
    setToast("Excluded from system", { undo: () => undo() });
  };

  const openAdd = () => setAddTokenPreset({ tokenType });

  const toggleLayer = (id: CategoryLayerId) => {
    setLayerOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const jumpToLayer = (id: CategoryLayerId) => {
    setLayerOpen((prev) => ({ ...prev, [id]: true }));
    requestAnimationFrame(() => {
      document.getElementById(`layer-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const addButton = (
    <Button size="sm" variant="secondary" onClick={openAdd}>
      {addLabel}
    </Button>
  );

  const excludedStrip =
    excludedOfType.length > 0 ? (
      <div className="mt-3 flex flex-col gap-2 rounded-md border-2 border-dashed border-border-default bg-surface-page p-3">
        <p className="font-mono text-badge text-text-muted">
          Excluded ({excludedOfType.length}) — restore to bring back into the system
        </p>
        <ul className="flex flex-wrap gap-2">
          {excludedOfType.map((t) => (
            <li key={t.id}>
              <Button size="sm" variant="ghost" onClick={() => restore(t.id)}>
                Restore {t.type === "color" ? t.value : t.id.slice(0, 12)}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const primitivesPanel = (
    <PrimitiveInventory
      tokenType={tokenType}
      tokens={vm.systemTokens}
      decisions={pool.decisions}
      merges={pool.merges}
      assignments={vm.resolvedAssignments}
      rawById={vm.exportInput.rawById}
      onSetName={setName}
      onUnmerge={(id) => {
        unmerge(id);
        setToast("Un-merged", { undo: () => undo() });
      }}
      onExclude={handleExclude}
      onRemoveManual={(id) => {
        removeManual(id);
        setToast("Deleted manual token", { undo: () => undo() });
      }}
    />
  );

  const rolesPanel = (
    <>
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
          <DesignAccents
            tokens={vm.exportInput.tokens}
            accentIds={vm.accentIds}
            explicit={pool.accentIds !== undefined}
            onRemove={(id) => {
              const current =
                pool.accentIds ??
                effectiveAccentIds(
                  undefined,
                  vm.exportInput.tokens,
                  vm.resolvedAssignments,
                  vm.anchors.primaryColorId,
                  vm.anchors.secondaryColorId,
                );
              setAccentIds(current.filter((x) => x !== id));
            }}
            onResetAuto={() => setAccentIds(undefined)}
          />
        </>
      )}
      {category === "typography" && (
        <TypeAnchorStep
          anchors={vm.anchors}
          tokens={vm.exportInput.tokens}
          onSetAnchor={setAnchor}
        />
      )}
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
        rolePrefix={category === "colors" ? "color/" : rolePrefix}
        onAssign={assign}
        onUnassign={unassign}
        userAssignments={userAssignments}
        onEditDerived={handleEditDerived}
        onResetDerived={resetDerivedValue}
      />
      {category === "colors" && vm.gapCount > 0 && (
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
  );

  const fromSnapPanel = (
    <>
      {category === "colors" && (
        <CapturedColors
          tokens={vm.workingTokens}
          assignments={vm.resolvedAssignments}
          primaryId={vm.anchors.primaryColorId}
          secondaryId={vm.anchors.secondaryColorId}
          accentIds={vm.accentIds}
          onMakePrimary={(id) => setAnchor({ primaryColorId: id })}
          onMakeSecondary={(id) => setAnchor({ secondaryColorId: id })}
          onAssign={assign}
          onAddAccent={(id) => {
            const next = [...vm.accentIds];
            if (!next.includes(id)) next.push(id);
            setAccentIds(next);
          }}
          onExclude={handleExclude}
        />
      )}
      {category === "typography" && (
        <CapturedFonts
          tokens={vm.workingTokens}
          assignments={vm.resolvedAssignments}
          onAssign={assign}
          onExclude={handleExclude}
        />
      )}
      {foundationType && (
        <CapturedFoundations
          tokenType={foundationType}
          tokens={vm.workingTokens}
          assignments={vm.resolvedAssignments}
          onAssign={assign}
          onExclude={handleExclude}
          emptyLabel={`No ${title.toLowerCase()} in this snap.`}
        />
      )}
      {excludedStrip}
    </>
  );

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-section-header font-bold sm:text-page-title">{title}</h1>
          {addButton}
        </div>
        <p className="text-caption text-text-muted">
          Review what your snap captured, the primitives the system saved, then semantic roles.
        </p>
      </header>

      <CategoryLayerNav
        counts={{
          "from-snap": workingOfType.length,
          primitives: workingOfType.length,
          "system-roles": roleCount,
        }}
        openLayers={layerOpen}
        onJumpToLayer={jumpToLayer}
      />

      <LayerSection
        id="from-snap"
        title="From snap"
        tip={LAYER_TIPS.snap}
        count={workingOfType.length}
        open={layerOpen["from-snap"]}
        onToggle={() => toggleLayer("from-snap")}
        insight={insight}
      >
        {fromSnapPanel}
      </LayerSection>

      <LayerSection
        id="primitives"
        title="Primitives"
        tip={LAYER_TIPS.primitives}
        count={workingOfType.length}
        open={layerOpen.primitives}
        onToggle={() => toggleLayer("primitives")}
        actions={addButton}
      >
        {primitivesPanel}
      </LayerSection>

      <LayerSection
        id="system-roles"
        title="System roles"
        tip={LAYER_TIPS.roles}
        count={roleCount}
        open={layerOpen["system-roles"]}
        onToggle={() => toggleLayer("system-roles")}
      >
        {rolesPanel}
      </LayerSection>

      {addTokenPreset && (
        <AddTokenDialog
          presetType={addTokenPreset.tokenType}
          presetRole={addTokenPreset.role}
          addLabel={addLabel}
          lockType
          fontOptions={fontOptions}
          onSave={(token, role) => {
            addManual(token, role);
            setAddTokenPreset(undefined);
            setToast(role ? `Added — ${role} has a home now.` : `${addLabel.replace(/^Add /, "")} added.`);
          }}
          onClose={() => setAddTokenPreset(undefined)}
        />
      )}
    </div>
  );
}
