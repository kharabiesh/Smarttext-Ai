import { useCallback } from "react";
import { useSettings } from "@/state/settings";
import { dirFor, translate } from "./index";

export function useT() {
  const lang = useSettings((s) => s.settings.language);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { t, lang, dir: dirFor(lang) };
}
