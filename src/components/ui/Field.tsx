import { useId, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "./cx";

export function Field({ label, help, children, htmlFor }: { label: ReactNode; help?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-fg">
        {label}
      </label>
      {children}
      {help && <p className="text-[12px] leading-5 text-muted">{help}</p>}
    </div>
  );
}

const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

export function Select({ label, help, options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; help?: ReactNode; options: Array<{ value: string; label: string }> }) {
  const id = useId();
  const select = (
    <div className="relative">
      <select id={id} className={cx(control, "h-9 appearance-none pe-9 cursor-pointer", className)} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
  return label ? (
    <Field label={label} help={help} htmlFor={id}>
      {select}
    </Field>
  ) : (
    select
  );
}

export function Input({ label, help, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; help?: ReactNode }) {
  const id = useId();
  const input = <input id={id} className={cx(control, "h-9", className)} {...rest} />;
  return label ? (
    <Field label={label} help={help} htmlFor={id}>
      {input}
    </Field>
  ) : (
    input
  );
}

export const textareaClass = cx(control, "py-2.5 leading-7 resize-none");
