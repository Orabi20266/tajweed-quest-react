import { useEffect } from "react";

export default function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(onDone, toast.duration ?? 3200);
    return () => clearTimeout(timer);
  }, [toast, onDone]);

  return (
    <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">
      {toast?.message ?? ""}
    </div>
  );
}
