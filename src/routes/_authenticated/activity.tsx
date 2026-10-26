import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Bot, ShieldCheck, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { activityQuery, hhmm, meQuery, rulesQuery } from "@/lib/data";
import { Switch } from "@/components/ui/switch";
import { PageHead } from "@/components/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Coinspace Staff" },
      { name: "description", content: "The rules the engine enforces and everything that happened." },
      { property: "og:title", content: "Activity — Coinspace Staff" },
      { property: "og:description", content: "The rules the engine enforces and everything that happened." },
    ],
  }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(activityQuery), context.queryClient.ensureQueryData(rulesQuery)]),
  component: Activity,
});

const kinds = {
  system: { icon: Wrench, cls: "bg-muted text-foreground", tag: "System" },
  staff: { icon: ShieldCheck, cls: "bg-success text-ink-foreground", tag: "Staff" },
  client: { icon: User, cls: "bg-primary text-primary-foreground", tag: "Client" },
  ai: { icon: Bot, cls: "bg-ink text-primary", tag: "AI" },
} as const;

function when(d: string) {
  const isToday = new Date(d).toDateString() === new Date().toDateString();
  return `${isToday ? "Today" : new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${hhmm(d)}`;
}

function Activity() {
  const qc = useQueryClient();
  const { data: events } = useSuspenseQuery(activityQuery);
  const { data: rules } = useSuspenseQuery(rulesQuery);
  const { data: me } = useQuery(meQuery);
  const isAdmin = !!me?.roles.includes("admin");

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("rules").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rules"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <PageHead title="Activity" sub="Every decision, by people, the AI and the rules engine." />
      <div className="grid gap-4 md:grid-cols-[250px_1fr]">
        <div className="panel h-fit p-4">
          <p className="text-sm font-bold">Rules the engine enforces</p>
          <p className="text-[10px] text-muted-foreground">Clear cases pass silently. Broken rules create a case.</p>
          <div className="mt-3 space-y-2">
            {rules.map((r) => (
              <div key={r.id} className="flex items-start gap-2.5 rounded-xl border p-3">
                <Switch
                  checked={r.enabled}
                  disabled={!isAdmin || toggle.isPending}
                  onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })}
                  className="mt-0.5 data-[state=checked]:bg-primary"
                />
                <div>
                  <p className="text-[11px] font-bold leading-tight">{r.title}</p>
                  <p className="text-[9px] text-muted-foreground">{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel p-5">
          <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-border">
            {events.map((e) => {
              const k = kinds[e.actor_kind as keyof typeof kinds] ?? kinds.system;
              return (
                <li key={e.id} className="relative flex gap-3">
                  <span className={cn("z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", k.cls)}><k.icon className="h-3.5 w-3.5" /></span>
                  <div className="flex-1">
                    <p className="flex items-center gap-2 text-[11px] font-bold">{e.actor} <span className="label-mono rounded bg-muted px-1.5 py-0.5 text-[8px] font-medium text-muted-foreground">{k.tag}</span></p>
                    <p className="text-[11px]">{e.title}</p>
                    {e.detail && <p className="text-[9px] text-muted-foreground">{e.detail}</p>}
                  </div>
                  <span className="font-mono text-[9px] text-muted-foreground">{when(e.created_at)}</span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
