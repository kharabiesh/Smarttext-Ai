import { useEffect, useRef, useState } from "react";
import { Check, Copy, MessageSquarePlus, MessagesSquare, Pencil, RefreshCw, SendHorizonal, Trash2 } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useChat } from "@/state/chat";
import { useNav } from "@/state/nav";
import { useSettings } from "@/state/settings";
import { useToasts } from "@/state/toast";
import { copyText } from "@/lib/files";
import { textDir } from "@/lib/text/direction";
import type { ChatMessage } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input, textareaClass } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { Markdown } from "@/components/Markdown";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProviderBadge } from "@/components/ProviderBadge";
import { LogoMark } from "@/components/Logo";
import { cx } from "@/components/ui/cx";

function MessageBubble({ m, last, onRegenerate }: { m: ChatMessage; last: boolean; onRegenerate(): void }) {
  const { t } = useT();
  const toast = useToasts((s) => s.push);
  const [copied, setCopied] = useState(false);
  const mine = m.role === "user";
  return (
    <div className={cx("group flex gap-3 animate-fade-in", mine && "flex-row-reverse")}>
      <div className={cx("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold", mine ? "bg-surface-3 text-fg" : "")}>
        {mine ? t("chat.you").slice(0, 1) : <LogoMark size={30} />}
      </div>
      <div className={cx("min-w-0 max-w-[78%]", mine && "flex flex-col items-end")}>
        <div className={cx("rounded-2xl px-4 py-2.5 text-[14.5px]", mine ? "bg-accent text-accent-fg whitespace-pre-wrap" : "bg-surface border border-border")} dir="auto">
          {mine ? m.content : <Markdown text={m.content} />}
        </div>
        {!mine && (
          <div className="mt-1 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              icon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              onClick={async () => {
                await copyText(m.content);
                setCopied(true);
                toast("success", t("common.copied"));
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {t("common.copy")}
            </Button>
            {last && (
              <Button size="sm" variant="ghost" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={onRegenerate}>
                {t("chat.regenerate")}
              </Button>
            )}
            {m.model && <span className="px-1 font-mono text-[11px] text-muted" dir="ltr">{m.model}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPage() {
  const { t } = useT();
  const chat = useChat();
  const historyOn = useSettings((s) => s.settings.chatHistoryEnabled);
  const consume = useNav((s) => s.consume);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<unknown>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void chat.load().then(() => {
      const p = consume();
      if (p?.conversationId) chat.select(p.conversationId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = chat.conversations.find((c) => c.id === chat.activeId) ?? null;
  const messages = active?.messages ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, chat.pending]);

  const send = async () => {
    const text = draft;
    if (!text.trim() || chat.pending) return;
    setValidationError(null);
    try {
      setDraft("");
      await chat.send(text);
    } catch (e) {
      setDraft(text);
      setValidationError(e);
    }
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full">
      {/* Conversation list */}
      <section aria-label={t("chat.conversations")} className="flex w-[260px] shrink-0 flex-col border-e border-border bg-surface/60">
        <div className="p-3">
          <Button variant="primary" className="w-full justify-center" icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => { chat.newConversation(); inputRef.current?.focus(); }}>
            {t("chat.newChat")}
          </Button>
        </div>
        <h2 className="px-4 pb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{t("chat.conversations")}</h2>
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {chat.conversations.length === 0 && <li className="px-2 py-3 text-[13px] text-muted">{t("chat.noConversations")}</li>}
          {chat.conversations.map((c) => (
            <li key={c.id} className="group relative">
              <button
                type="button"
                onClick={() => chat.select(c.id)}
                aria-current={c.id === chat.activeId ? "true" : undefined}
                className={cx(
                  "flex w-full items-center rounded-lg px-2.5 py-2 text-start text-[13.5px] transition-colors pe-16",
                  c.id === chat.activeId ? "bg-accent-soft text-accent font-medium" : "text-fg hover:bg-surface-2",
                )}
              >
                <span className="truncate" dir="auto">{c.title}</span>
              </button>
              <div className="absolute end-1 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button className="rounded p-1.5 text-muted hover:text-fg" aria-label={`${t("common.rename")}: ${c.title}`} title={t("common.rename")} onClick={() => setRenaming({ id: c.id, title: c.title })}>
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1.5 text-muted hover:text-danger" aria-label={`${t("common.delete")}: ${c.title}`} title={t("common.delete")} onClick={() => setDeleting(c.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Messages */}
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border px-6">
          <h1 className="truncate text-[15px] font-semibold" dir="auto">{active?.title ?? t("chat.title")}</h1>
          <ProviderBadge />
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6" aria-live="polite">
          <div className="mx-auto max-w-[860px] space-y-5">
            {messages.length === 0 && !chat.pending && (
              <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={t("chat.empty")} hint={t("chat.emptyHint")} />
            )}
            {messages.map((m, i) => (
              <MessageBubble key={m.id} m={m} last={i === messages.length - 1 && m.role === "assistant" && !chat.pending} onRegenerate={() => void chat.regenerate()} />
            ))}
            {chat.pending && (
              <div className="flex items-center gap-3 text-[13.5px] text-muted" role="status">
                <LogoMark size={30} />
                <span className="inline-flex items-center gap-1">
                  {t("chat.thinking")}
                  <span className="inline-flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 120}ms` }} />
                    ))}
                  </span>
                </span>
              </div>
            )}
            {!!chat.error && <ErrorAlert error={chat.error} onRetry={() => void chat.regenerate()} />}
            <div ref={endRef} />
          </div>
        </div>
        <footer className="border-t border-border px-6 py-4">
          <div className="mx-auto max-w-[860px]">
            {!!validationError && <div className="mb-2"><ErrorAlert error={validationError} /></div>}
            {!historyOn && <p className="mb-2 text-[12px] text-warning">{t("chat.historyOff")}</p>}
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 shadow-card focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <textarea
                ref={inputRef}
                rows={2}
                dir={textDir(draft)}
                value={draft}
                aria-label={t("chat.placeholder")}
                placeholder={t("chat.placeholder")}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
                className={cx(textareaClass, "max-h-48 min-h-[44px] flex-1 border-0 bg-transparent px-2 py-1.5 focus:ring-0 focus-visible:outline-none")}
              />
              <Button variant="primary" size="icon" className="h-10 w-10 rounded-xl" aria-label={t("chat.send")} title={t("chat.send")} loading={chat.pending} disabled={!draft.trim()} onClick={() => void send()}>
                {!chat.pending && <SendHorizonal className="h-4 w-4 rtl:-scale-x-100" />}
              </Button>
            </div>
          </div>
        </footer>
      </section>

      <Dialog
        open={!!renaming}
        title={t("common.rename")}
        onClose={() => setRenaming(null)}
        actions={
          <>
            <Button onClick={() => setRenaming(null)}>{t("common.cancel")}</Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (renaming) await chat.rename(renaming.id, renaming.title);
                setRenaming(null);
              }}
            >
              {t("common.save")}
            </Button>
          </>
        }
      >
        {renaming && <Input label={t("chat.renamePrompt")} value={renaming.title} onChange={(e) => setRenaming({ ...renaming, title: e.target.value })} dir={textDir(renaming.title)} maxLength={120} />}
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        title={t("common.delete")}
        message={t("chat.deleteConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await chat.remove(deleting);
          setDeleting(null);
        }}
      />
    </div>
  );
}
