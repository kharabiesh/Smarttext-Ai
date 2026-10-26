import { useEffect, useMemo, useState } from "react";
import { Copy, History as HistoryIcon, Search, Trash2, Wand2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useNav } from "@/state/nav";
import { useSettings } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { openStore, type HistoryEntry } from "@/lib/db";
import { copyText } from "@/lib/files";
import { PageShell } from "./PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { cx } from "@/components/ui/cx";

type Filter = "all" | "humanizer" | "tool";

export function HistoryPage() {
  const { t, lang } = useT();
  const enabled = useSettings((s) => s.settings.historyEnabled);
  const go = useNav((s) => s.go);
  const toast = useToasts((s) => s.push);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const reload = async () => setItems(await (await openStore()).listHistory());
  useEffect(() => {
    void reload();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => (filter === "all" || i.kind === filter) && (!q || i.input.toLowerCase().includes(q) || i.output.toLowerCase().includes(q)));
  }, [items, filter, query]);
  const current = visible.find((i) => i.id === selected) ?? visible[0];
  const fmt = new Intl.DateTimeFormat(lang === "ar" ? "ar-u-nu-latn" : "en", { dateStyle: "medium", timeStyle: "short" });
  const toolName = (e: HistoryEntry) => (e.kind === "humanizer" ? t("nav.humanizer") : t(`tools.names.${e.tool}`));

  return (
    <PageShell wide>
      <PageHeader
        title={t("history.title")}
        subtitle={t("history.subtitle")}
        actions={
          <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} disabled={!items.length} onClick={() => setConfirmClear(true)}>
            {t("history.clearAll")}
          </Button>
        }
      />
      {!enabled && <p className="mb-4 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">{t("history.disabled")}</p>}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented<Filter>
          label={t("history.title")}
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: t("history.filterAll") },
            { value: "humanizer", label: t("history.filterHumanizer") },
            { value: "tool", label: t("history.filterTools") },
          ]}
        />
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            aria-label={t("common.search")}
            className="h-9 w-full rounded-lg border border-border bg-surface ps-9 pe-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title={items.length ? t("common.noResults") : t("history.empty")} hint={items.length ? undefined : t("history.emptyHint")} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Card className="max-h-[calc(100vh-240px)] overflow-y-auto p-1.5">
            <ul>
              {visible.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(e.id)}
                    aria-current={current?.id === e.id ? "true" : undefined}
                    className={cx("w-full rounded-lg px-3 py-2.5 text-start transition-colors", current?.id === e.id ? "bg-accent-soft" : "hover:bg-surface-2")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={e.kind === "humanizer" ? "accent" : "neutral"}>{toolName(e)}</Badge>
                      <span className="text-[11.5px] text-muted">{fmt.format(e.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13px]" dir="auto">{e.input}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {current && (
            <Card className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="accent">{toolName(current)}</Badge>
                  {current.model && <span className="font-mono text-[11.5px] text-muted" dir="ltr">{current.model}</span>}
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" icon={<Wand2 className="h-4 w-4" />} onClick={() => go("humanizer", { text: current.output })}>
                    {t("history.reuse")}
                  </Button>
                  <Button
                    size="sm"
                    icon={<Copy className="h-4 w-4" />}
                    onClick={async () => {
                      await copyText(current.output);
                      toast("success", t("common.copied"));
                    }}
                  >
                    {t("common.copy")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={async () => {
                      await (await openStore()).deleteHistory(current.id);
                      await reload();
                    }}
                  >
                    {t("common.delete")}
                  </Button>
                </div>
              </div>
              <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">{t("history.input")}</h3>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-2 p-3 text-[14px] leading-7" dir="auto">{current.input}</p>
              <h3 className="mb-1.5 mt-4 text-[12px] font-semibold uppercase tracking-wide text-muted">{t("history.output")}</h3>
              <p className="whitespace-pre-wrap rounded-lg border border-border p-3 text-[14px] leading-7" dir="auto">{current.output}</p>
            </Card>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmClear}
        title={t("history.clearAll")}
        message={t("history.clearConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirmClear(false)}
        onConfirm={async () => {
          await (await openStore()).clearHistory();
          setConfirmClear(false);
          await reload();
        }}
      />
    </PageShell>
  );
}
