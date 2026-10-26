import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useToasts } from "@/state/toast";
import { cx } from "./ui/cx";

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={cx("pointer-events-auto flex items-start gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-sm shadow-lg animate-fade-in")}
        >
          {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}
          {t.kind === "error" && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />}
          {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />}
          <span className="flex-1 break-words">{t.message}</span>
          <button onClick={() => dismiss(t.id)} className="text-muted hover:text-fg" aria-label="×">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
