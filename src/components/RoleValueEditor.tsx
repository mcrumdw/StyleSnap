import { useEffect, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import { fallbackName } from "../engine/roles";
import type { FillInfo, FillOrigin } from "../state/useSessionViewModel";
import { humanValueLabel, type TokenPreviewContext } from "../state/token-display";
import { Button } from "./Button";
import { RoleTokenPreview } from "./RoleTokenPreview";

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
  if (origin === "captured" || origin === "assigned") return false;
  return (
    token.type === "color" ||
    token.type === "spacing" ||
    token.type === "border-radius" ||
    token.type === "border-width" ||
    (token.type === "typography" && token.id.startsWith("derived_"))
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
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
}

/**
 * FR-19 — click-to-edit popover for derived role values. Captured assignments
 * are reassign-only (provenance explains why).
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
}: RoleValueEditorProps) {
  const [editHex, setEditHex] = useState(token.type === "color" ? token.value : "");
  const [editNumber, setEditNumber] = useState(
    token.type === "spacing" || token.type === "border-radius" || token.type === "border-width"
      ? String(token.value)
      : "",
  );
  const [editFontSize, setEditFontSize] = useState(
    token.type === "typography" ? String(token.value.fontSize) : "",
  );

  useEffect(() => {
    if (!open) return;
    if (token.type === "color") setEditHex(token.value);
    if (token.type === "spacing" || token.type === "border-radius" || token.type === "border-width") {
      setEditNumber(String(token.value));
    }
    if (token.type === "typography") setEditFontSize(String(token.value.fontSize));
  }, [open, token]);

  if (!open) return null;

  const origin = fillInfo?.origin ?? originOf(role, fills);
  const editable =
    origin !== "captured" && origin !== "assigned" && isRoleValueEditable(role, token, fills);

  const provenance =
    origin === "captured" || origin === "assigned"
      ? `From your capture${fillInfo ? ` — ${fillInfo.method}` : ""}. Reassign a different primitive to change it.`
      : fillInfo
        ? origin === "edited"
          ? `You edited this. Originally: ${fillInfo.method}${
              anchorToken ? ` from ${nameOf(anchorToken)}` : ""
            }.`
          : `We made this: ${fillInfo.method}${
              anchorToken ? ` from ${nameOf(anchorToken)}` : ""
            }.`
        : `Assigned primitive (${token.source}, ×${token.occurrences}).`;

  const saveColor = () => {
    if (!onEditDerived || token.type !== "color" || !HEX_RE.test(editHex)) return;
    onEditDerived(role, { ...token, value: editHex.toUpperCase() });
    onClose();
  };

  const saveNumber = () => {
    if (!onEditDerived) return;
    const n = Number(editNumber);
    if (!Number.isFinite(n) || n < 0) return;
    if (token.type === "spacing" || token.type === "border-radius" || token.type === "border-width") {
      onEditDerived(role, { ...token, value: n });
      onClose();
    }
  };

  const saveFontSize = () => {
    if (!onEditDerived || token.type !== "typography") return;
    const n = Number(editFontSize);
    if (!Number.isFinite(n) || n <= 0) return;
    onEditDerived(role, { ...token, value: { ...token.value, fontSize: n } });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-sticky" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={`Edit ${role}`}
        className="absolute left-0 top-full z-dropdown mt-2 w-72 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-modal"
      >
        <p className="text-caption text-text-primary">{provenance}</p>

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
            Reset to derived
          </Button>
        )}
      </div>
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
  onUnassign?: () => void;
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  previewContext: TokenPreviewContext;
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
  onUnassign,
  onEditDerived,
  onResetDerived,
  previewContext,
}: RoleFilledRowProps) {
  const [open, setOpen] = useState(false);
  const origin = fillInfo?.origin ?? (token.id.startsWith("derived_") ? "derived" : "assigned");
  const canOpen = Boolean(onEditDerived);

  return (
    <div
      id={rowId}
      className={`relative ${
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
            <span className="truncate font-mono text-caption font-medium text-brand-primary">{role}</span>
            <span className="line-clamp-2 text-caption text-text-primary">{humanValueLabel(token, role)}</span>
            <span className="truncate font-mono text-badge text-text-muted">{name}</span>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2 self-center px-4">
          {origin === "derived" && (
            <span className="rounded-sm border border-border-default bg-surface-page px-1.5 py-0.5 font-mono text-badge text-text-muted">
              auto
            </span>
          )}
          {origin === "edited" && (
            <span
              className="h-2 w-2 rounded-full bg-brand-primary"
              title="You edited this value"
              aria-label="edited by you"
            />
          )}
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
        onClose={() => setOpen(false)}
        onEditDerived={onEditDerived}
        onResetDerived={onResetDerived}
      />
    </div>
  );
}
