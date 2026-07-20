import { useEffect, useState, type ReactNode } from "react";
import type { StyleSnapToken } from "../contract/types";
import { fallbackName } from "../engine/roles";
import type { FillInfo, FillOrigin } from "../state/useSessionViewModel";
import { humanValueLabel, type TokenPreviewContext } from "../state/token-display";
import { Button } from "./Button";
import { ModalPortal } from "./ModalPortal";
import { RoleTokenPreview } from "./RoleTokenPreview";
import { useDialog } from "./useDialog";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const nameOf = (token: StyleSnapToken) => token.name ?? fallbackName(token);

function originOf(role: string, fills: Record<string, FillInfo>): FillOrigin | "assigned" {
  return fills[role]?.origin ?? "assigned";
}

export function isRoleValueEditable(
  role: string,
  token: StyleSnapToken,
  fills: Record<string, FillInfo>,
): boolean {
  const origin = originOf(role, fills);
  // snap / seeded / assigned = captured provenance — reassign only, don't edit the hex.
  if (origin === "snap" || origin === "seeded" || origin === "assigned") return false;
  return (
    token.type === "color" ||
    token.type === "spacing" ||
    token.type === "border-radius" ||
    token.type === "border-width" ||
    (token.type === "typography" && token.id.startsWith("derived_"))
  );
}

interface SaveAsPrimitiveConfirmProps {
  role: string;
  token: StyleSnapToken;
  onAccept: () => void;
  onCancel: () => void;
}

/** Confirm before materializing a role value edit as a linked manual primitive. */
export function SaveAsPrimitiveConfirm({
  role,
  token,
  onAccept,
  onCancel,
}: SaveAsPrimitiveConfirmProps) {
  const dialogRef = useDialog(onCancel);
  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
        onClick={onCancel}
      >
        <div
          ref={dialogRef}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="save-primitive-title"
          aria-describedby="save-primitive-desc"
          className="flex max-h-[min(90dvh,100%)] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="save-primitive-title" className="font-heading text-card-title font-medium">
            Save as a new primitive?
          </h2>
          <p id="save-primitive-desc" className="mt-2 text-caption text-text-muted">
            Changing <span className="font-mono text-text-primary">{role}</span> creates a new
            primitive (
            <span className="font-mono text-text-primary">{humanValueLabel(token, role)}</span>) and
            links this role to it. You’ll see it under Primitives.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Button className="w-full sm:w-auto" type="button" onClick={onAccept}>
              Save as primitive
            </Button>
            <Button className="w-full sm:w-auto" type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

interface RoleValueEditorProps {
  role: string;
  token: StyleSnapToken;
  fills: Record<string, FillInfo>;
  fillInfo?: FillInfo;
  anchorToken?: StyleSnapToken;
  open: boolean;
  onClose: () => void;
  /**
   * Persist the edit as a new primitive + assign this role (after confirm).
   * Call sites should wire `saveRoleAsPrimitive`, not a silent derived overlay.
   */
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  /** Compact PrimitivePicker (+ optional Remove role) — lives in this popover. */
  reassignSlot?: ReactNode;
}

/**
 * FR-19 — click-to-edit popover for derived role values. Captured assignments
 * are reassign-only (provenance + Change primitive in this dialog).
 * Value edits confirm → save as a new linked primitive.
 */
export function RoleValueEditor({
  role,
  token,
  fills,
  fillInfo,
  anchorToken,
  open,
  onClose,
  onEditDerived,
  onResetDerived,
  reassignSlot,
}: RoleValueEditorProps) {
  const [editHex, setEditHex] = useState(token.type === "color" ? token.value : "");
  const [editNumber, setEditNumber] = useState(
    token.type === "spacing" || token.type === "border-radius" || token.type === "border-width"
      ? String(token.value)
      : "",
  );
  const [editFontSize, setEditFontSize] = useState(
    token.type === "typography" ? String(Math.round(token.value.fontSize)) : "",
  );
  const [pending, setPending] = useState<StyleSnapToken | null>(null);

  useEffect(() => {
    if (!open) {
      setPending(null);
      return;
    }
    if (token.type === "color") setEditHex(token.value);
    if (token.type === "spacing" || token.type === "border-radius" || token.type === "border-width") {
      setEditNumber(String(token.value));
    }
    if (token.type === "typography") setEditFontSize(String(Math.round(token.value.fontSize)));
  }, [open, token]);

  if (!open) return null;

  const origin = fillInfo?.origin ?? originOf(role, fills);
  const fromSnap = origin === "snap" || origin === "seeded" || origin === "assigned";
  const editable = !fromSnap && isRoleValueEditable(role, token, fills);

  const provenance = fromSnap
    ? origin === "seeded"
      ? `Auto-filled from your snap${fillInfo ? ` (${fillInfo.method})` : ""}. Change the primitive to replace it.`
      : `From your snap${fillInfo ? ` (${fillInfo.method})` : ""}. Change the primitive to replace it.`
    : fillInfo
      ? origin === "edited"
        ? `You edited this. Was: ${fillInfo.method}${
            anchorToken ? ` from ${nameOf(anchorToken)}` : ""
          }.`
        : origin === "default"
          ? `Default — nothing captured. ${fillInfo.method}`
          : `We made this: ${fillInfo.method}${
              anchorToken ? ` from ${nameOf(anchorToken)}` : ""
            }.`
      : `Linked primitive (${token.source}, ×${token.occurrences}).`;

  const requestSave = (next: StyleSnapToken) => {
    if (!onEditDerived) return;
    setPending(next);
  };

  const saveColor = () => {
    if (token.type !== "color" || !HEX_RE.test(editHex)) return;
    requestSave({ ...token, value: editHex.toUpperCase() });
  };

  const saveNumber = () => {
    const n = Number(editNumber);
    if (!Number.isFinite(n) || n < 0) return;
    if (token.type === "spacing" || token.type === "border-radius" || token.type === "border-width") {
      requestSave({ ...token, value: n });
    }
  };

  const saveFontSize = () => {
    if (token.type !== "typography") return;
    const n = Math.round(Number(editFontSize));
    if (!Number.isFinite(n) || n <= 0) return;
    requestSave({ ...token, value: { ...token.value, fontSize: n } });
  };

  const acceptPending = () => {
    if (!pending || !onEditDerived) return;
    onEditDerived(role, pending);
    setPending(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-sticky" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={`Edit ${role}`}
        className="absolute left-0 top-full z-dropdown mt-2 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-md border-2 border-border-default bg-surface-card p-3 shadow-modal"
      >
        <p className="text-caption text-text-primary">{provenance}</p>

        {reassignSlot && (
          <div className="mt-3 flex flex-wrap items-center gap-2">{reassignSlot}</div>
        )}

        {editable && token.type === "color" && onEditDerived && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="color"
              value={HEX_RE.test(editHex) ? editHex : "#000000"}
              onChange={(e) => setEditHex(e.target.value.toUpperCase())}
              aria-label={`Pick ${role} color`}
              className="h-btn-sm w-10 cursor-pointer rounded-sm border-2 border-border-default bg-surface-card p-0.5"
            />
            <input
              value={editHex}
              onChange={(e) => setEditHex(e.target.value)}
              aria-label={`Edit ${role} value`}
              className="h-btn-sm w-24 rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption"
            />
            {"EyeDropper" in window && (
              <Button
                size="sm"
                variant="secondary"
                title="Pick a color from anywhere on screen"
                onClick={async () => {
                  try {
                    const picker = new (
                      window as unknown as {
                        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
                      }
                    ).EyeDropper();
                    const result = await picker.open();
                    setEditHex(result.sRGBHex.toUpperCase());
                  } catch {
                    // user cancelled
                  }
                }}
              >
                Pick
              </Button>
            )}
            <Button type="button" size="sm" disabled={!HEX_RE.test(editHex)} onClick={saveColor}>
              Save
            </Button>
          </div>
        )}

        {editable &&
          (token.type === "spacing" || token.type === "border-radius" || token.type === "border-width") &&
          onEditDerived && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={1}
                value={editNumber}
                onChange={(e) => setEditNumber(e.target.value)}
                aria-label={`Edit ${role} value`}
                className="h-btn-sm w-20 rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption"
              />
              <span className="font-mono text-caption text-text-muted">px</span>
              <Button
                type="button"
                size="sm"
                disabled={!Number.isFinite(Number(editNumber)) || Number(editNumber) < 0}
                onClick={saveNumber}
              >
                Save
              </Button>
            </div>
          )}

        {editable && token.type === "typography" && token.id.startsWith("derived_") && onEditDerived && (
          <div className="mt-2 flex items-center gap-2">
            <label className="font-mono text-caption text-text-muted">Size</label>
            <input
              type="number"
              min={1}
              step={1}
              value={editFontSize}
              onChange={(e) => setEditFontSize(e.target.value)}
              aria-label={`Edit ${role} font size`}
              className="h-btn-sm w-20 rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption"
            />
            <span className="font-mono text-caption text-text-muted">px</span>
            <Button
              type="button"
              size="sm"
              disabled={!Number.isFinite(Number(editFontSize)) || Number(editFontSize) <= 0}
              onClick={saveFontSize}
            >
              Save
            </Button>
          </div>
        )}

        {origin === "edited" && onResetDerived && (
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => { onResetDerived(role); onClose(); }}>
            Reset to created
          </Button>
        )}
      </div>

      {pending && (
        <SaveAsPrimitiveConfirm
          role={role}
          token={pending}
          onAccept={acceptPending}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}

interface RoleFilledRowProps {
  role: string;
  token: StyleSnapToken;
  fills: Record<string, FillInfo>;
  fillInfo?: FillInfo;
  anchorToken?: StyleSnapToken;
  focusRoleId?: string;
  rowId: string;
  name: string;
  roleMeaning?: string;
  onUnassign?: () => void;
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  previewContext: TokenPreviewContext;
  /**
   * Build the Change primitive control (and optional Remove role). Called with
   * `close` so assign can dismiss the popover.
   */
  reassignSlot?: (close: () => void) => ReactNode;
}

export function RoleFilledRow({
  role,
  token,
  fills,
  fillInfo,
  anchorToken,
  focusRoleId,
  rowId,
  name,
  roleMeaning,
  onUnassign,
  onEditDerived,
  onResetDerived,
  previewContext,
  reassignSlot,
}: RoleFilledRowProps) {
  const [open, setOpen] = useState(false);
  const origin = fillInfo?.origin ?? (token.id.startsWith("derived_") ? "derived" : "assigned");
  const canOpen = Boolean(onEditDerived || reassignSlot);
  const close = () => setOpen(false);

  const originChip =
    origin === "seeded" ? (
      <span
        className="font-mono text-badge text-text-muted"
        title="From your capture"
      >
        from capture
      </span>
    ) : origin === "derived" ? (
      <span className="font-mono text-badge text-text-muted" title="Computed from your snap colors">
        created
      </span>
    ) : origin === "default" ? (
      <span className="font-mono text-badge text-text-muted" title="Stock convention — nothing captured">
        default
      </span>
    ) : origin === "edited" ? (
      <span
        className="h-2 w-2 rounded-full bg-brand-primary"
        title="You edited this value"
        aria-label="edited by you"
      />
    ) : null;

  return (
    <div
      id={rowId}
      className={`relative flex flex-col gap-2 ${
        focusRoleId === role ? "rounded-md ring-2 ring-brand-primary ring-offset-2" : ""
      }`}
    >
      <div className="box-content flex h-[5.5rem] items-stretch overflow-hidden rounded-md border-2 border-border-default bg-surface-card shadow-card">
        <button
          type="button"
          disabled={!canOpen}
          onClick={() => canOpen && setOpen((o) => !o)}
          className={`flex h-full min-w-0 flex-1 items-stretch text-left ${
            canOpen ? "cursor-pointer hover:opacity-95" : "cursor-default"
          }`}
          aria-expanded={open}
          aria-label={canOpen ? `Edit ${role}` : role}
        >
          <RoleTokenPreview token={token} role={role} preview={previewContext} />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-2">
            <span
              className="truncate font-mono text-caption font-medium text-brand-primary"
              title={roleMeaning}
            >
              {role}
            </span>
            <span className="line-clamp-2 text-caption text-text-primary">{humanValueLabel(token, role)}</span>
            <span className="truncate font-mono text-badge text-text-muted">{name}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2 self-center px-4">
          {originChip}
          {onUnassign && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onUnassign();
              }}
              aria-label={`Remove role ${role}`}
              className="rounded-sm border-2 border-border-default px-1.5 py-0.5 font-mono text-caption leading-none text-text-muted hover:border-brand-primary hover:text-brand-primary"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <RoleValueEditor
        role={role}
        token={token}
        fills={fills}
        fillInfo={fillInfo}
        anchorToken={anchorToken}
        open={open}
        onClose={close}
        onEditDerived={onEditDerived}
        onResetDerived={onResetDerived}
        reassignSlot={reassignSlot?.(close)}
      />
    </div>
  );
}
