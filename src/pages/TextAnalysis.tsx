import { useState } from "react";
import { FileSearch, Info, ShieldQuestion } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useSettings } from "@/state/settings";
import { compareTexts, similarityLevel, type SimilarityReport } from "@/lib/text/similarity";
import { validateText } from "@/lib/text/validation";
import { textDir } from "@/lib/text/direction";
import { DETECTION_PROVIDERS } from "@/lib/ai/detection";
import { PageShell } from "./PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, textareaClass } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Badge } from "@/components/ui/Badge";
import { TextStats } from "@/components/TextStats";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProviderBadge } from "@/components/ProviderBadge";
import { cx } from "@/components/ui/cx";

function Meter({ label, help, value }: { label: string; help: string; value: number }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <span className="text-xl font-semibold tabular-nums" dir="ltr">{value}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={cx("h-full rounded-full", value >= 50 ? "bg-danger" : value >= 15 ? "bg-warning" : "bg-success")} style={{ width: `${Math.max(2, value)}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-muted">{help}</p>
    </div>
  );
}

function SimilarityTab() {
  const { t } = useT();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [report, setReport] = useState<SimilarityReport | null>(null);
  const [error, setError] = useState<unknown>(null);
  const markUsed = useSettings((s) => s.markUsed);

  const run = () => {
    try {
      setError(null);
      setReport(compareTexts(validateText(a), validateText(b)));
      markUsed("analysis");
    } catch (e) {
      setError(e);
      setReport(null);
    }
  };
  const level = report ? similarityLevel(report) : null;

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[13px] text-fg">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        {t("analysis.localNotice")}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {([["docA", a, setA], ["docB", b, setB]] as const).map(([key, value, set]) => (
          <Card key={key} className="p-4">
            <Field label={t(`analysis.${key}`)} htmlFor={`doc-${key}`}>
              <textarea id={`doc-${key}`} rows={10} dir={textDir(value)} value={value} onChange={(e) => set(e.target.value)} placeholder={t("analysis.docPlaceholder")} className={textareaClass} />
            </Field>
            <div className="mt-2">
              <TextStats text={value} />
            </div>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProviderBadge kind="local" />
        <Button variant="primary" icon={<FileSearch className="h-4 w-4" />} onClick={run} disabled={!a.trim() || !b.trim()}>
          {t("analysis.compare")}
        </Button>
      </div>
      <ErrorAlert error={error} />
      {report && level && (
        <Card className="animate-fade-in" data-testid="similarity-report">
          <CardHeader title={t("analysis.results")} actions={<Badge tone={level === "high" ? "danger" : level === "moderate" ? "warning" : "success"}>{t(`analysis.level.${level}`)}</Badge>} />
          <div className="space-y-5 p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Meter label={t("analysis.phraseOverlap")} help={t("analysis.phraseOverlapHelp")} value={report.phraseOverlap} />
              <Meter label={t("analysis.containmentA")} help={t("analysis.containmentAHelp")} value={report.containmentAinB} />
              <Meter label={t("analysis.containmentB")} help={t("analysis.containmentBHelp")} value={report.containmentBinA} />
              <Meter label={t("analysis.vocabulary")} help={t("analysis.vocabularyHelp")} value={report.vocabularySimilarity} />
            </div>
            <div>
              <h3 className="mb-2 text-[14px] font-semibold">{t("analysis.passages")}</h3>
              {report.sharedPassages.length === 0 ? (
                <p className="text-[13px] text-muted">{t("analysis.noPassages")}</p>
              ) : (
                <ul className="space-y-2">
                  {report.sharedPassages.slice(0, 20).map((p, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[13.5px]">
                      <span dir="auto" className="leading-7">“{p.text}”</span>
                      <Badge>{t("analysis.passageWords", { count: p.words })}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[12.5px] text-muted">{t("analysis.interpretation")}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function DetectionTab() {
  const { t } = useT();
  return (
    <Card className="max-w-3xl p-6" data-testid="detection-panel">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-2 text-muted">
        <ShieldQuestion className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-[16px] font-semibold">{t("analysis.detectionTitle")}</h2>
      <p className="mt-2 text-[14px] leading-7 text-muted">{t("analysis.detectionBody")}</p>
      <p className="mt-3 text-[14px] leading-7 text-muted">{t("analysis.detectionHow")}</p>
      <div className="mt-4">
        <Badge tone="warning">{DETECTION_PROVIDERS.length === 0 ? t("analysis.detectionStatus") : DETECTION_PROVIDERS.map((p) => p.name).join(", ")}</Badge>
      </div>
    </Card>
  );
}

export function AnalysisPage() {
  const { t } = useT();
  const [tab, setTab] = useState<"similarity" | "detection">("similarity");
  return (
    <PageShell wide>
      <PageHeader
        title={t("analysis.title")}
        subtitle={t("analysis.subtitle")}
        actions={
          <Segmented<"similarity" | "detection">
            label={t("analysis.title")}
            value={tab}
            onChange={setTab}
            options={[
              { value: "similarity", label: t("analysis.tabs.similarity") },
              { value: "detection", label: t("analysis.tabs.detection") },
            ]}
          />
        }
      />
      {tab === "similarity" ? <SimilarityTab /> : <DetectionTab />}
    </PageShell>
  );
}
