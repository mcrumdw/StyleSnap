import { useEffect } from "react";
import { Button } from "./Button";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastProps {
  message: string;
  onDismiss: () => void;
  action?: ToastAction;
}

/** DESIGN.md §9 voice — celebrate progress. Auto-dismisses. */
export function Toast({ message, onDismiss, action }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, action ? 8000 : 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss, action]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-toast flex max-w-sm items-center gap-3 rounded-md border-2 border-border-default bg-success px-4 py-3 font-medium text-text-primary shadow-card"
    >
      <span className="flex-1">{message}</span>
      {action && (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
