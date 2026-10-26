import { useState } from "react";
import { CheckCircle2, KeyRound, PlugZap, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { ai } from "@/state/ai";
import { useSettings } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { secrets } from "@/lib/ai/secrets";
import type { ProviderId } from "@/lib/ai/types";
import { validateApiKeyInput, validateBaseUrl } from "@/lib/text/validation";
import { refreshKeyStatus } from "@/state/keys";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { ErrorAlert } from "@/components/ErrorAlert";

/** Credential + connection settings for one provider. The key input is write-only: stored keys are never displayed. */
export function ProviderCard({ provider }: { provider: ProviderId }) {
  const { t } = useT();
  const toast = useToasts((s) => s.push);
  const hasKey = useSettings((s) => s.keyStatus[provider]);
  const baseUrl = useSettings((s) => s.settings.compatibleBaseUrl);
  const update = useSettings((s) => s.update);
  const [key, setKey] = useState("");
  const [url, setUrl] = useState(baseUrl);
  const [busy, setBusy] = useState<"save" | "remove" | "test" | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [testResult, setTestResult] = useState<number | null>(null);
  const editable = secrets.canEdit();
  const optional = provider === "openai_compatible";

  const act = async (kind: "save" | "remove" | "test", fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border p-4" data-testid={`provider-${provider}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-[14.5px] font-semibold">{t(`settings.providerNames.${provider}`)}</h3>
          <p className="mt-0.5 text-[12.5px] text-muted">{t(`settings.providerHelp.${provider}`)}</p>
        </div>
        {hasKey ? (
          <Badge tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>{t("settings.keySaved")}</Badge>
        ) : (
          <Badge tone={optional ? "neutral" : "warning"}>{optional ? t("settings.keyOptional") : t("settings.keyMissing")}</Badge>
        )}
      </div>

      {provider === "openai_compatible" && (
        <div className="mt-3">
          <Input
            label={t("settings.baseUrl")}
            help={t("settings.baseUrlHelp")}
            dir="ltr"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => {
              try {
                const clean = validateBaseUrl(url);
                setUrl(clean);
                update({ compatibleBaseUrl: clean });
                setError(null);
              } catch (e) {
                setError(e);
              }
            }}
          />
        </div>
      )}

      {editable ? (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[240px] flex-1">
            <Input
              label={t("settings.apiKey")}
              type="password"
              autoComplete="off"
              spellCheck={false}
              dir="ltr"
              placeholder={t("settings.keyPlaceholder")}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <Button
            variant="primary"
            icon={<KeyRound className="h-4 w-4" />}
            loading={busy === "save"}
            disabled={!key.trim()}
            onClick={() =>
              act("save", async () => {
                await secrets.set(provider, validateApiKeyInput(key));
                setKey("");
                await refreshKeyStatus();
                toast("success", t("settings.keyStored"));
              })
            }
          >
            {hasKey ? t("settings.replaceKey") : t("settings.saveKey")}
          </Button>
          {hasKey && (
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              loading={busy === "remove"}
              onClick={() =>
                act("remove", async () => {
                  await secrets.remove(provider);
                  await refreshKeyStatus();
                  toast("info", t("settings.keyRemoved"));
                })
              }
            >
              {t("settings.removeKey")}
            </Button>
          )}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-muted">{t("settings.keyHelpBrowser")}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          icon={<PlugZap className="h-4 w-4" />}
          loading={busy === "test"}
          onClick={() =>
            act("test", async () => {
              setTestResult(null);
              const models = await ai.listModels(provider);
              setTestResult(models.length);
            })
          }
        >
          {busy === "test" ? t("settings.testing") : t("settings.testConnection")}
        </Button>
        {testResult !== null && !error && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-success" role="status">
            <CheckCircle2 className="h-4 w-4" /> {t("settings.testOk", { count: testResult })}
          </span>
        )}
      </div>
      {!!error && (
        <div className="mt-3">
          <ErrorAlert error={error} />
        </div>
      )}
    </div>
  );
}
