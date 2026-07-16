import { NavLink } from "react-router-dom";
import { sessionNavLinkClass } from "./nav-link-styles";

export const TOKEN_CATEGORIES = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "spacing", label: "Spacing" },
  { id: "radius", label: "Radius" },
  { id: "borders", label: "Borders" },
  { id: "effects", label: "Effects" },
] as const;

export type TokenCategory = (typeof TOKEN_CATEGORIES)[number]["id"];

export function isTokenCategory(value: string | undefined): value is TokenCategory {
  return TOKEN_CATEGORIES.some((c) => c.id === value);
}

/** Left rail — one page per token category. Anchors live under Colors. */
export function SideNav({ hints }: { hints?: Partial<Record<TokenCategory, string>> }) {
  return (
    <nav aria-label="Token categories" className="flex w-44 shrink-0 flex-col gap-1">
      {TOKEN_CATEGORIES.map(({ id, label }) => (
        <NavLink
          key={id}
          to={`/tokens/${id}`}
          className={({ isActive }) => `flex flex-col ${sessionNavLinkClass(isActive)}`}
        >
          <span className="font-heading text-caption font-bold">{label}</span>
          {hints?.[id] && <span className="font-mono text-badge text-text-muted">{hints[id]}</span>}
        </NavLink>
      ))}
    </nav>
  );
}
