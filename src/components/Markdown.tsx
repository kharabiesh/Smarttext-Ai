import { memo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import { copyText } from "@/lib/files";
import { useT } from "@/i18n/useT";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) return textOf((node as { props: { children?: ReactNode } }).props.children);
  return "";
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const { t } = useT();
  const [done, setDone] = useState(false);
  return (
    <div className="group relative my-2 rounded-lg border border-border bg-surface-2">
      <button
        type="button"
        onClick={async () => {
          await copyText(textOf(children));
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
        className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11.5px] text-muted opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
      >
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {t("chat.copyCode")}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

/**
 * Renders untrusted AI output as Markdown. Raw HTML is NOT rendered (react-markdown escapes it by default),
 * links open nothing automatically, and code is displayed, never executed.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md" dir="auto">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        skipHtml
        components={{
          pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
          a: ({ children, href }) => (
            <span className="text-accent underline" title={href}>
              {children}
            </span>
          ),
          img: ({ alt }) => <span className="text-muted">[{alt || "image"}]</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
