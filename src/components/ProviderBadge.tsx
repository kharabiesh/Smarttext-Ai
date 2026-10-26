import { Lock, Send } from "lucide-react";
import { useT } from "@/i18n/useT";
import { providerHost } from "@/lib/ai/registry";
import { useSettings } from "@/state/settings";

/** Tells the user, next to every action button, where their text will be sent. */
export function ProviderBadge({ kind = "text" }: { kind?: "text" | "image" | "local" }) {
  const { t } = useT();
  const s = useSettings((st) => st.settings);
  if (kind === "local")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
        <Lock className="h-3.5 w-3.5" aria-hidden /> {t("common.localOnly")}
      </span>
    );
  const provider = kind === "image" ? (s.imageProvider === "none" ? null : s.imageProvider) : s.textProvider;
  if (!provider) return null;
  const host = providerHost(provider, s.compatibleBaseUrl);
  const model = kind === "image" ? s.imageModel : s.textModels[s.textProvider];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted" title={model}>
      <Send className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
      <span dir="ltr">{host}</span>
      <span className="opacity-60">·</span>
      <span dir="ltr" className="font-mono text-[11.5px]">{model}</span>
    </span>
  );
}

export function useSendsTo() {
  const s = useSettings((st) => st.settings);
  return providerHost(s.textProvider, s.compatibleBaseUrl);
}
