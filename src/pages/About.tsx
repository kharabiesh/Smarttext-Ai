import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { isTauri, tauriInvoke } from "@/lib/platform";
import { PageShell } from "./PageShell";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "@/components/Logo";

export interface AppInfo {
  version: string;
  dataDir: string;
  platform: string;
  arch: string;
}

export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    if (isTauri()) void tauriInvoke<AppInfo>("app_info").then(setInfo).catch(() => setInfo(null));
    else setInfo({ version: __APP_VERSION__, dataDir: "", platform: "web (development)", arch: "" });
  }, []);
  return info;
}

export function AboutPage() {
  const { t } = useT();
  const info = useAppInfo();
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="overflow-hidden">
          <div className="relative bg-gradient-to-br from-indigo-500 via-violet-600 to-purple-700 px-8 py-10 text-white">
            <div className="flex items-center gap-5">
              <LogoMark size={76} className="drop-shadow-lg" />
              <div>
                <h1 className="text-[28px] font-semibold tracking-tight" dir="ltr">SmartText AI</h1>
                <p className="mt-1 text-[14px] text-white/85">{t("app.tagline")}</p>
              </div>
            </div>
          </div>
          <div className="space-y-6 p-8">
            <p className="text-[15px] leading-7">{t("about.description")}</p>

            <div className="rounded-2xl border border-border bg-gradient-to-br from-accent-soft to-transparent p-6 text-center" data-testid="developer-credit">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">{t("about.developer")}</p>
              <p className="mt-2 text-[24px] font-semibold tracking-tight" dir="ltr">{t("about.developerName")}</p>
              <p className="mt-1 text-[13px] text-muted">{t("app.credit")}</p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-[12px] text-muted">{t("about.version")}</dt>
                <dd className="mt-0.5 font-medium" dir="ltr">{info?.version ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">{t("about.platform")}</dt>
                <dd className="mt-0.5 font-medium" dir="ltr">{info ? `${info.platform}${info.arch ? ` · ${info.arch}` : ""}` : "—"}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">{t("about.license")}</dt>
                <dd className="mt-0.5 font-medium">{t("about.licenseValue")}</dd>
              </div>
            </dl>

            <div>
              <h2 className="mb-2 text-[14px] font-semibold">{t("about.principles")}</h2>
              <ul className="space-y-2">
                {(["1", "2", "3"] as const).map((n) => (
                  <li key={n} className="flex items-start gap-2 text-[14px]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                    {t(`about.principleList.${n}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="mb-2 text-[14px] font-semibold">{t("about.builtWith")}</h2>
              <p className="text-[13px] text-muted" dir="ltr">Tauri 2 · Rust · React · TypeScript · Tailwind CSS · SQLite</p>
            </div>
            <p className="border-t border-border pt-4 text-[12.5px] text-muted">{t("about.disclaimer")}</p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
