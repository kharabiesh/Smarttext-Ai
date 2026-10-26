import { useMemo } from "react";
import { diffTexts } from "@/lib/text/diff";
import { textDir } from "@/lib/text/direction";

export function DiffView({ original, revised }: { original: string; revised: string }) {
  const diff = useMemo(() => diffTexts(original, revised), [original, revised]);
  return (
    <div dir={textDir(revised || original)} className="whitespace-pre-wrap leading-8 text-[14.5px]" data-testid="diff-view">
      {diff.parts.map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.value}</span>
        ) : p.type === "added" ? (
          <ins key={i} className="diff-added">
            {p.value}
          </ins>
        ) : (
          <del key={i} className="diff-removed">
            {p.value}
          </del>
        ),
      )}
    </div>
  );
}
