import { useEffect, useState } from "react";
import { ClipboardPaste, Copy, Download, Eraser, FileText, Redo2, Sparkles, Undo2, Wand2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { ai } from "@/state/ai";
import { useNav } from "@/state/nav";
import { useSettings } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { buildHumanizerPrompt, HUMANIZER_STYLES, type HumanizerOptions, type HumanizerStyle, type Strength } from "@/lib/ai/prompts";
import { validateText } from "@/lib/text/validation";
import { diffTexts } from "@/lib/text/diff";
import { textDir } from "@/lib/text/direction";
import { copyText, saveText } from "@/lib/files";
import { newId } from "@/lib/id";
import { SAMPLE_TEXT } from "@/lib/samples";
import { openStore } from "@/lib/db";
import type { CompletionResult } from "@/lib/ai/types";
import { PageShell } from "./PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { Select, textareaClass } from "@/components/ui/Field";
import { Toggle } from "@/components/ui/Toggle";
import { TextStats } from "@/components/TextStats";
import { DiffView } from "@/components/DiffView";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProviderBadge } from "@/components/ProviderBadge";
import { useAiTask } from "@/components/useAiTask";
import { useUndoable } from "@/components/useUndoable";
import { cx } from "@/components/ui/cx";

export function HumanizerPage() {
  const { t, lang } = useT();
  const settings = useSettings((s) => s.settings);
  const markUsed = useSettings((s) => s.markUsed);
  const toast = useToasts((s) => s.push);
  const consume = useNav((s) => s.consume);

  const [input, setInput] = useState("");
  const output = useUndoable("");
  const [view, setView] = useState<"side" | "changes">("side");
  const [opts, setOpts] = useState<HumanizerOptions>({ style: "professional", strength: 2, outputLanguage: "auto", fixGrammar: true, reduceRepetition: true });
  const [meta, setMeta] = useState<CompletionResult | null>(null);
  const [sourceOfOutput, setSourceOfOutput] = useState("");
  const task = useAiTask<CompletionResult>();

  useEffect(() => {
    const p = consume();
    if (p?.text) setInput(p.text);
  }, [consume]);

  const run = async () => {
    const res = await task.execute(async () => {
      const text = validateText(input);
      const prompt = buildHumanizerPrompt(text, opts);
      return ai.complete({ system: prompt.system, messages: [{ role: "user", content: prompt.user }], maxTokens: 8000 });
    });
    if (!res) return;
    output.commit(res.text);
    setMeta(res);
    setSourceOfOutput(input);
    markUsed("humanizer");
    if (settings.historyEnabled) {
      const store = await openStore();
      await store.addHistory({ id: newId(), kind: "humanizer", tool: "humanizer", input: input.trim(), output: res.text, options: { ...opts }, model: res.model, createdAt: Date.now() });
    }
  };

  const summary = output.value ? diffTexts(sourceOfOutput || input, output.value) : null;
  const inputDir = textDir(input);
  const outputDir = textDir(output.value);

  return (
    <PageShell wide>
      <PageHeader title={t("humanizer.title")} subtitle={t("humanizer.subtitle")} />

      <Card className="mb-4 p-4">
        <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[auto_auto_1fr]">
          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium">{t("humanizer.style")}</span>
            <Segmented<HumanizerStyle>
              label={t("humanizer.style")}
              value={opts.style}
              onChange={(style) => setOpts({ ...opts, style })}
              options={HUMANIZER_STYLES.map((s) => ({ value: s, label: t(`humanizer.styles.${s}`) }))}
            />
          </div>
          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium">{t("humanizer.strength")}</span>
            <Segmented<"1" | "2" | "3">
              label={t("humanizer.strength")}
              value={String(opts.strength) as "1" | "2" | "3"}
              onChange={(v) => setOpts({ ...opts, strength: Number(v) as Strength })}
              options={(["1", "2", "3"] as const).map((v) => ({ value: v, label: t(`humanizer.strengthLevels.${v}`), title: t(`humanizer.strengthHelp.${v}`) }))}
            />
            <p className="text-[12px] text-muted">{t(`humanizer.strengthHelp.${opts.strength}`)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-[520px] lg:justify-self-end">
            <Select
              label={t("humanizer.outputLanguage")}
              value={opts.outputLanguage}
              onChange={(e) => setOpts({ ...opts, outputLanguage: e.target.value as HumanizerOptions["outputLanguage"] })}
              options={(["auto", "en", "ar"] as const).map((v) => ({ value: v, label: t(`humanizer.languages.${v}`) }))}
            />
            <div className="space-y-1">
              <Toggle label={t("humanizer.fixGrammar")} checked={opts.fixGrammar} onChange={(v) => setOpts({ ...opts, fixGrammar: v })} />
              <Toggle label={t("humanizer.reduceRepetition")} checked={opts.reduceRepetition} onChange={(v) => setOpts({ ...opts, reduceRepetition: v })} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Original */}
        <Card className="flex min-h-[420px] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 h-12">
            <h2 className="text-[14px] font-semibold">{t("humanizer.original")}</h2>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" icon={<FileText className="h-4 w-4" />} onClick={() => setInput(SAMPLE_TEXT[lang])}>
                {t("common.sample")}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("common.paste")}
                title={t("common.paste")}
                onClick={async () => {
                  try {
                    setInput(await navigator.clipboard.readText());
                  } catch {
                    /* clipboard read not permitted */
                  }
                }}
              >
                <ClipboardPaste className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={t("common.clear")} title={t("common.clear")} onClick={() => setInput("")} disabled={!input}>
                <Eraser className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <textarea
            aria-label={t("humanizer.original")}
            dir={inputDir}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("humanizer.placeholder")}
            className={cx(textareaClass, "flex-1 rounded-none border-0 px-4 py-3 text-[14.5px] focus:ring-0 min-h-[300px]")}
          />
          <div className="flex items-center justify-between border-t border-border px-4 h-11">
            <TextStats text={input} />
          </div>
        </Card>

        {/* Revised */}
        <Card className="flex min-h-[420px] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 h-12">
            <div className="flex items-center gap-3">
              <h2 className="text-[14px] font-semibold">{t("humanizer.revised")}</h2>
              <Segmented<"side" | "changes">
                size="sm"
                label={t("humanizer.revised")}
                value={view}
                onChange={setView}
                options={[
                  { value: "side", label: t("humanizer.view.side") },
                  { value: "changes", label: t("humanizer.view.changes") },
                ]}
              />
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" aria-label={t("common.undo")} title={t("common.undo")} disabled={!output.canUndo} onClick={output.undo}>
                <Undo2 className="h-4 w-4 rtl:-scale-x-100" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={t("common.redo")} title={t("common.redo")} disabled={!output.canRedo} onClick={output.redo}>
                <Redo2 className="h-4 w-4 rtl:-scale-x-100" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t("common.copy")}
                title={t("common.copy")}
                disabled={!output.value}
                onClick={async () => {
                  await copyText(output.value);
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
                disabled={!output.value}
                onClick={async () => {
                  try {
                    const path = await saveText(t("humanizer.exportName"), output.value);
                    if (path) toast("success", t("common.savedTo", { path }));
                  } catch {
                    toast("error", t("errors.unknown"));
                  }
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {task.loading ? (
            <div className="flex-1 space-y-3 p-4" aria-busy="true" aria-label={t("common.loading")}>
              {[92, 84, 97, 70, 88, 60].map((w, i) => (
                <div key={i} className="h-3.5 animate-pulse rounded bg-surface-2" style={{ width: `${w}%` }} />
              ))}
              <p className="pt-2 text-[12.5px] text-muted">
                {t("common.loading")} {t("common.elapsed", { seconds: task.elapsed })}
              </p>
            </div>
          ) : view === "changes" && output.value ? (
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <DiffView original={sourceOfOutput} revised={output.value} />
            </div>
          ) : (
            <textarea
              aria-label={t("humanizer.revised")}
              dir={outputDir}
              value={output.value}
              onChange={(e) => output.set(e.target.value)}
              onBlur={(e) => output.commit(e.target.value)}
              placeholder={t("humanizer.outputPlaceholder")}
              className={cx(textareaClass, "flex-1 rounded-none border-0 px-4 py-3 text-[14.5px] focus:ring-0 min-h-[300px]")}
            />
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 h-11">
            <TextStats text={output.value} />
            {summary && !task.loading && (
              <span className="truncate text-[12px] text-muted">
                {t("humanizer.changeSummary", { added: summary.addedWords, removed: summary.removedWords, percent: summary.changedPercent })}
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <ProviderBadge />
        <div className="flex items-center gap-3">
          {meta?.usage?.inputTokens !== undefined && (
            <span className="text-[12px] text-muted">{t("common.tokens", { input: meta.usage.inputTokens ?? 0, output: meta.usage.outputTokens ?? 0 })}</span>
          )}
          <Button variant="primary" size="lg" icon={task.loading ? undefined : <Wand2 className="h-4 w-4" />} loading={task.loading} onClick={run} disabled={!input.trim()}>
            {t("humanizer.run")}
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <ErrorAlert error={task.error} onRetry={run} />
        {meta?.truncated && <p className="rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">{t("common.truncated")}</p>}
        <p className="flex items-start gap-2 text-[12.5px] text-muted">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("humanizer.meaningNote")}
        </p>
      </div>
    </PageShell>
  );
}
