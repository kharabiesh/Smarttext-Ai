import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDashed, History, ImageIcon, MessagesSquare, PenLine, ScanSearch, Wand2, XCircle, type LucideIcon } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useNav, type Page } from "@/state/nav";
import { imageProviderReady, textProviderReady, useSettings } from "@/state/settings";
import { useChat } from "@/state/chat";
import { openStore, type HistoryEntry } from "@/lib/db";
import { getTool } from "@/lib/ai/tools";
import { providerHost } from "@/lib/ai/registry";
import { PageShell } from "./PageShell";
import { TOOL_ICONS } from "./WritingTools";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { LogoMark } from "@/components/Logo";

const FEATURES: Array<{ page: Page; icon: LucideIcon; key: string }> = [
  { page: "humanizer", icon: Wand2, key: "humanizer" },
  { page: "chat", icon: MessagesSquare, key: "chat" },
  { page: "tools", icon: PenLine, key: "tools" },
  { page: "image", icon: ImageIcon, key: "image" },
  { page: "analysis", icon: ScanSearch, key: "analysis" },
  { page: "history", icon: History, key: "history" },
];

function StatusRow({ label, state, detail }: { label: string; state: "ok" | "off" | "na"; detail: string }) {
  const Icon = state === "ok" ? CheckCircle2 : state === "off" ? XCircle : CircleDashed;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2.5 text-[13.5px]">
        <Icon className={state === "ok" ? "h-4 w-4 text-success" : state === "off" ? "h-4 w-4 text-warning" : "h-4 w-4 text-muted"} aria-hidden />
        {label}
      </span>
      <span className="truncate text-[12.5px] text-muted" dir="auto">{detail}</span>
    </li>
  );
}

export function DashboardPage() {
  const { t, lang } = useT();
  const go = useNav((s) => s.go);
  const settings = useSettings((s) => s.settings);
  const keys = useSettings((s) => s.keyStatus);
  const chat = useChat();
  const [recent, setRecent] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    void chat.load();
    void openStore().then((s) => s.listHistory(5)).then(setRecent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const textReady = textProviderReady(settings, keys);
  const imageReady = imageProviderReady(settings, keys);
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", { dateStyle: "medium", timeStyle: "short" });

  type RecentItem = { id: string; title: string; label: string; at: number; open(): void };
  const recentItems: RecentItem[] = [
    ...recent.map((h) => ({
      id: h.id,
      title: h.input,
      label: h.kind === "humanizer" ? t("nav.humanizer") : t(`tools.names.${h.tool}`),
      at: h.createdAt,
      open: () => go("history"),
    })),
    ...chat.conversations.slice(0, 5).map((c) => ({ id: c.id, title: c.title, label: t("dashboard.conversation"), at: c.updatedAt, open: () => go("chat", { conversationId: c.id }) })),
  ]
    .sort((a, b) => b.at - a.at)
    .slice(0, 6);

  return (
    <PageShell>
      <section className="relative mb-6 overflow-hidden rounded-2xl border border-border bg-surface p-7 shadow-card">
        <div className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex items-center gap-5">
          <LogoMark size={56} />
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight">{t("dashboard.welcome")}</h1>
            <p className="mt-1 text-[14px] text-muted">{t("dashboard.subtitle")}</p>
          </div>
        </div>
        {!textReady && (
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-warning-soft px-4 py-3">
            <p className="text-[13.5px] text-warning">{t("dashboard.setupHint")}</p>
            <Button size="sm" variant="secondary" onClick={() => go("settings")}>
              {t("common.openSettings")}
            </Button>
          </div>
        )}
      </section>

      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">{t("dashboard.quickAccess")}</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ page, icon: Icon, key }) => (
          <button
            key={page}
            type="button"
            onClick={() => go(page)}
            className="group flex items-start gap-3.5 rounded-xl border border-border bg-surface p-4 text-start shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14.5px] font-semibold">{t(`nav.${page}`)}</span>
                <ArrowRight className="h-4 w-4 text-muted opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" aria-hidden />
              </div>
              <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{t(`dashboard.cards.${key}`)}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title={t("dashboard.recentTools")} />
            <div className="flex flex-wrap gap-2 p-4">
              {settings.recentTools.length === 0 && <p className="text-[13px] text-muted">{t("dashboard.noRecent")}</p>}
              {settings.recentTools.map((id) => {
                const tool = getTool(id);
                const Icon = tool ? TOOL_ICONS[tool.icon] : FEATURES.find((f) => f.page === id)?.icon ?? Wand2;
                const label = tool ? t(`tools.names.${id}`) : t(`nav.${id}`);
                return (
                  <Button key={id} variant="subtle" size="sm" icon={Icon ? <Icon className="h-4 w-4" /> : undefined} onClick={() => (tool ? go("tools", { tool: id }) : go(id as Page))}>
                    {label}
                  </Button>
                );
              })}
            </div>
          </Card>
          <Card>
            <CardHeader title={t("dashboard.recentItems")} />
            <ul className="divide-y divide-border">
              {recentItems.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">{t("dashboard.noRecent")}</li>}
              {recentItems.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={r.open} className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-surface-2">
                    <Badge tone="accent">{r.label}</Badge>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]" dir="auto">{r.title}</span>
                    <span className="shrink-0 text-[12px] text-muted">{fmt.format(r.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card className="self-start">
          <CardHeader title={t("dashboard.services")} />
          <ul className="divide-y divide-border px-5">
            <StatusRow
              label={t("dashboard.textService")}
              state={textReady ? "ok" : "off"}
              detail={textReady ? `${providerHost(settings.textProvider, settings.compatibleBaseUrl)} · ${settings.textModels[settings.textProvider]}` : t("common.notConfigured")}
            />
            <StatusRow label={t("dashboard.imageService")} state={imageReady ? "ok" : "off"} detail={imageReady ? `api.openai.com · ${settings.imageModel}` : t("common.notConfigured")} />
            <StatusRow label={t("dashboard.similarityService")} state="ok" detail={t("dashboard.availableLocal")} />
            <StatusRow label={t("dashboard.detectionService")} state="na" detail={t("dashboard.noDetector")} />
          </ul>
        </Card>
      </div>
    </PageShell>
  );
}
