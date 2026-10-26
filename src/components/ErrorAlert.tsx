import { AlertTriangle } from "lucide-react";
import { useT } from "@/i18n/useT";
import { AiError } from "@/lib/ai/errors";
import { ValidationError } from "@/lib/text/validation";
import { useNav } from "@/state/nav";
import { Button } from "./ui/Button";

/** Localized message for any error thrown by the AI layer or input validation. Never shows credentials. */
export function useErrorMessage() {
  const { t } = useT();
  return (err: unknown): { message: string; detail?: string; settings: boolean } => {
    if (err instanceof ValidationError) return { message: t(`errors.validation.${err.code}`, { limit: err.limit ?? 0 }), settings: false };
    if (err instanceof AiError) {
      const settings = ["missing_key", "invalid_key", "not_configured", "invalid_base_url", "model_not_found", "keychain_unavailable"].includes(err.code);
      return { message: t(`errors.${err.code}`), detail: err.detail, settings };
    }
    return { message: t("errors.unknown"), settings: false };
  };
}

export function ErrorAlert({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const describe = useErrorMessage();
  if (!error) return null;
  const { message, detail, settings } = describe(error);
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm animate-fade-in">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{message}</p>
        {detail && <p className="mt-1 text-[12.5px] text-muted break-words" dir="auto">{t("errors.providerSaid", { detail })}</p>}
        {(settings || onRetry) && (
          <div className="mt-2 flex gap-2">
            {settings && (
              <Button size="sm" variant="secondary" onClick={() => go("settings")}>
                {t("common.openSettings")}
              </Button>
            )}
            {onRetry && (
              <Button size="sm" variant="ghost" onClick={onRetry}>
                {t("common.retry")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
