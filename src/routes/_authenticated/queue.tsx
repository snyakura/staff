import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useRef } from "react";
import { Check, Clock, Copy, ScanLine, Send, X, Zap, FileText, Image as ImageIcon, User, Phone, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { casesQuery, hhmm, money, type AiRead, type ChatItem } from "@/lib/data";
import { Avatar, FlagChip, KindIcon, PageHead, Pills } from "@/components/bits";
import { cn } from "@/lib/utils";

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

  // Realtime subscription so new cases & messages sync instantly
  useEffect(() => {
    const refresh = () => qc.invalidateQueries();
    const channel = supabase
      .channel("staff-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, (p) => {
        refresh();
        if (p.eventType === "INSERT") toast("New client case in the queue");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const review = cases.filter((c) => c.status === "review");
  const list = review.filter((c) => filter === "all" || c.kind === filter);
  const selected = list.find((c) => c.id === selectedId) ?? list[0] ?? null;

  const stats = useMemo(() => {
    const auto = cases.filter((c) => c.status === "approved" && c.decided_by === "system" && c.decided_at && isToday(c.decided_at)).length;
    const staffDecided = cases.filter((c) => c.decided_at && c.decided_by && c.decided_by !== "system");
    const avgMin = staffDecided.length
      ? Math.max(1, Math.round(staffDecided.reduce((s, c) => s + (new Date(c.decided_at!).getTime() - new Date(c.created_at).getTime()), 0) / staffDecided.length / 60000))
      : 3;
    const vol = cases.filter((c) => isToday(c.created_at)).reduce((s, c) => s + Number(c.amount), 0);
    const volLabel = vol >= 1000 ? `$${(vol / 1000).toFixed(1)}K` : money(vol);
    return { auto, avg: avgMin > 120 ? "3 min" : `${avgMin} min`, vol: volLabel };
  }, [cases]);

  return (
    <div>
      <PageHead title="Review queue" sub="Only the unusual cases land here. Everything else approves itself." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Needs review" value={String(review.length)} tone="primary" />
        <Stat label="Auto-approved today" value={String(stats.auto)} />
        <Stat label="Avg. decision" value={stats.avg} />
        <Stat label="Volume today" value={stats.vol} tone="ink" />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-3">
          <Pills
            value={filter}
            onChange={setFilter}
            options={[
              { v: "all", l: "All Cases" },
              { v: "deposit", l: "Deposits" },
              { v: "withdrawal", l: "Withdrawals" },
            ]}
          />
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
                className={cn("panel block w-full p-3 text-left transition-shadow", selected?.id === c.id && "ring-1 ring-foreground")}
              >
                <div className="flex items-start gap-2.5">
                  <Avatar initials={c.client?.initials || "U"} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{c.client?.name || "Client User"}</p>
                    <p className="flex items-center gap-1 text-[10px] text-muted-foreground"><KindIcon kind={c.kind} /> {c.kind} · {c.platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-medium">{money(c.amount)}</p>
                    <p className="font-mono text-[9px] text-muted-foreground">{hhmm(c.created_at)}</p>
                  </div>
                </div>
                {c.flag && <div className="mt-2"><FlagChip label={c.flag} tone={c.flag_tone} /></div>}
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
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "primary" | "ink" }) {
  return (
    <div className={cn("panel px-4 py-4", tone === "primary" && "bg-primary text-primary-foreground", tone === "ink" && "bg-ink text-ink-foreground")}>
      <p className={cn("label-mono", tone ? "opacity-70" : "text-muted-foreground")}>{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function CaseDetail({ c }: { c: any }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const ai = c.ai_read as AiRead | null;
  const chat = (c.chat ?? []) as ChatItem[];
    useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);
  const clientInfo = c.client || {};
  const first = (clientInfo.name || "Client").split(" ")[0];

  // Extract account name & number if client submitted it in chat (e.g. "Name: Sean Nyakura, Number: 0781108979")
  const extractedAccount = useMemo(() => {
    for (const msg of chat) {
      const text = msg.text || "";
      if (text.toLowerCase().includes("name:") || text.toLowerCase().includes("number:")) {
        return text;
      }
    }
    return c.reference || "None provided";
  }, [chat, c.reference]);

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

  const send = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reply_case", { _case_id: c.id, _text: reply.trim() });
      if (error) throw error;
    },
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["cases"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-3">
      {/* Client Overview Panel */}
      <div className="panel p-4">
        <div className="flex items-start gap-3">
          <Avatar initials={clientInfo.initials || "CU"} className="h-10 w-10" />
          <div className="flex-1">
            <p className="text-sm font-bold">{clientInfo.name || "Client User"}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{clientInfo.phone || clientInfo.email || "No contact info"}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-extrabold">{money(c.amount)}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{c.kind} · ref {c.reference}</p>
          </div>
          <span className="ml-3 inline-flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-1 text-[10px] font-semibold text-warn-foreground">
            <Clock className="h-3 w-3" /> In review
          </span>
        </div>
        {c.flag && (
          <div className="mt-3 flex items-center gap-2 border-t pt-3">
            <FlagChip label={c.flag} tone={c.flag_tone} />
            <span className="text-xs text-muted-foreground">{c.flag_detail}</span>
          </div>
        )}
      </div>

      {/* Client Submission & Account Info Details */}
      <div className="panel p-4 space-y-3">
        <p className="flex items-center gap-2 text-xs font-bold"><FileText className="h-3.5 w-3.5 text-primary" /> Client Submission & Payout Details</p>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/50 p-3 text-xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">Platform / Method</span>
            <span className="font-medium">{c.platform || "N/A"}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Account & Payout Info</span>
            <span className="font-mono font-medium text-primary">{extractedAccount}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Transaction Type</span>
            <span className="font-medium uppercase">{c.kind || "N/A"}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground block">Client ID</span>
            <span className="font-mono font-medium truncate block">{c.client_id || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* AI Read Analysis */}
      {ai && (
        <div className="rounded-2xl bg-ink p-4 text-ink-foreground">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-xs font-bold"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"><ScanLine className="h-3 w-3" /></span> What the AI read</p>
            <p className="font-mono text-[10px] opacity-60">confidence {ai.confidence}%</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { l: "Amount", v: money(ai.amount), bad: ai.amount_mismatch },
              { l: "Reference", v: ai.reference },
              { l: "Sender", v: ai.sender },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-ink-soft p-2.5">
                <p className="label-mono text-[8px] opacity-50">{x.l}</p>
                <p className={cn("mt-1 font-mono text-[10px]", x.bad && "text-destructive")}>{x.v}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Client Chat & Receipt Proof Stream */}
      <div className="panel overflow-hidden">
        <p className="border-b px-4 py-3 text-xs font-bold">Client chat & receipt proof</p>
        <div ref={boxRef} className="max-h-[340px] space-y-3 overflow-y-auto bg-chat p-3">
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
        <form
          onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }}
          className="flex items-center gap-2 border-t p-2.5"
        >
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply to ${first}...`} className="flex-1 rounded-full bg-muted px-4 py-2 text-xs outline-none" />
          <button disabled={send.isPending} className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-ink-foreground"><Send className="h-3.5 w-3.5" /></button>
        </form>
        <div className="grid grid-cols-2 gap-2 border-t p-3">
          <button disabled={decide.isPending} onClick={() => decide.mutate("approved")} className="flex items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60">
            <Check className="h-3.5 w-3.5" /> Approve
          </button>
          <button disabled={decide.isPending} onClick={() => decide.mutate("rejected")} className="flex items-center justify-center gap-1.5 rounded-full border border-destructive/30 py-2.5 text-xs font-semibold text-destructive disabled:opacity-60">
            <X className="h-3.5 w-3.5" /> Reject
          </button>
        </div>
      </div>
    </div>
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
      <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-[11px]", mine ? "bg-ink font-semibold text-ink-foreground" : m.from === "staff" ? "bg-accent text-foreground" : "bg-card")}>
        {m.text || (m.file && `Uploaded file: ${m.file}`) || (m.name && `Uploaded: ${m.name}`)}
      </div>
      {m.at && <span className="mt-1 font-mono text-[9px] text-muted-foreground">{hhmm(m.at)}{m.from === "staff" && " · staff"}</span>}
    </div>
  );
}