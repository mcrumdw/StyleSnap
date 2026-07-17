import { type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Escape sticky ancestors — modals must paint above the whole session shell. */
export function ModalPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
