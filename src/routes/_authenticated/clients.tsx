import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { clientsQuery, money } from "@/lib/data";
import { Avatar, PageHead } from "@/components/bits";

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
  const { data } = useSuspenseQuery(clientsQuery);
  return (
    <div>
      <PageHead title="Clients" sub="Everyone who moves money through the chat." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c) => (
          <div key={c.id} className="panel p-4">
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
    </div>
  );
}
