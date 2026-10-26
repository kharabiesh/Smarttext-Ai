import type { ReactNode } from "react";

export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>
      <div>
        <p className="text-[15px] font-semibold">{title}</p>
        {hint && <p className="mt-1 max-w-sm text-[13px] text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
