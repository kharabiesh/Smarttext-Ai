import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useNav } from "@/state/nav";
import { useSettings } from "@/state/settings";
import { LogoMark } from "@/components/Logo";
import { cx } from "@/components/ui/cx";
import { NAV_ITEMS } from "./navItems";

export function Sidebar() {
  const { t } = useT();
  const { page, go } = useNav();
  const collapsed = useSettings((s) => s.settings.sidebarCollapsed);
  const update = useSettings((s) => s.update);
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  return (
    <aside className={cx("flex h-full shrink-0 flex-col border-e border-border bg-surface transition-[width] duration-200", collapsed ? "w-[64px]" : "w-[232px]")}>
      <div className={cx("flex h-14 items-center gap-2.5 px-4", collapsed && "justify-center px-0")}>
        <LogoMark size={28} />
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <div className="text-[15px] font-semibold tracking-tight" dir="ltr">
              SmartText <span className="text-accent">AI</span>
            </div>
          </div>
        )}
      </div>
      <nav aria-label={t("nav.main")} className="flex-1 overflow-y-auto px-2.5 py-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ page: p, icon: Icon }, i) => {
            const active = page === p;
            return (
              <li key={p} className={cx(p === "settings" && "mt-4 border-t border-border pt-3")}>
                <button
                  type="button"
                  onClick={() => go(p)}
                  aria-current={active ? "page" : undefined}
                  title={`${t(`nav.${p}`)} (${isMac ? "⌘" : "Ctrl+"}${i + 1})`}
                  className={cx(
                    "group flex w-full items-center gap-3 rounded-lg px-2.5 h-9 text-[13.5px] font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{t(`nav.${p}`)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className={cx("border-t border-border p-2.5", collapsed ? "flex justify-center" : "")}>
        {!collapsed && <p className="px-2 pb-2 text-[11px] leading-4 text-muted">{t("app.credit")}</p>}
        <button
          type="button"
          onClick={() => update({ sidebarCollapsed: !collapsed })}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg"
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4 rtl:-scale-x-100" /> : <PanelLeftClose className="h-4 w-4 rtl:-scale-x-100" />}
        </button>
      </div>
    </aside>
  );
}
