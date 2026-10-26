import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/** Scrollable page container with consistent padding. `fill` pages manage their own scrolling (chat). */
export function PageShell({ children, fill, wide }: { children: ReactNode; fill?: boolean; wide?: boolean }) {
  return (
    <div className={cx("h-full", fill ? "flex flex-col overflow-hidden" : "overflow-y-auto")}>
      <div className={cx("mx-auto w-full px-7 py-6 animate-fade-in", wide ? "max-w-[1400px]" : "max-w-[1180px]", fill && "flex min-h-0 flex-1 flex-col")}>
        {children}
      </div>
    </div>
  );
}
