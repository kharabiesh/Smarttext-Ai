import { useEffect, useMemo, useState } from "react";
import { Download, ImageIcon, KeyRound, Sparkles, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { ai } from "@/state/ai";
import { useNav } from "@/state/nav";
import { imageProviderReady, useSettings } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { IMAGE_ADAPTERS } from "@/lib/ai/registry";
import { IMAGE_STYLES } from "@/lib/ai/imageStyles";
import { validateText, MAX_IMAGE_PROMPT_CHARS } from "@/lib/text/validation";
import { saveFile } from "@/lib/files";
import { newId } from "@/lib/id";
import { openStore, type ImageRecord } from "@/lib/db";
import type { AspectRatio, GeneratedImage } from "@/lib/ai/types";
import { PageShell } from "./PageShell";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Select, textareaClass } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProviderBadge } from "@/components/ProviderBadge";
import { useAiTask } from "@/components/useAiTask";
import { cx } from "@/components/ui/cx";
import { textDir } from "@/lib/text/direction";

function SetupScreen() {
  const { t } = useT();
  const go = useNav((s) => s.go);
  return (
    <Card className="mx-auto max-w-2xl p-8" data-testid="image-setup">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <KeyRound className="h-6 w-6" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{t("image.setupTitle")}</h2>
      <p className="mt-2 text-[14px] text-muted">{t("image.setupBody")}</p>
      <ol className="mt-5 space-y-3">
        {(["1", "2", "3"] as const).map((n) => (
          <li key={n} className="flex gap-3 text-[14px]">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-semibold text-accent-fg">{n}</span>
            <span>{t(`image.setupSteps.${n}`)}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">{t("image.setupNote")}</p>
      <Button variant="primary" className="mt-5" onClick={() => go("settings")}>
        {t("common.openSettings")}
      </Button>
    </Card>
  );
}

const dataUrl = (r: { base64: string; mimeType: string }) => `data:${r.mimeType};base64,${r.base64}`;

export function ImagePage() {
  const { t } = useT();
  const settings = useSettings((s) => s.settings);
  const keys = useSettings((s) => s.keyStatus);
  const markUsed = useSettings((s) => s.markUsed);
  const toast = useToasts((s) => s.push);
  const ready = imageProviderReady(settings, keys);
  const adapter = settings.imageProvider === "none" ? undefined : IMAGE_ADAPTERS[settings.imageProvider];
  const caps = useMemo(() => adapter?.capabilities(settings.imageModel), [adapter, settings.imageModel]);

  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("square");
  const [quality, setQuality] = useState("auto");
  const [style, setStyle] = useState("none");
  const [image, setImage] = useState<GeneratedImage | null>(null);
  const [history, setHistory] = useState<ImageRecord[]>([]);
  const task = useAiTask<GeneratedImage>();

  useEffect(() => {
    if (caps && !caps.qualities.includes(quality)) setQuality(caps.qualities[0]);
  }, [caps, quality]);

  useEffect(() => {
    void openStore().then((s) => s.listImages()).then(setHistory);
  }, []);

  if (!ready || !caps) {
    return (
      <PageShell>
        <PageHeader title={t("image.title")} subtitle={t("image.subtitle")} />
        <SetupScreen />
      </PageShell>
    );
  }

  const generate = async () => {
    const res = await task.execute(async () => {
      const p = validateText(prompt, MAX_IMAGE_PROMPT_CHARS);
      return ai.generateImage({ prompt: p, negativePrompt: caps.negativePrompt ? negative : undefined, aspect, quality, style });
    });
    if (!res) return;
    setImage(res);
    markUsed("image");
    if (settings.imageHistoryEnabled) {
      const rec: ImageRecord = { id: newId(), prompt: prompt.trim(), aspect, quality, style, model: settings.imageModel, size: res.size, base64: res.base64, mimeType: res.mimeType, revisedPrompt: res.revisedPrompt, createdAt: Date.now() };
      const store = await openStore();
      await store.addImage(rec);
      setHistory(await store.listImages());
    }
  };

  const save = async (img: { base64: string; mimeType: string }) => {
    try {
      const path = await saveFile({ defaultName: `smarttext-image-${Date.now()}.png`, base64: img.base64, mimeType: img.mimeType, filterName: "PNG image", extensions: ["png"] });
      if (path) toast("success", t("common.savedTo", { path }));
    } catch {
      toast("error", t("errors.unknown"));
    }
  };

  return (
    <PageShell wide>
      <PageHeader title={t("image.title")} subtitle={t("image.subtitle")} />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="space-y-4 p-5 self-start">
          <Field label={t("image.prompt")} htmlFor="img-prompt">
            <textarea id="img-prompt" rows={5} dir={textDir(prompt)} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={t("image.promptPlaceholder")} className={textareaClass} maxLength={MAX_IMAGE_PROMPT_CHARS} />
          </Field>
          <Field label={t("image.negative")} htmlFor="img-neg" help={caps.negativePrompt ? undefined : t("image.negativeUnsupported")}>
            <textarea id="img-neg" rows={2} dir={textDir(negative)} value={negative} onChange={(e) => setNegative(e.target.value)} disabled={!caps.negativePrompt} className={cx(textareaClass, "disabled:opacity-50")} />
          </Field>
          <div className="space-y-1.5">
            <span className="block text-[13px] font-medium">{t("image.aspect")}</span>
            <Segmented<AspectRatio>
              label={t("image.aspect")}
              value={aspect}
              onChange={setAspect}
              options={(["square", "landscape", "portrait"] as const).map((a) => ({ value: a, label: t(`image.aspects.${a}`), title: caps.sizes[a] }))}
            />
            <p className="text-[12px] text-muted" dir="ltr">{caps.sizes[aspect]}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={t("image.quality")} value={quality} onChange={(e) => setQuality(e.target.value)} options={caps.qualities.map((q) => ({ value: q, label: t(`image.qualities.${q}`) }))} />
            <Select label={t("image.style")} value={style} onChange={(e) => setStyle(e.target.value)} options={IMAGE_STYLES.map((s) => ({ value: s, label: t(`image.styles.${s}`) }))} />
          </div>
          <Button variant="primary" size="lg" className="w-full justify-center" icon={!task.loading ? <Sparkles className="h-4 w-4" /> : undefined} loading={task.loading} disabled={!prompt.trim()} onClick={generate}>
            {t("image.generate")}
          </Button>
          <div className="space-y-1">
            <ProviderBadge kind="image" />
            <p className="text-[12px] text-muted">{t("image.costNote")}</p>
          </div>
        </Card>

        <div className="min-w-0 space-y-5">
          <Card>
            <CardHeader
              title={t("image.result")}
              actions={
                image && (
                  <Button size="sm" icon={<Download className="h-4 w-4" />} onClick={() => save(image)}>
                    {t("image.save")}
                  </Button>
                )
              }
            />
            <div className="p-5">
              {task.loading ? (
                <div className="flex aspect-[4/3] max-h-[520px] w-full flex-col items-center justify-center gap-4 rounded-xl bg-surface-2" role="status">
                  <div className="h-1.5 w-56 overflow-hidden rounded-full bg-surface-3">
                    <div className="progress-indeterminate h-full w-1/3 rounded-full bg-accent" />
                  </div>
                  <p className="text-[13px] text-muted">{t("image.generating")}</p>
                  <p className="text-[12px] text-muted tabular-nums">{t("common.elapsed", { seconds: task.elapsed })}</p>
                </div>
              ) : image ? (
                <figure className="space-y-3">
                  <img src={dataUrl(image)} alt={prompt} className="mx-auto max-h-[560px] rounded-xl border border-border object-contain" />
                  {image.revisedPrompt && (
                    <figcaption className="text-[12.5px] text-muted">
                      <span className="font-medium text-fg">{t("image.revisedPrompt")}: </span>
                      <span dir="auto">{image.revisedPrompt}</span>
                    </figcaption>
                  )}
                </figure>
              ) : (
                <EmptyState icon={<ImageIcon className="h-6 w-6" />} title={t("image.result")} hint={t("image.emptyResult")} />
              )}
              <div className="mt-3">
                <ErrorAlert error={task.error} onRetry={generate} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("image.history")} subtitle={!settings.imageHistoryEnabled ? t("image.historyOff") : undefined} />
            <div className="p-4">
              {history.length === 0 ? (
                <p className="px-1 py-4 text-[13px] text-muted">{t("image.historyEmpty")}</p>
              ) : (
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {history.map((h) => (
                    <li key={h.id} className="group relative overflow-hidden rounded-lg border border-border">
                      <button type="button" className="block w-full" onClick={() => setImage({ base64: h.base64, mimeType: h.mimeType, revisedPrompt: h.revisedPrompt, size: h.size })} title={h.prompt}>
                        <img src={dataUrl(h)} alt={h.prompt} className="aspect-square w-full object-cover" loading="lazy" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button className="rounded-md bg-black/40 p-1.5 text-white hover:bg-black/60" aria-label={t("image.save")} onClick={() => save(h)}>
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md bg-black/40 p-1.5 text-white hover:bg-black/60"
                          aria-label={t("common.delete")}
                          onClick={async () => {
                            const store = await openStore();
                            await store.deleteImage(h.id);
                            setHistory(await store.listImages());
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
