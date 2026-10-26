import { useId, useState, type ReactNode } from "react";
import { Download, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { ai } from "@/state/ai";
import { useChat } from "@/state/chat";
import { DEFAULT_SETTINGS, useSettings, type Theme } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { PROVIDER_IDS, type ProviderId } from "@/lib/ai/types";
import { providerHost, SUGGESTED_IMAGE_MODELS, SUGGESTED_TEXT_MODELS } from "@/lib/ai/registry";
import { secrets } from "@/lib/ai/secrets";
import { validateModelId } from "@/lib/text/validation";
import { openStore } from "@/lib/db";
import type { Language } from "@/i18n";
import { PageShell } from "./PageShell";
import { useAppInfo } from "./About";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProviderCard } from "@/components/settings/ProviderCard";

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-4 p-5">{children}</div>
    </Card>
  );
}

/** Free-text model id with suggestions (datalist) and optional live list from the provider. */
function ModelPicker({ label, value, suggestions, onChange, provider }: { label: string; value: string; suggestions: string[]; onChange(v: string): void; provider?: ProviderId }) {
  const { t } = useT();
  const listId = useId();
  const [loaded, setLoaded] = useState<string[]>([]);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const options = Array.from(new Set([...suggestions, ...loaded]));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <Field label={label} help={t("settings.modelHelp")} htmlFor={`${listId}-in`}>
            <input
              id={`${listId}-in`}
              list={listId}
              dir="ltr"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                try {
                  const m = validateModelId(draft);
                  onChange(m);
                  setError(null);
                } catch (e) {
                  setError(e);
                }
              }}
              className="h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </Field>
          <datalist id={listId}>
            {options.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
        {provider && (
          <Button
            className="mb-[22px]"
            loading={loading}
            icon={<Download className="h-4 w-4" />}
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                setLoaded(await ai.listModels(provider));
              } catch (e) {
                setError(e);
              } finally {
                setLoading(false);
              }
            }}
          >
            {t("settings.loadModels")}
          </Button>
        )}
      </div>
      {loaded.length > 0 && <p className="text-[12px] text-success">{t("settings.modelsLoaded", { count: loaded.length })}</p>}
      {!!error && <ErrorAlert error={error} />}
    </div>
  );
}

export function SettingsPage() {
  const { t } = useT();
  const { settings, update, keyStatus, reset } = useSettings();
  const toast = useToasts((s) => s.push);
  const clearChats = useChat((s) => s.clearAll);
  const info = useAppInfo();
  const [confirm, setConfirm] = useState<null | "history" | "chats" | "images" | "all">(null);

  const runClear = async () => {
    const store = await openStore();
    if (confirm === "history" || confirm === "all") await store.clearHistory();
    if (confirm === "chats" || confirm === "all") await clearChats();
    if (confirm === "images" || confirm === "all") await store.clearImages();
    if (confirm === "all") await reset();
    setConfirm(null);
    toast("success", t("settings.cleared"));
  };

  return (
    <PageShell>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="space-y-5">
        <Section title={t("settings.sections.general")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium">{t("settings.language")}</span>
              <Segmented<Language>
                label={t("settings.language")}
                value={settings.language}
                onChange={(language) => update({ language })}
                options={[
                  { value: "en", label: "English" },
                  { value: "ar", label: "العربية" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium">{t("settings.theme")}</span>
              <Segmented<Theme>
                label={t("settings.theme")}
                value={settings.theme}
                onChange={(theme) => update({ theme })}
                options={(["system", "light", "dark"] as const).map((v) => ({ value: v, label: t(`settings.themes.${v}`) }))}
              />
            </div>
          </div>
        </Section>

        <Section title={t("settings.sections.providers")} subtitle={secrets.canEdit() ? t("settings.keyHelpDesktop") : t("settings.keyHelpBrowser")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("settings.textProvider")}
              value={settings.textProvider}
              onChange={(e) => update({ textProvider: e.target.value as ProviderId })}
              options={PROVIDER_IDS.map((p) => ({ value: p, label: t(`settings.providerNames.${p}`) }))}
            />
          </div>
          <ModelPicker
            key={settings.textProvider}
            label={t("settings.textModel")}
            value={settings.textModels[settings.textProvider]}
            suggestions={SUGGESTED_TEXT_MODELS[settings.textProvider]}
            provider={settings.textProvider}
            onChange={(m) => update({ textModels: { ...settings.textModels, [settings.textProvider]: m } })}
          />
          <div className="space-y-3 pt-1">
            {PROVIDER_IDS.map((p) => (
              <ProviderCard key={p} provider={p} />
            ))}
          </div>
          <p className="text-[12.5px] text-muted">{t("settings.costNote")}</p>
        </Section>

        <Section title={t("settings.sections.image")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t("settings.imageProvider")}
              value={settings.imageProvider}
              onChange={(e) => update({ imageProvider: e.target.value as "openai" | "none" })}
              options={[
                { value: "openai", label: "OpenAI Images" },
                { value: "none", label: t("settings.imageNone") },
              ]}
            />
          </div>
          {settings.imageProvider === "openai" && (
            <>
              <ModelPicker label={t("settings.imageModel")} value={settings.imageModel} suggestions={SUGGESTED_IMAGE_MODELS} onChange={(imageModel) => update({ imageModel })} />
              {!keyStatus.openai && <p className="text-[12.5px] text-warning">{t("settings.imageNeedsKey")}</p>}
            </>
          )}
        </Section>

        <Section title={t("settings.sections.privacy")}>
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] leading-6 text-muted">
            {t("settings.dataNotice", { host: providerHost(settings.textProvider, settings.compatibleBaseUrl) })}
          </p>
          <div className="divide-y divide-border">
            <Toggle label={t("settings.historyEnabled")} checked={settings.historyEnabled} onChange={(v) => update({ historyEnabled: v })} />
            <Toggle label={t("settings.chatHistoryEnabled")} checked={settings.chatHistoryEnabled} onChange={(v) => update({ chatHistoryEnabled: v })} />
            <Toggle label={t("settings.imageHistoryEnabled")} checked={settings.imageHistoryEnabled} onChange={(v) => update({ imageHistoryEnabled: v })} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm("history")}>
              {t("settings.clearHistory")}
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm("chats")}>
              {t("settings.clearChats")}
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm("images")}>
              {t("settings.clearImages")}
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm("all")}>
              {t("settings.clearAll")}
            </Button>
          </div>
          <div className="text-[12.5px] text-muted">
            <span className="font-medium text-fg">{t("settings.storage")}: </span>
            {info?.dataDir ? <span dir="ltr">{t("settings.storageSqlite", { path: info.dataDir })}</span> : t("settings.storageMemory")}
          </div>
        </Section>

        <Section title={t("settings.sections.advanced")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              type="number"
              min={10}
              max={600}
              label={t("settings.timeout")}
              value={settings.timeoutSec}
              onChange={(e) => update({ timeoutSec: Math.min(600, Math.max(10, Number(e.target.value) || DEFAULT_SETTINGS.timeoutSec)) })}
            />
            <Select
              label={t("settings.retries")}
              help={t("settings.retriesHelp")}
              value={String(settings.maxRetries)}
              onChange={(e) => update({ maxRetries: Number(e.target.value) })}
              options={["0", "1", "2", "3", "4", "5"].map((v) => ({ value: v, label: v }))}
            />
          </div>
        </Section>

        <p className="pb-4 text-center text-[12.5px] text-muted">
          {t("app.credit")} · {t("settings.version", { version: info?.version ?? "—" })}
        </p>
      </div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === "all" ? t("settings.clearAll") : t("common.delete")}
        message={confirm === "all" ? t("settings.clearAllConfirm") : t("history.clearConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setConfirm(null)}
        onConfirm={runClear}
      />
    </PageShell>
  );
}
