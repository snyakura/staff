import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Clock, Search, XCircle } from "lucide-react";
import { casesQuery, hhmm, money } from "@/lib/data";
import { Avatar, PageHead, Pills } from "@/components/bits";
import { cn } from "@/lib/utils";
import { FileDown } from "lucide-react";
import { downloadStatement } from "@/lib/statement";
import { useLive } from "@/lib/live";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Coinspace Staff" },
      { name: "description", content: "Every movement, with who decided what." },
      { property: "og:title", content: "Transactions — Coinspace Staff" },
      { property: "og:description", content: "Every movement, with who decided what." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(casesQuery),
  component: Transactions,
});

type F = "all" | "deposit" | "withdrawal" | "approved" | "review" | "rejected";

function when(d: string) {
  const date = new Date(d);
  const today = new Date();
  const y = new Date(); y.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Today ${hhmm(d)}`;
  if (date.toDateString() === y.toDateString()) return `Yesterday ${hhmm(d)}`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + hhmm(d);
}

function Transactions() {
          <button
          onClick={() => downloadStatement({
            title: "Transaction report",
            rows: rows as any,
            filename: `Coinspace-report-${new Date().toISOString().slice(0, 10)}.pdf`,
            logoUrl: "/logo-light.jpeg",
          })}
          className="flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-semibold text-primary-foreground"
        >
          <FileDown className="h-3.5 w-3.5" /> Download report
        </button>
  const { data } = useSuspenseQuery(casesQuery);
  const [f, setF] = useState<F>("all");
  const [q, setQ] = useState("");
  const rows = data.filter((c) => {
    if (f === "deposit" || f === "withdrawal") { if (c.kind !== f) return false; }
    else if (f !== "all" && c.status !== f) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [c.client?.name, c.reference, String(c.amount), c.platform].some((x) => x?.toLowerCase().includes(s));
  });

  return (
    <div>
      <PageHead title="Transactions" sub="Every movement, with who decided what." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pills value={f} onChange={setF} options={[
          { v: "all", l: "All" }, { v: "deposit", l: "Deposits" }, { v: "withdrawal", l: "Withdrawals" },
          { v: "approved", l: "Approved" }, { v: "review", l: "In review" }, { v: "rejected", l: "Rejected" },
        ]} />
        <label className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-[11px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search client, ref, amount..." className="w-44 bg-transparent outline-none" />
        </label>
      </div>
      <div className="panel mt-4 overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="label-mono border-b text-[9px] text-muted-foreground">
              {["Client", "Type", "Amount", "Platform", "Reference", "Decision", "Time"].map((h) => <th key={h} className={cn("px-4 py-3 font-medium", h === "Time" && "text-right")}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions match.</td></tr>}
            {rows.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar initials={c.client!.initials} className="h-7 w-7 text-[9px]" /><span className="font-bold">{c.client!.name}</span></div></td>
                <td className="px-4 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-semibold capitalize", c.kind === "deposit" ? "bg-success-soft text-success" : "bg-danger-soft text-destructive")}>{c.kind}</span>
                </td>
                <td className={cn("px-4 py-3 font-mono", c.kind === "deposit" ? "text-success" : "text-destructive")}>{c.kind === "deposit" ? "+" : "-"}{money(c.amount)}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.platform}</td>
                <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{c.reference}</td>
                <td className="px-4 py-3">
                  <Decision status={c.status} />
                  {c.decided_by && <p className="mt-0.5 text-[9px] text-muted-foreground">by {c.decided_by}</p>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[10px] text-muted-foreground">{when(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Decision({ status }: { status: string }) {
  if (status === "approved") return <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[9px] font-semibold text-success"><CheckCircle2 className="h-3 w-3" /> Approved</span>;
  if (status === "rejected") return <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[9px] font-semibold text-destructive"><XCircle className="h-3 w-3" /> Rejected</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-[9px] font-semibold text-warn-foreground"><Clock className="h-3 w-3" /> In review</span>;
}
