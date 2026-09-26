"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { askLibraryAssistant, type AssistantChatMessage } from "@/lib/actions/assistant";

/**
 * Floating bottom-corner AI assistant, shown on every signed-in dashboard
 * (wired in app/admin/layout.tsx and app/student/layout.tsx). Click to open,
 * ask about books/availability/fines/dues — answers come from real live
 * data (Sanity catalog + MongoDB), scoped to the signed-in user's role by
 * the server action itself (a student never sees another student's data).
 */
export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send() {
    const question = input.trim();
    if (!question || pending) return;

    setInput("");
    setError(null);
    const nextHistory = [...messages, { role: "user" as const, content: question }];
    setMessages(nextHistory);
    setPending(true);

    try {
      const result = await askLibraryAssistant(question, messages);
      if ("error" in result) {
        setError(result.error);
      } else {
        setMessages([...nextHistory, { role: "assistant", content: result.answer }]);
      }
    } catch (err) {
      // Network drop, server action threw, etc. — never let this escape
      // unhandled and risk taking the whole page down with it.
      console.error("Assistant widget request failed:", err);
      setError("Couldn't reach the assistant — check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
      {open && (
        <div className="mb-3 flex h-[28rem] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between gap-2 bg-ink-950 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-medium">Library Assistant</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                Hi! Ask me about books, availability, dues or fines — I'll answer using the library's live data.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                {m.content}
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about a book, dues, fine…"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
            />
            <button
              type="button"
              onClick={send}
              disabled={pending || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-white transition disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-ink-950 text-white shadow-xl transition hover:scale-105"
          aria-label="Open library assistant"
        >
          <Bot className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
