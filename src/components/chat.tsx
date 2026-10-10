"use client";

import clsx from "clsx";
import { ArrowUp, Bot, Loader2, RotateCcw, Sparkles, Wrench, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { AIMode, ChatEvent } from "@/lib/ai/types";
import { useFleet } from "./fleet-provider";
import { Markdown } from "./markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  error?: boolean;
}

interface ChatState {
  open: boolean;
  setOpen: (v: boolean) => void;
  ask: (question: string) => void;
}

const ChatContext = createContext<ChatState | null>(null);

export const SUGGESTED_QUESTIONS = [
  "What is my true cost per hour?",
  "How much would I save if I flew 50 more hours?",
  "Which empty legs should I list this month?",
  "What maintenance is coming due?",
];

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { dataset, selectedId, ready } = useFleet();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<AIMode | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // New aircraft, new conversation.
  useEffect(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, [selectedId, dataset.source]);

  const send = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || busy || !ready) return;
      const history: Message[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
      setMessages([...history, { role: "assistant", content: "" }]);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;

      const update = (fn: (m: Message) => Message) =>
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = fn(next[next.length - 1]);
          return next;
        });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset,
            messages: history.slice(-20).map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as ChatEvent;
            if (ev.type === "meta") setMode(ev.mode);
            else if (ev.type === "text") update((m) => ({ ...m, content: m.content + ev.text }));
            else if (ev.type === "tool") update((m) => ({ ...m, tools: [...(m.tools ?? []), ev.label] }));
            else if (ev.type === "error") update((m) => ({ ...m, content: m.content || ev.message, error: !m.content }));
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          update((m) => ({ ...m, content: (err as Error).message || "Something went wrong.", error: true }));
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, dataset, messages, ready],
  );

  const ask = useCallback(
    (question: string) => {
      setOpen(true);
      void send(question);
    },
    [send],
  );

  return (
    <ChatContext.Provider value={{ open, setOpen, ask }}>
      {children}
      <ChatDrawer
        open={open}
        onClose={() => setOpen(false)}
        messages={messages}
        busy={busy}
        mode={mode}
        onSend={send}
        onReset={() => {
          abortRef.current?.abort();
          setMessages([]);
        }}
      />
    </ChatContext.Provider>
  );
}

export function useChat(): ChatState {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside <ChatProvider>");
  return ctx;
}

function ChatDrawer({
  open,
  onClose,
  messages,
  busy,
  mode,
  onSend,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  messages: Message[];
  busy: boolean;
  mode: AIMode | null;
  onSend: (q: string) => void;
  onReset: () => void;
}) {
  const { dataset } = useFleet();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const submit = () => {
    if (!input.trim()) return;
    onSend(input);
    setInput("");
  };

  return (
    <>
      <div
        className={clsx("fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          "fixed top-0 right-0 z-50 flex h-dvh w-full max-w-[440px] flex-col border-l border-border bg-surface shadow-2xl shadow-black/60 transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-label="Ask JetYield"
        aria-hidden={!open}
        inert={!open}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-accent" aria-hidden /> Ask JetYield
            </div>
            <p className="text-xs text-muted">
              {dataset.profile.tail} · {dataset.profile.name}
              {mode && <> · {mode === "claude" ? "Claude agent" : "Demo engine"}</>}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onReset} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="New conversation" title="New conversation">
              <RotateCcw size={16} />
            </button>
            <button onClick={onClose} className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-text" aria-label="Close chat">
              <X size={18} />
            </button>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm leading-relaxed">
          {messages.length === 0 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-surface-2 p-4 text-text-2">
                <p>
                  Ask anything about <span className="text-text">{dataset.profile.tail}</span>: costs, utilization, empty legs, maintenance. Answers are grounded in this aircraft&apos;s data, and what-ifs run through the
                  JetYield cost engine.
                </p>
              </div>
              <div className="space-y-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => onSend(q)}
                    className="block w-full rounded-lg border border-border px-3 py-2 text-left text-text-2 transition-colors hover:border-accent/50 hover:bg-surface-2 hover:text-text"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-accent/15 px-3.5 py-2 text-text">{m.content}</div>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2">
                  <Bot size={15} className="text-accent" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 text-text-2">
                  {m.tools?.map((t, ti) => (
                    <div key={ti} className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted">
                      <Wrench size={12} aria-hidden /> {t}
                    </div>
                  ))}
                  {m.content ? (
                    <div className={clsx(m.error && "text-[#ff8080]")}>
                      <Markdown text={m.content} />
                    </div>
                  ) : (
                    busy &&
                    i === messages.length - 1 && (
                      <div className="flex items-center gap-2 text-muted">
                        <Loader2 size={14} className="animate-spin" aria-hidden /> Analyzing {dataset.profile.tail}…
                      </div>
                    )
                  )}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border-strong bg-surface-2 p-2 focus-within:border-accent/60">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder="Ask about costs, empty legs, what-ifs…"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none"
              aria-label="Message"
            />
            <button
              onClick={submit}
              disabled={busy || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-[#04121f] transition-opacity disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted">Figures come from the JetYield engine. Verify before making financial decisions.</p>
        </div>
      </aside>
    </>
  );
}
