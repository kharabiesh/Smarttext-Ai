import { useT } from "@/i18n/useT";
import { countCharacters, countWords } from "@/lib/text/counts";

export function TextStats({ text }: { text: string }) {
  const { t } = useT();
  return (
    <span className="text-[12px] tabular-nums text-muted" aria-live="polite">
      {t("common.words", { count: countWords(text) })} · {t("common.characters", { count: countCharacters(text) })}
    </span>
  );
}
