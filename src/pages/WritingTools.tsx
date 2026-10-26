import { useEffect, useMemo, useState } from "react";
import {
  Copy, Download, Eraser, Expand, FileText, Heading, Languages, Lightbulb, List, ListCollapse, Mail, Play, Repeat2, Shrink, SlidersHorizontal, SpellCheck2, Type, Wand2, type LucideIcon,
} from "lucide-react";
import { useT } from "@/i18n/useT";
import { ai } from "@/state/ai";
import { useNav } from "@/state/nav";
import { useSettings } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { TOOLS, defaultValues, getTool, type ToolDefinition, type ToolId, type ToolValues } from "@/lib/ai/tools";
import { validateText } from "@/lib/text/validation";
import { textDir } from "@/lib/text/direction";
import { copyText, saveText } from "@/lib/files";
import { newId } from "@/lib/id";
import { openStore } from "@/lib/db";
import { SAMPLE_TEXT } from "@/lib/samples";
import type { CompletionResult } from "@/lib/ai/types";
import { PageShell } from "./PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, textareaClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Markdown } from "@/components/Markdown";
import { TextStats } from "@/components/TextStats";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProviderBadge } from "@/components/ProviderBadge";
import { useAiTask } from "@/components/useAiTask";
import { cx } from "@/components/ui/cx";

export const TOOL_ICONS: Record<string, LucideIcon> = {
  Repeat2, ListCollapse, SpellCheck2, Type, Languages, SlidersHorizontal, Mail, Expand, Shrink, Heading, Lightbulb, List,
};

function ToolOptions({ tool, values, onChange }: { tool: ToolDefinition; values: ToolValues; onChange(v: ToolValues): void }) {
  const { t } = useT();
  if (!tool.options.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tool.options.map((o) => {
        // The email tool reuses the "tone" option labels.
        const labelKey = `tools.options.${o.id}`;
        if (o.kind === "text")
          return (
            <Input
              key={o.id}
              label={t(`${labelKey}.label`)}
              placeholder={t(`${labelKey}.placeholder`)}
              value={values[o.id] ?? ""}
              maxLength={o.maxLength}
              dir={textDir(values[o.id] ?? "")}
              onChange={(e) => onChange({ ...values, [o.id]: e.target.value })}
            />
          );
        return (
          <Select
            key={o.id}
            label={t(`${labelKey}.label`)}
            value={values[o.id] ?? o.default}
            onChange={(e) => onChange({ ...values, [o.id]: e.target.value })}
            options={o.values.map((v) => ({ value: v, label: t(`${labelKey}.${v}`) }))}
          />
        );
      })}
    </div>
  );
}

export function WritingToolsPage() {
  const { t, lang } = useT();
  const settings = useSettings((s) => s.settings);
  const markUsed = useSettings((s) => s.markUsed);
  const toast = useToasts((s) => s.push);
  const consume = useNav((s) => s.consume);
  const go = useNav((s) => s.go);
  const [toolId, setToolId] = useState<ToolId>("paraphrase");
  const tool = useMemo(() => getTool(toolId) ?? TOOLS[0], [toolId]);
  const [values, setValues] = useState<ToolValues>(() => defaultValues(TOOLS[0]));
  const [input, setInput] = useState("");
  const [result, setResult] = useState<CompletionResult | null>(null);
  const task = useAiTask<CompletionResult>();

  useEffect(() => {
    const p = consume();
    if (p?.tool && getTool(p.tool)) selectTool(p.tool as ToolId);
    if (p?.text) setInput(p.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectTool(id: ToolId) {
    const next = getTool(id);
    if (!next) return;
    setToolId(id);
    setValues(defaultValues(next));
    setResult(null);
    task.setError(null);
  }

  const run = async () => {
    const res = await task.execute(async () => {
      const text = validateText(input);
      const p = tool.build(text, values);
      return ai.complete({ system: p.system, messages: [{ role: "user", content: p.user }], maxTokens: 6000 });
    });
    if (!res) return;
    setResult(res);
    markUsed(tool.id);
    if (settings.historyEnabled) {
      const store = await openStore();
      await store.addHistory({ id: newId(), kind: "tool", tool: tool.id, input: input.trim(), output: res.text, options: { ...values }, model: res.model, createdAt: Date.now() });
    }
  };

  const Icon = TOOL_ICONS[tool.icon] ?? FileText;

  return (
    <PageShell wide>
      <PageHeader title={t("tools.title")} subtitle={t("tools.subtitle")} />
      <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
        <nav aria-label={t("tools.title")}>
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1">
            {TOOLS.map((tl) => {
              const I = TOOL_ICONS[tl.icon] ?? FileText;
              const active = tl.id === toolId;
              return (
                <li key={tl.id}>
                  <button
                    type="button"
                    onClick={() => selectTool(tl.id)}
                    aria-current={active ? "true" : undefined}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 h-10 text-start text-[13.5px] font-medium transition-colors",
                      active ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface hover:text-fg",
                    )}
                  >
                    <I className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{t(`tools.names.${tl.id}`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          <Card className="p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold">{t(`tools.names.${tool.id}`)}</h2>
                <p className="text-[13px] text-muted">{t(`tools.descriptions.${tool.id}`)}</p>
              </div>
            </div>
            <ToolOptions tool={tool} values={values} onChange={setValues} />
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="flex min-h-[360px] flex-col">
              <div className="flex h-12 items-center justify-between border-b border-border px-4">
                <h3 className="text-[14px] font-semibold">{t("tools.input")}</h3>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" icon={<FileText className="h-4 w-4" />} onClick={() => setInput(SAMPLE_TEXT[lang])}>
                    {t("common.sample")}
                  </Button>
                  <Button size="icon" variant="ghost" aria-label={t("common.clear")} title={t("common.clear")} onClick={() => setInput("")} disabled={!input}>
                    <Eraser className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <textarea
                aria-label={t("tools.input")}
                dir={textDir(input)}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t(`tools.placeholders.${tool.placeholderKey}`)}
                className={cx(textareaClass, "min-h-[240px] flex-1 rounded-none border-0 px-4 py-3 focus:ring-0")}
              />
              <div className="flex h-12 items-center justify-between gap-2 border-t border-border px-4">
                <TextStats text={input} />
                <Button variant="primary" icon={!task.loading ? <Play className="h-4 w-4 rtl:-scale-x-100" /> : undefined} loading={task.loading} disabled={!input.trim()} onClick={run}>
                  {t("tools.run")}
                </Button>
              </div>
            </Card>

            <Card className="flex min-h-[360px] flex-col">
              <div className="flex h-12 items-center justify-between border-b border-border px-4">
                <h3 className="text-[14px] font-semibold">{t("tools.output")}</h3>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" aria-label={t("nav.humanizer")} title={t("humanizer.run")} disabled={!result} onClick={() => result && go("humanizer", { text: result.text })}>
                    <Wand2 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("common.copy")}
                    title={t("common.copy")}
                    disabled={!result}
                    onClick={async () => {
                      if (!result) return;
                      await copyText(result.text);
                      toast("success", t("common.copied"));
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t("common.download")}
                    title={t("common.download")}
                    disabled={!result}
                    onClick={async () => {
                      if (!result) return;
                      const path = await saveText(`smarttext-${tool.id}.txt`, result.text);
                      if (path) toast("success", t("common.savedTo", { path }));
                    }}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {task.loading ? (
                  <div className="space-y-3" aria-busy="true">
                    {[90, 76, 95, 64].map((w, i) => (
                      <div key={i} className="h-3.5 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
                    ))}
                    <p className="pt-1 text-[12.5px] text-muted">{t("common.elapsed", { seconds: task.elapsed })}</p>
                  </div>
                ) : result ? (
                  <Markdown text={result.text} />
                ) : (
                  <EmptyState icon={<Icon className="h-6 w-6" />} title={t(`tools.names.${tool.id}`)} hint={t(`tools.descriptions.${tool.id}`)} />
                )}
              </div>
              <div className="flex h-12 items-center justify-between gap-2 border-t border-border px-4">
                <TextStats text={result?.text ?? ""} />
                {result?.usage?.inputTokens !== undefined && (
                  <span className="text-[12px] text-muted">{t("common.tokens", { input: result.usage.inputTokens ?? 0, output: result.usage.outputTokens ?? 0 })}</span>
                )}
              </div>
            </Card>
          </div>
          <ProviderBadge />
          <ErrorAlert error={task.error} onRetry={run} />
          {result?.truncated && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">{t("common.truncated")}</p>}
        </div>
      </div>
    </PageShell>
  );
}
