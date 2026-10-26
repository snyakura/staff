import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, ArrowLeftRight, Users, ScrollText, Globe, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { casesQuery, meQuery } from "@/lib/data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: Shell,
});

const nav = [
  { to: "/queue", icon: Inbox, label: "Review queue" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/clients", icon: Users, label: "Clients" },
  { to: "/activity", icon: ScrollText, label: "Activity" },
] as const;

function Shell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me, isLoading } = useQuery(meQuery);
  
  // BYPASS: Every signed-in user is automatically staff/admin
  const isStaff = true; 
  
  const { data: cases } = useQuery({ ...casesQuery, enabled: isStaff });
  const pending = (cases ?? []).filter((c) => c.status === "review").length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-16 flex-col items-center bg-sidebar py-4 md:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary font-display text-base font-extrabold text-sidebar-primary-foreground">
          C
        </div>
        <nav className="mt-8 flex w-full flex-col gap-2">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              title={n.label}
              className="group relative flex h-11 w-full items-center justify-center text-sidebar-foreground transition-colors hover:text-sidebar-accent-foreground data-[status=active]:text-sidebar-primary"
            >
              <span className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r bg-sidebar-primary opacity-0 group-data-[status=active]:opacity-100" />
              <n.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {n.to === "/queue" && pending > 0 && (
                <span className="absolute right-3.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sidebar-primary px-1 text-[9px] font-bold text-sidebar-primary-foreground">
                  {pending}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col items-center gap-4 text-sidebar-foreground">
          <button onClick={signOut} title="Sign out" className="hover:text-sidebar-accent-foreground">
            <LogOut className="h-[17px] w-[17px]" strokeWidth={1.75} />
          </button>
          <a href="https://coinspaceprototype.vercel.app/" target="_blank" rel="noreferrer" title="Coinspace site" className="hover:text-sidebar-accent-foreground">
            <Globe className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </a>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-card pb-[env(safe-area-inset-bottom)] md:hidden">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground data-[status=active]:font-bold data-[status=active]:text-foreground"
          >
            <n.icon className="h-5 w-5" strokeWidth={1.75} />
            {n.label.replace("Review queue", "Queue")}
            {n.to === "/queue" && pending > 0 && (
              <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {pending}
              </span>
            )}
          </Link>
        ))}
        <button onClick={signOut} className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground">
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
          Sign out
        </button>
      </nav>
      <main className="flex-1 pb-20 md:ml-16 md:pb-0">
        <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}