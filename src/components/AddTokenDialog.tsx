import { useState } from "react";
import type {
  BorderRadiusToken,
  BorderWidthToken,
  ColorToken,
  SpacingToken,
  StyleSnapToken,
  TokenType,
  TypographyToken,
} from "../contract/types";
import { rolesForType, validateSlashName } from "../engine/roles";
import { Button } from "./Button";
import { Input } from "./Input";
import { useDialog } from "./useDialog";

/** Types the manual form supports (FR-19: color picker, type fields, numeric). */
const MANUAL_TYPES: TokenType[] = ["color", "typography", "spacing", "border-radius", "border-width"];

const TYPE_LABELS: Record<string, string> = {
  color: "Color",
  typography: "Typography",
  spacing: "Spacing",
  "border-radius": "Border radius",
  "border-width": "Border width",
};

interface AddTokenDialogProps {
  presetType?: TokenType;
  presetRole?: string;
  /** When set, the dialog edits this manual token in place. */
  editing?: StyleSnapToken;
  editingRole?: string;
  onSave: (token: StyleSnapToken, role?: string) => void;
  onClose: () => void;
}

const field =
  "w-full rounded-sm border-2 border-border-default bg-surface-card px-3 py-2 text-base text-text-primary placeholder:text-text-muted";

/** PRD §7.6 FR-19 — manual gap-fill: add or edit a token, optionally with a role. */
export function AddTokenDialog({
  presetType,
  presetRole,
  editing,
  editingRole,
  onSave,
  onClose,
}: AddTokenDialogProps) {
  const initialType = editing?.type ?? presetType ?? "color";
  const [type, setType] = useState<TokenType>(
    MANUAL_TYPES.includes(initialType) ? initialType : "color",
  );
  const [name, setName] = useState(editing?.name ?? "");
  const [role, setRole] = useState(editingRole ?? presetRole ?? "");
  const [error, setError] = useState<string | null>(null);

  // Value fields.
  const editingColor = editing?.type === "color" ? (editing as ColorToken) : undefined;
  const editingTypo = editing?.type === "typography" ? (editing as TypographyToken) : undefined;
  const editingNumeric =
    editing && ["spacing", "border-radius", "border-width"].includes(editing.type)
      ? (editing as SpacingToken | BorderRadiusToken | BorderWidthToken)
      : undefined;

  const [hex, setHex] = useState(editingColor?.value ?? "#5B2EFF");
  const [opacity, setOpacity] = useState(editingColor?.opacity ?? 1);
  const [family, setFamily] = useState(editingTypo?.value.fontFamily ?? "");
  const [size, setSize] = useState(editingTypo?.value.fontSize ?? 16);
  const [weight, setWeight] = useState(editingTypo?.value.fontWeight ?? 400);
  const [lineHeight, setLineHeight] = useState(editingTypo?.value.lineHeight ?? 1.5);
  const [numeric, setNumeric] = useState(editingNumeric?.value ?? 16);
  const dialogRef = useDialog(onClose);

  function save() {
    const trimmedName = name.trim();
    if (trimmedName) {
      const problem = validateSlashName(trimmedName);
      if (problem) return setError(problem);
    }

    const id = editing?.id ?? `manual_${crypto.randomUUID().slice(0, 8)}`;
    const base = {
      id,
      captureId: editing?.captureId ?? `manual-${id}`,
      source: "manual entry",
      name: trimmedName || null,
      occurrences: editing?.occurrences ?? 1,
      merged: false,
    };

    let token: StyleSnapToken;
    switch (type) {
      case "color":
        token = { ...base, type: "color", value: hex.toUpperCase(), opacity };
        break;
      case "typography": {
        if (!family.trim()) return setError("Font family is required.");
        if (!(size > 0) || !(lineHeight > 0)) return setError("Size and line-height must be positive.");
        if (weight < 100 || weight > 900) return setError("Weight must be 100–900.");
        token = {
          ...base,
          type: "typography",
          value: { fontFamily: family.trim(), fontSize: size, fontWeight: weight, lineHeight },
        };
        break;
      }
      default: {
        if (!Number.isFinite(numeric)) return setError("Value must be a number.");
        token = { ...base, type, value: numeric } as StyleSnapToken;
        break;
      }
    }

    onSave(token, role || undefined);
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-text-primary/50 p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? "Edit token" : "Add token"}
        className="w-full max-w-md rounded-lg border-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-card-title font-medium">
          {editing ? "Edit token" : "Add a token"}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-caption font-medium text-text-muted">Type</span>
            <select
              className={field}
              value={type}
              disabled={editing !== undefined}
              onChange={(e) => {
                setType(e.target.value as TokenType);
                setRole("");
              }}
            >
              {MANUAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          {type === "color" && (
            <div className="flex items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text-muted">Color</span>
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  aria-label="Color value"
                  className="h-11 w-16 cursor-pointer rounded-sm border-2 border-border-default bg-surface-card"
                />
              </label>
              <span className="pb-3 font-mono text-caption text-text-muted">{hex.toUpperCase()}</span>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-caption font-medium text-text-muted">Opacity (0–1)</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className={field}
                />
              </label>
            </div>
          )}

          {type === "typography" && (
            <>
              <Input
                label="Font family"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="Inter"
              />
              <div className="grid grid-cols-3 gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-caption font-medium text-text-muted">Size (px)</span>
                  <input type="number" min={1} value={size} onChange={(e) => setSize(Number(e.target.value))} className={field} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-caption font-medium text-text-muted">Weight</span>
                  <input type="number" min={100} max={900} step={100} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className={field} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-caption font-medium text-text-muted">Line-height</span>
                  <input type="number" min={0.5} step={0.05} value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className={field} />
                </label>
              </div>
            </>
          )}

          {(type === "spacing" || type === "border-radius" || type === "border-width") && (
            <label className="flex flex-col gap-1">
              <span className="text-caption font-medium text-text-muted">Value (px)</span>
              <input
                type="number"
                step={type === "border-width" ? 0.5 : 1}
                value={numeric}
                onChange={(e) => setNumeric(Number(e.target.value))}
                className={field}
              />
            </label>
          )}

          <Input
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="color/brand-blue"
          />

          <label className="flex flex-col gap-1">
            <span className="text-caption font-medium text-text-muted">Role (optional)</span>
            <select className={field} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">No role (primitive)</option>
              {rolesForType(type).map((def) => (
                <option key={def.role} value={def.role}>
                  {def.role}
                </option>
              ))}
            </select>
          </label>

          {error && <p className="text-caption text-error">{error}</p>}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Button onClick={save}>{editing ? "Save changes" : "Add token"}</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
