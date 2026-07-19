import { useState } from "react";
import type {
  BorderRadiusToken,
  BorderWidthToken,
  ColorToken,
  ShadowToken,
  SpacingToken,
  StyleSnapToken,
  TokenType,
  TypographyToken,
} from "../contract/types";
import { isBackdropBlurToken } from "../engine/effect-kinds";
import { rolesForType, validateSlashName, namePlaceholder } from "../engine/roles";
import { Button } from "./Button";
import { Input } from "./Input";
import { useDialog } from "./useDialog";

/** Types the manual form supports (FR-19). */
const MANUAL_TYPES: TokenType[] = [
  "color",
  "typography",
  "spacing",
  "border-radius",
  "border-width",
  "shadow",
];

const TYPE_LABELS: Record<string, string> = {
  color: "Color",
  typography: "Typography",
  spacing: "Spacing",
  "border-radius": "Border radius",
  "border-width": "Border width",
  shadow: "Effect",
};

type EffectKind = "drop" | "inset" | "backdrop-blur";

interface AddTokenDialogProps {
  presetType?: TokenType;
  presetRole?: string;
  /** Dialog title + primary CTA, e.g. "Add color". */
  addLabel?: string;
  /** When set from a category page, hide the type picker. */
  lockType?: boolean;
  /** Captured font families for typography add. */
  fontOptions?: string[];
  /** When set, the dialog edits this manual token in place. */
  editing?: StyleSnapToken;
  editingRole?: string;
  onSave: (token: StyleSnapToken, role?: string) => void;
  onClose: () => void;
}

const field =
  "w-full rounded-sm border-2 border-border-default bg-surface-card px-3 py-2 text-base text-text-primary placeholder:text-text-muted";

function initialEffectKind(editing?: StyleSnapToken): EffectKind {
  if (editing && isBackdropBlurToken(editing)) return "backdrop-blur";
  if (editing?.type === "shadow" && editing.value[0]?.inset) return "inset";
  return "drop";
}

/** PRD §7.6 FR-19 — manual gap-fill: add or edit a token, optionally with a role. */
export function AddTokenDialog({
  presetType,
  presetRole,
  addLabel = "Add token",
  lockType = false,
  fontOptions = [],
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
  const [familyOther, setFamilyOther] = useState(false);

  // Value fields.
  const editingColor = editing?.type === "color" ? (editing as ColorToken) : undefined;
  const editingTypo = editing?.type === "typography" ? (editing as TypographyToken) : undefined;
  const editingNumeric =
    editing && ["spacing", "border-radius", "border-width"].includes(editing.type)
      ? (editing as SpacingToken | BorderRadiusToken | BorderWidthToken)
      : undefined;
  const editingShadow = editing?.type === "shadow" ? (editing as ShadowToken) : undefined;
  const shadowLayer = editingShadow?.value[0];

  const [hex, setHex] = useState(editingColor?.value ?? "#5B2EFF");
  const [opacity, setOpacity] = useState(editingColor?.opacity ?? 1);
  const [family, setFamily] = useState(editingTypo?.value.fontFamily ?? fontOptions[0] ?? "");
  const [size, setSize] = useState(editingTypo?.value.fontSize ?? 16);
  const [weight, setWeight] = useState(editingTypo?.value.fontWeight ?? 400);
  const [lineHeight, setLineHeight] = useState(editingTypo?.value.lineHeight ?? 1.5);
  const [numeric, setNumeric] = useState(editingNumeric?.value ?? 16);
  const [effectKind, setEffectKind] = useState<EffectKind>(initialEffectKind(editing));
  const [shadowY, setShadowY] = useState(shadowLayer?.offsetY ?? 4);
  const [shadowBlur, setShadowBlur] = useState(shadowLayer?.blur ?? 8);
  const [shadowColor, setShadowColor] = useState(shadowLayer?.color ?? "#101828");
  const [shadowOpacity, setShadowOpacity] = useState(shadowLayer?.opacity ?? 0.1);
  const [backdropBlur, setBackdropBlur] = useState(
    editing && isBackdropBlurToken(editing) && editing.type === "shadow"
      ? editing.value[0]?.blur ?? 12
      : 12,
  );
  const dialogRef = useDialog(onClose);

  const hasSnapFonts = fontOptions.length > 0;

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
      source: "manual entry" as string,
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
      case "shadow": {
        if (effectKind === "backdrop-blur") {
          if (!(backdropBlur >= 0)) return setError("Blur must be zero or positive.");
          token = {
            ...base,
            source: "manual entry:backdrop-blur",
            context: { cssProperty: "backdrop-filter" },
            type: "shadow",
            value: [
              {
                inset: false,
                offsetX: 0,
                offsetY: 0,
                blur: backdropBlur,
                spread: 0,
                color: "#000000",
                opacity: 0,
              },
            ],
          };
        } else {
          token = {
            ...base,
            type: "shadow",
            value: [
              {
                inset: effectKind === "inset",
                offsetX: 0,
                offsetY: shadowY,
                blur: shadowBlur,
                spread: 0,
                color: shadowColor.toUpperCase(),
                opacity: shadowOpacity,
              },
            ],
          };
        }
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
        aria-label={editing ? "Edit token" : addLabel}
        className="w-full max-w-md rounded-lg border-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-card-title font-medium">
          {editing ? "Edit token" : addLabel}
        </h2>

        <div className="mt-4 flex flex-col gap-4">
          {!lockType && (
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
          )}

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
              {hasSnapFonts && !familyOther ? (
                <label className="flex flex-col gap-1">
                  <span className="text-caption font-medium text-text-muted">Font family</span>
                  <select
                    className={field}
                    value={family}
                    onChange={(e) => {
                      if (e.target.value === "__other__") {
                        setFamilyOther(true);
                        setFamily("");
                      } else {
                        setFamily(e.target.value);
                      }
                    }}
                  >
                    {fontOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                    <option value="__other__">Other…</option>
                  </select>
                </label>
              ) : (
                <div className="flex flex-col gap-1">
                  <Input
                    label="Font family"
                    value={family}
                    onChange={(e) => setFamily(e.target.value)}
                    placeholder="Inter"
                  />
                  {!hasSnapFonts && (
                    <p className="text-badge text-text-muted">No fonts in snap — type a family.</p>
                  )}
                  {hasSnapFonts && familyOther && (
                    <button
                      type="button"
                      className="self-start font-mono text-badge text-brand-primary underline"
                      onClick={() => {
                        setFamilyOther(false);
                        setFamily(fontOptions[0] ?? "");
                      }}
                    >
                      Back to snap fonts
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

          {type === "shadow" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text-muted">Effect kind</span>
                <select
                  className={field}
                  value={effectKind}
                  onChange={(e) => setEffectKind(e.target.value as EffectKind)}
                >
                  <option value="drop">Outer drop shadow</option>
                  <option value="inset">Inner (inset) shadow</option>
                  <option value="backdrop-blur">Background blur</option>
                </select>
              </label>

              {effectKind === "backdrop-blur" ? (
                <label className="flex flex-col gap-1">
                  <span className="text-caption font-medium text-text-muted">Blur radius (px)</span>
                  <input
                    type="number"
                    min={0}
                    value={backdropBlur}
                    onChange={(e) => setBackdropBlur(Number(e.target.value))}
                    className={field}
                  />
                </label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-text-muted">Offset Y (px)</span>
                    <input
                      type="number"
                      value={shadowY}
                      onChange={(e) => setShadowY(Number(e.target.value))}
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-text-muted">Blur (px)</span>
                    <input
                      type="number"
                      min={0}
                      value={shadowBlur}
                      onChange={(e) => setShadowBlur(Number(e.target.value))}
                      className={field}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-text-muted">Color</span>
                    <input
                      type="color"
                      value={shadowColor}
                      onChange={(e) => setShadowColor(e.target.value)}
                      className="h-11 w-full cursor-pointer rounded-sm border-2 border-border-default bg-surface-card"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-caption font-medium text-text-muted">Opacity (0–1)</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={shadowOpacity}
                      onChange={(e) => setShadowOpacity(Number(e.target.value))}
                      className={field}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          <Input
            label="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder(type)}
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
          <Button onClick={save}>{editing ? "Save changes" : addLabel}</Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
