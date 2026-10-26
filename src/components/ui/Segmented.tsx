import { useRef, type KeyboardEvent } from "react";
import { cx } from "./cx";

/** Accessible single-choice control (radiogroup with roving focus and arrow-key navigation). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
}: {
  value: T;
  onChange(v: T): void;
  options: Array<{ value: T; label: string; title?: string }>;
  label: string;
  size?: "sm" | "md";
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    let next = -1;
    if (e.key === fwd || e.key === "ArrowDown") next = (i + 1) % options.length;
    if (e.key === back || e.key === "ArrowUp") next = (i - 1 + options.length) % options.length;
    if (next >= 0) {
      e.preventDefault();
      onChange(options[next].value);
      refs.current[next]?.focus();
    }
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-lg bg-surface-2 p-0.5 gap-0.5">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-md font-medium transition-colors",
              size === "sm" ? "px-2.5 h-7 text-[12.5px]" : "px-3 h-8 text-[13px]",
              active ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
