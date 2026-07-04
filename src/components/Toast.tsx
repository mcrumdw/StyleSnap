import { useEffect } from "react";

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

/** DESIGN.md §9 voice — celebrate progress. Auto-dismisses. */
export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      className="fixed bottom-6 right-6 z-toast rounded-md border-2 border-border-default bg-success px-4 py-3 font-medium text-text-primary shadow-card"
    >
      {message}
    </div>
  );
}
