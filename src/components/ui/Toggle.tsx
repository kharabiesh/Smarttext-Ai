import { useId } from "react";
import { cx } from "./cx";

export function Toggle({ checked, onChange, label, help, disabled }: { checked: boolean; onChange(v: boolean): void; label: string; help?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium cursor-pointer">
          {label}
        </label>
        {help && <p className="text-[12px] text-muted mt-0.5">{help}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
          checked ? "bg-accent" : "bg-surface-3",
        )}
      >
        <span
          className={cx(
            "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-[18px] rtl:-translate-x-[18px]" : "translate-x-0.5 rtl:-translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
