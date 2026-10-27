import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { casesQuery, clientsQuery, hhmm, money } from "@/lib/data";
import { Avatar, PageHead } from "@/components/bits";
import { useState } from "react";
import { useLive } from "@/lib/live";
import { FileDown, X } from "lucide-react";
import { downloadStatement } from "@/lib/statement";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({
    meta: [
      { title: "Clients — Coinspace Staff" },
      { name: "description", content: "Everyone who moves money through the chat." },
      { property: "og:title", content: "Clients — Coinspace Staff" },
      { property: "og:description", content: "Everyone who moves money through the chat." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clientsQuery),
  component: Clients,
});

function lastActive(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
}

function Clients() {
    useLive();
  const [open, setOpen] = useState<any>(null);
  const { data } = useSuspenseQuery(clientsQuery);
  return (
    <div>
      <PageHead title="Clients" sub="Everyone who moves money through the chat." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c) => (
          <div key={c.id} onClick={() => setOpen(c)} className="panel cursor-pointer p-4 transition-shadow hover:ring-1 hover:ring-foreground">
            <div className="flex items-center gap-2.5">
              <Avatar initials={c.initials} />
              <div>
                <p className="text-xs font-bold">{c.name}</p>
                <p className="font-mono text-[9px] text-muted-foreground">{c.phone}</p>
              </div>
            </div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <p className="label-mono text-[8px] text-muted-foreground">Wallet balance</p>
                <p className="font-display text-xl font-extrabold">{money(c.wallet_balance)}</p>
              </div>
              <div className="text-right text-[9px] text-muted-foreground">
                <p>{c.depositsApproved} deposits approved</p>
                <p>{c.total} transactions total</p>
              </div>
            </div>
            <div className="mt-3 flex justify-between border-t pt-2 text-[9px] text-muted-foreground">
              <span>Joined {new Date(c.joined_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}</span>
              <span className="font-mono">Last active: {lastActive(c.last_active_at)}</span>
            </div>
          </div>
        ))}
      </div>
      {open && <ClientDrawer client={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
function ClientDrawer({ client, onClose }: { client: any; onClose: () => void }) {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const mine = cases.filter((c) => c.client_id === client.id);
  const [sel, setSel] = useState<string | null>(null);
  const cur = mine.find((c) => c.id === sel) ?? mine[0];
  const chat = (cur?.chat ?? []) as any[];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-lg overflow-y-auto bg-background p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <Avatar initials={client.initials} className="h-10 w-10" />
          <div className="flex-1">
            <p className="text-sm font-bold">{client.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{client.phone}</p>
          </div>
          <button
            onClick={() => downloadStatement({
              title: "Account statement",
              clientName: client.name,
              clientPhone: client.phone,
              rows: mine as any,
              filename: `Coinspace-statement-${client.name.replace(/\s+/g, "-")}.pdf`,
              logoUrl: "/logo-light.jpeg",
            })}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground"
          >
            <FileDown className="h-3.5 w-3.5" /> Statement
          </button>
          <button onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {mine.map((c) => (
            <button key={c.id} onClick={() => setSel(c.id)}
              className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${cur?.id === c.id ? "bg-ink text-ink-foreground" : ""}`}>
              {c.kind} {money(c.amount)} · {c.status}
            </button>
          ))}
          {mine.length === 0 && <p className="text-xs text-muted-foreground">No conversations yet.</p>}
        </div>

        <div className="mt-4 space-y-2 rounded-2xl bg-chat p-3">
          {chat.map((m, i) => {
            if (m.from === "checking") return null;
            if (m.from === "ai") return <p key={i} className="text-center text-[10px] text-muted-foreground">AI read: {cur?.ai_read ? `${money(cur.ai_read.amount)} · ${cur.ai_read.reference}` : "—"}</p>;
            if (m.from === "pay") return <p key={i} className="text-center text-[10px] text-muted-foreground">Payment details sent: {money(m.amount)} via {m.gateway}</p>;
            const mineMsg = m.from === "client";
            return (
              <div key={i} className={`flex flex-col ${mineMsg ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[11px] ${mineMsg ? "bg-ink font-semibold text-ink-foreground" : "bg-card"}`}>
                  {m.text}
                  {m.image_url && <a href={m.image_url} target="_blank" rel="noreferrer"><img src={m.image_url} alt="Receipt" className="mt-2 h-32 w-full rounded-lg object-cover" /></a>}
                </div>
                {m.at && <span className="mt-0.5 font-mono text-[9px] text-muted-foreground">{hhmm(m.at)}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}