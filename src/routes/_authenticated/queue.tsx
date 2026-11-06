import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { Check, CircleAlert, CircleCheck, CircleX, Copy, MessageCircle, MessageCircleMore, Phone, ScanLine, Send, X, Zap, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { casesQuery, hhmm, money, type AiRead, type ChatItem } from "@/lib/data";
import { Avatar, FlagChip, KindIcon, PageHead, Pills } from "@/components/bits";
import { cn } from "@/lib/utils";
import { useLive } from "@/lib/live";

export const Route = createFileRoute("/_authenticated/queue")({
  head: () => ({
    meta: [
      { title: "Review queue — Coinspace Staff" },
      { name: "description", content: "Only the unusual cases land here. Everything else approves itself." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  component: Queue,
});

type Filter = "all" | "deposit" | "withdrawal";

function isToday(d: string) {
  return new Date(d).toDateString() === new Date().toDateString();
}

function Queue() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all"); // Default to "all" so both deposits and withdrawals show up immediately
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closedChatId, setClosedChatId] = useState<string | null>(null); // case whose chat panel was closed

  // Realtime subscription so new cases & messages sync instantly
  useLive();

  const review = cases.filter((c) => c.status === "review");
  const list = review.filter((c) => filter === "all" || c.kind === filter);
  const selected = list.find((c) => c.id === selectedId) ?? list[0] ?? null;

  const stats = useMemo(() => {
    const auto = cases.filter((c) => c.status === "approved" && c.decided_by === "system" && c.decided_at && isToday(c.decided_at)).length;
    const staffDecided = cases.filter((c) => c.decided_at && c.decided_by && c.decided_by !== "system");
    const avgMin = staffDecided.length
      ? Math.max(1, Math.round(staffDecided.reduce((s, c) => s + (new Date(c.decided_at!).getTime() - new Date(c.created_at).getTime()), 0) / staffDecided.length / 60000))
      : 3;
    const doneToday = cases.filter((c) => c.status === "approved" && c.kind !== "support" && c.decided_at && isToday(c.decided_at));
    const vol = doneToday.reduce((s, c) => s + Number(c.amount), 0);
    return { auto, avg: staffDecided.length ? `${avgMin} min` : "—", vol: money(vol), volSub: `${doneToday.length} approved today` };
  }, [cases]);

  return (
    <div>
      <PageHead
        title="Review queue"
        sub="Only the unusual cases land here for manual verification."
        right={
          <span className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/40 bg-warn-soft px-3.5 py-1.5 text-[11px] font-semibold text-warn-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {review.length} Pending Action{review.length === 1 ? "" : "s"}
          </span>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Needs review" value={String(review.length)} tone="primary" />
        <Stat label="Auto-approved today" value={String(stats.auto)} />
        <Stat label="Avg. decision" value={stats.avg} />
        <Stat label="Approved volume" value={stats.vol} tone="ink" sub={stats.volSub} />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <Pills
          value={filter}
          onChange={setFilter}
          options={[
            { v: "all", l: "All Cases" },
            { v: "deposit", l: "Deposits" },
            { v: "withdrawal", l: "Withdrawals" },
          ]}
        />
        <p className="text-xs text-muted-foreground">Showing active active queue items</p>
      </div>

      <div className="mt-4 grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)] xl:items-start 2xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {list.length === 0 ? (
            <div className="panel flex flex-col items-center px-4 py-6 text-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success-soft text-success"><Check className="h-4 w-4" /></div>
              <p className="mt-2 text-xs font-semibold">Queue clear</p>
              <p className="text-[10px] text-muted-foreground">No cases need a decision right now.</p>
            </div>
          ) : (
            list.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn("panel block w-full border-2 border-transparent p-3.5 text-left transition-shadow", selected?.id === c.id && "border-foreground")}
              >
                <div className="flex items-start gap-2.5">
                  <Avatar initials={c.client?.initials || "U"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{c.client?.name || "Client User"}</p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><KindIcon kind={c.kind} /> {c.kind} · {c.platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{money(c.amount)}</p>
                    <p className="font-mono text-[9px] text-muted-foreground">{hhmm(c.created_at)}</p>
                  </div>
                </div>
                {c.flag && <div className="mt-3"><FlagChip label={c.flag} tone={c.flag_tone} className="border border-primary/40" /></div>}
              </button>
            ))
          )}
        </div>

        {selected ? (
          <CaseDetail key={selected.id} c={selected} />
        ) : (
          <div className="panel flex min-h-[200px] flex-col items-center justify-center text-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warn-soft text-warn-foreground"><Check className="h-4 w-4" /></div>
            <p className="mt-2 text-xs font-semibold">All clear</p>
            <p className="text-[10px] text-muted-foreground">Pick a case from the queue, or enjoy the quiet.</p>
          </div>
        )}
      </div>

      {/* Client chat & receipt proof — docked on the right on large screens. Closing only clears the current chat; the panel stays. */}
      {selected && closedChatId !== selected.id ? (
        <CasePanel key={`panel-${selected.id}`} c={selected} onClose={() => setClosedChatId(selected.id)} />
      ) : (
        <aside className={cn(PANEL_SHELL, "mt-4")}>
          <div className="flex items-center gap-2.5 border-b px-4 py-4 text-sm font-bold sm:px-5">
            <MessageCircleMore className="h-4 w-4 shrink-0 text-orange-500" /> <span className="truncate">Client chat & receipt proof</span>
          </div>
          <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center px-6 py-10 text-center">
            <MessageCircleMore className="h-6 w-6 text-primary" />
            <p className="mt-2 text-xs font-semibold">{selected ? "Chat closed" : "No case selected"}</p>
            <p className="text-[10px] text-muted-foreground">
              {selected ? "Reopen it to message the client or approve the payout." : "The client chat appears here."}
            </p>
            {selected && (
              <button
                type="button"
                onClick={() => setClosedChatId(null)}
                className="mt-4 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-ink-foreground"
              >
                Open chat
              </button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "primary" | "ink"; sub?: string }) {
  return (
    <div className={cn("panel min-w-0 border px-4 py-4 sm:px-5 sm:py-5", tone === "primary" && "border-transparent bg-primary text-primary-foreground", tone === "ink" && "border-transparent bg-ink text-ink-foreground")}>
      <p className={cn("label-mono", tone ? "opacity-70" : "text-muted-foreground")}>{label}</p>
      <p className="mt-3 break-words font-display text-3xl font-extrabold 2xl:text-4xl">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] opacity-60">{sub}</p>}
    </div>
  );
}

function CaseDetail({ c }: { c: any }) {
  const ai = c.ai_read as AiRead | null;
  const chat = (c.chat ?? []) as ChatItem[];
  const clientInfo = c.client || {};

  // Extract account name & number if client submitted it in chat (e.g. "Name: Sean Nyakura, Number: 0781108979")
  const extractedAccount = useMemo(() => {
    for (const msg of chat) {
      const text = (msg as any).text || "";
      if (text.toLowerCase().includes("name:") || text.toLowerCase().includes("number:")) {
        return text;
      }
    }
    return c.reference || "None provided";
  }, [chat, c.reference]);

  return (
    <div className="space-y-4">
      {/* Client Overview Panel */}
      <div className="panel border p-5">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar initials={clientInfo.initials || "CU"} className="h-11 w-11" />
          <div className="min-w-0 flex-1 basis-40">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-lg font-extrabold leading-tight">{clientInfo.name || "Client User"}</p>
              <span className="inline-flex items-center rounded-full border border-primary/40 bg-warn-soft px-2.5 py-0.5 text-[10px] font-semibold text-warn-foreground">In review</span>
            </div>
            <p className="mt-0.5 text-xs uppercase text-muted-foreground">{clientInfo.phone || clientInfo.email || "No contact info"}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-display text-2xl font-extrabold leading-tight sm:text-3xl">{money(c.amount)}</p>
            <p className="text-[11px] text-muted-foreground">{c.kind} · ref <span className="font-mono text-foreground">{c.reference}</span></p>
          </div>
        </div>
        {c.flag && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/40 bg-warn-soft px-4 py-3 text-xs text-warn-foreground">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
            <p><span className="font-bold">{c.flag}:</span> {c.flag_detail}</p>
          </div>
        )}
      </div>

      {/* Client Submission & Account Info Details */}
      <div className="panel border p-5">
        <p className="flex items-center gap-2 text-sm font-bold"><FileText className="h-4 w-4 text-primary" /> Client Submission & Payout Details</p>
        <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-5 rounded-xl border bg-muted/40 p-4 text-xs sm:grid-cols-2">
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Platform / Method</span>
            <span className="font-bold">{c.platform || "N/A"}</span>
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Account & Payout Info</span>
            <span className="break-words font-mono font-bold text-orange-600">{extractedAccount}</span>
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Transaction Type</span>
            <span className="font-bold uppercase">{c.kind || "N/A"}</span>
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted-foreground">Client ID</span>
            <span className="block break-all font-mono text-[11px] font-medium">{c.client_id || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* AI Read Analysis */}
      {ai && (
        <div className="rounded-2xl bg-ink p-5 text-ink-foreground">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><ScanLine className="h-3.5 w-3.5" /></span> What the AI read</p>
            <p className="text-xs opacity-70">confidence <span className="font-bold text-primary">{ai.confidence}%</span></p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { l: "Amount", v: money(ai.amount), bad: ai.amount_mismatch },
              { l: "Reference", v: ai.reference },
              { l: "Sender", v: ai.sender },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-white/10 bg-ink-soft p-3">
                <p className="label-mono text-[9px] font-bold opacity-60">{x.l}</p>
                <p className={cn("mt-1 break-all font-mono text-[11px]", x.bad && "text-destructive")}>{x.v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Shared look for the chat panel: docked to the right edge on large screens, a normal card below that.
const PANEL_SHELL =
  "flex flex-col overflow-hidden border bg-card rounded-2xl xl:fixed xl:inset-y-0 xl:right-0 xl:z-20 xl:mt-0 xl:min-h-0 xl:w-[clamp(360px,30vw,460px)] xl:rounded-none xl:border-y-0 xl:border-r-0 xl:border-l";

const QUICK_REPLIES = ["Receipt verified", "Please resend proof"];

function CasePanel({ c, onClose }: { c: any; onClose: () => void }) {
  const qc = useQueryClient();
  const boxRef = useRef<HTMLDivElement>(null);
  const ai = c.ai_read as AiRead | null;
  const chat = (c.chat ?? []) as ChatItem[];
  const [reply, setReply] = useState("");
  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);
  const clientInfo = c.client || {};
  const contact: string = (clientInfo.phone && clientInfo.phone !== "—" ? clientInfo.phone : ai?.sender) || "";
  const digits = contact.replace(/\D/g, "");
  const waDigits = digits.startsWith("0") ? "263" + digits.slice(1) : digits;

  const decide = useMutation({
    mutationFn: async (decision: "approved" | "rejected") => {
      const { error } = await supabase.rpc("decide_case", { _case_id: c.id, _decision: decision });
      if (error) throw error;
      return decision;
    },
    onSuccess: (d) => {
      toast(`${d === "approved" ? "Approved" : "Rejected"} ${c.kind} of ${money(c.amount)}`, {
        description: d === "approved" ? `${clientInfo.name} has been notified.` : `${clientInfo.name} will be told why.`,
        icon: <Check className="h-4 w-4" />,
      });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Staff reply — shows up in the client's chat as "Coinspace team: ..."
  const sendReply = useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase.rpc("staff_append_chat", {
        _case_id: c.id,
        _item: { from: "staff", text, at: new Date().toISOString() },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReply("");
      toast("Reply sent to client", { icon: <Send className="h-4 w-4" /> });
      qc.invalidateQueries();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // "Receipt" button — opens the first uploaded proof, if the client sent one
  function openReceipt() {
    const m = chat.find((x: any) => x.image_url || x.receipt_url || x.proof || x.url) as any;
    const url = m && (m.image_url || m.receipt_url || m.proof || m.url);
    if (url) window.open(url, "_blank", "noreferrer");
    else toast("No receipt uploaded yet");
  }

  return (
    <aside className={cn(PANEL_SHELL, "mt-4")}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b px-4 py-4 sm:px-5">
        <p className="flex min-w-0 items-center gap-2.5 text-sm font-bold"><MessageCircleMore className="h-4 w-4 shrink-0 text-orange-500" /> <span className="truncate">Client chat & receipt proof</span></p>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={openReceipt} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold">
            <FileText className="h-3 w-3" /> Receipt
          </button>
          <button type="button" onClick={onClose} aria-label="Close chat" title="Close chat" className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Chat stream */}
      <div ref={boxRef} className="max-h-[420px] min-h-0 flex-1 space-y-3 overflow-y-auto bg-card px-4 py-4 sm:px-5 xl:max-h-none">
        <div className="flex justify-center">
          <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground">Today</span>
        </div>
        {chat.map((m: any, i: number) => (
          <div key={i} className="space-y-2">
            <ChatBubble m={m} ai={ai} req={c.amount} />
            {/* Catch uploaded receipt images, files, or attachments */}
            {(m.image_url || m.receipt_url || m.proof || m.file || m.url || m.name) && (
              <div className="max-w-[240px] rounded-xl bg-ink text-ink-foreground p-3 shadow-md space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <span className="truncate">{m.name || m.file || "Payment Receipt Proof"}</span>
                </div>
                {(m.image_url || m.receipt_url || m.proof || m.url) ? (
                  <a
                    href={m.image_url || m.receipt_url || m.proof || m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900"
                  >
                    <img
                      src={m.image_url || m.receipt_url || m.proof || m.url}
                      alt="Receipt Proof"
                      className="h-32 w-full object-cover transition-transform hover:scale-105"
                    />
                  </a>
                ) : (
                  <div className="rounded bg-neutral-800 p-2 text-[10px] font-mono text-neutral-300 text-center">
                    ✓ File Attached & Verified
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick replies */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" onClick={() => setReply(q)} className="rounded-full border bg-card px-3.5 py-1.5 text-[11px] font-medium hover:bg-muted">
            "{q}"
          </button>
        ))}
      </div>

      {/* Decision */}
      <div className="grid grid-cols-2 gap-3 border-t px-4 py-3">
        <button disabled={decide.isPending} onClick={() => decide.mutate("approved")} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-semibold text-white disabled:opacity-60 sm:text-sm">
          <CircleCheck className="h-4 w-4" /> Approve Payout
        </button>
        <button disabled={decide.isPending} onClick={() => decide.mutate("rejected")} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-xs font-semibold text-white disabled:opacity-60 sm:text-sm">
          <CircleX className="h-4 w-4" /> Reject
        </button>
      </div>

      {/* Staff reply input — the message appears in the client's chat */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && reply.trim() && !sendReply.isPending) sendReply.mutate(reply.trim());
          }}
          placeholder="Type staff note or message..."
          className="h-11 min-w-0 flex-1 rounded-xl border bg-muted/60 px-4 text-xs outline-none focus:ring-1 focus:ring-foreground"
        />
        <button
          type="button"
          disabled={!reply.trim() || sendReply.isPending}
          onClick={() => sendReply.mutate(reply.trim())}
          aria-label="Send reply"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-ink-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Contact row */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-4 text-xs">
        <span className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{contact || "No number on file"}</span>
        {contact && (
          <div className="flex shrink-0 gap-2">
            <a href={`https://wa.me/${waDigits}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 font-semibold text-ink-foreground"><MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> WhatsApp</a>
            <a href={`tel:${contact.replace(/\s/g, "")}`} className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-semibold"><Phone className="h-3 w-3" /> Call</a>
          </div>
        )}
      </div>
    </aside>
  );
}

function ChatBubble({ m, ai, req }: { m: ChatItem; ai: AiRead | null; req: number }) {
  if (m.from === "checking")
    return (
      <div className="flex justify-center">
        <span className="rounded-full border border-primary/40 bg-warn-soft px-4 py-1.5 text-[10px] font-semibold text-warn-foreground">••• We're checking, please wait</span>
      </div>
    );
  if (m.from === "pay")
    return (
      <div className="max-w-[90%] rounded-2xl bg-ink p-4 text-ink-foreground">
        <div className="flex items-center justify-between border-b border-ink-soft pb-2">
          <p className="flex items-center gap-2 text-xs font-bold"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><Zap className="h-3 w-3" /></span> Pay via {m.gateway}</p>
          <p className="font-mono text-xs text-primary">{money(m.amount)}</p>
        </div>
        {[["Merchant", m.merchant], ["Merchant code", m.code], ["Number", m.number], ["Reference", m.reference]].map(([l, v]) => (
          <div key={l} className="flex items-center justify-between py-1 text-[10px]">
            <span className="opacity-60">{l}</span>
            <span className={cn("flex items-center gap-1.5 font-mono", l === "Reference" && "text-primary")}>
              {v}
              {(l === "Number" || l === "Reference") && <Copy className="h-3 w-3 opacity-50" />}
            </span>
          </div>
        ))}
      </div>
    );
  if (m.from === "ai")
    return ai ? (
      <div className="max-w-[90%] rounded-2xl bg-card p-4">
        <p className="flex items-center gap-2 text-xs font-bold"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink text-primary"><ScanLine className="h-3 w-3" /></span> What the AI read</p>
        <div className="mt-2 space-y-1 text-[10px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className={cn("font-mono", ai.amount_mismatch && "text-destructive")}>{money(ai.amount)} {ai.amount_mismatch && <span className="opacity-70">(asked {money(req)})</span>}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reference</span><span className="font-mono">{ai.reference}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Sender</span><span className="font-mono">{ai.sender}</span></div>
        </div>
        <div className="mt-2 flex justify-between label-mono text-[8px] text-muted-foreground"><span>Read confidence</span><span>{ai.confidence}%</span></div>
        <div className="mt-1 h-1 rounded-full bg-muted"><div className="h-1 rounded-full bg-primary" style={{ width: `${ai.confidence}%` }} /></div>
      </div>
    ) : null;
  const mine = m.from === "client";
  return (
    <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className={cn("max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-xs leading-relaxed", mine ? "bg-ink font-semibold text-ink-foreground" : m.from === "staff" ? "bg-accent text-foreground" : "bg-muted")}>
        {m.text || (m.file && `Uploaded file: ${m.file}`) || (m.name && `Uploaded: ${m.name}`)}
      </div>
      {m.at && <span className="mt-1 text-[10px] text-muted-foreground">{hhmm(m.at)}{m.from === "staff" && " · staff"}</span>}
    </div>
  );
}