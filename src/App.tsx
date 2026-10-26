import { useEffect, useState } from "react";
import { useT } from "@/i18n/useT";
import { dirFor } from "@/i18n";
import { openStore } from "@/lib/db";
import { refreshKeyStatus } from "@/state/keys";
import { logger } from "@/lib/logger";
import { PAGES, useNav, type Page } from "@/state/nav";
import { useSettings } from "@/state/settings";
import { Sidebar } from "@/app/Sidebar";
import { Toaster } from "@/components/Toaster";
import { LogoMark } from "@/components/Logo";
import { DashboardPage } from "@/pages/Dashboard";
import { HumanizerPage } from "@/pages/Humanizer";
import { ChatPage } from "@/pages/Chat";
import { WritingToolsPage } from "@/pages/WritingTools";
import { ImagePage } from "@/pages/ImageGenerator";
import { AnalysisPage } from "@/pages/TextAnalysis";
import { HistoryPage } from "@/pages/History";
import { SettingsPage } from "@/pages/Settings";
import { AboutPage } from "@/pages/About";

const PAGE_COMPONENTS: Record<Page, () => JSX.Element> = {
  dashboard: DashboardPage,
  humanizer: HumanizerPage,
  chat: ChatPage,
  tools: WritingToolsPage,
  image: ImagePage,
  analysis: AnalysisPage,
  history: HistoryPage,
  settings: SettingsPage,
  about: AboutPage,
};

function useSystemDark() {
  const [dark, setDark] = useState(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return dark;
}

export default function App() {
  const { loaded, settings, init } = useSettings();
  const page = useNav((s) => s.page);
  const go = useNav((s) => s.go);
  const { t } = useT();
  const systemDark = useSystemDark();

  useEffect(() => {
    openStore()
      .then(init)
      .catch((e) => logger.error("Store init failed", e));
    void refreshKeyStatus();
  }, [init]);

  // Theme and text direction live on <html> so dialogs, toasts and scrollbars follow them too.
  useEffect(() => {
    const dark = settings.theme === "dark" || (settings.theme === "system" && systemDark);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [settings.theme, systemDark]);
  useEffect(() => {
    document.documentElement.lang = settings.language;
    document.documentElement.dir = dirFor(settings.language);
  }, [settings.language]);

  // Ctrl/Cmd + 1…9 switches sections.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= PAGES.length) {
        e.preventDefault();
        go(PAGES[n - 1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!loaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <LogoMark size={48} className="animate-pulse" />
      </div>
    );
  }

  const PageComponent = PAGE_COMPONENTS[page];
  return (
    <div className="flex h-full overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        {t("app.skipToContent")}
      </a>
      <Sidebar />
      <main id="main" className="min-w-0 flex-1 overflow-hidden" tabIndex={-1}>
        <PageComponent key={page} />
      </main>
      <Toaster />
    </div>
  );
}
