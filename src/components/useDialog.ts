import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * DESIGN.md §11 keyboard support for modal dialogs: focus moves into the
 * dialog on open, Tab cycles inside it (trap), Escape closes, and focus
 * returns to the opener on close. Attach the ref to the dialog panel.
 */
export function useDialog(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // Parents pass inline closures; a ref keeps the effect mount-only so focus
  // isn't yanked back to the first element on every parent re-render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
    (focusables()[0] ?? node).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => {
      node.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, []);

  return ref;
}
