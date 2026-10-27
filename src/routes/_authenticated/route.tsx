import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, ArrowLeftRight, Users, ScrollText, Globe, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { casesQuery } from "@/lib/data";

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
  const isStaff = true; // Auto-bypass role check
  
  const { data: cases } = useQuery({ ...casesQuery, enabled: isStaff });
  const pending = (cases ?? []).filter((c) => c.status === "review").length;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="fixed inset-0 flex w-full bg-background overflow-hidden">
      {/* Desktop Black Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-black text-white p-4 md:flex border-r border-neutral-800">
        <div className="flex justify-center px-1 pt-2 pb-0">
          <img src="/logo-dark.svg" alt="Coinspace" className="w-full max-w-[200px] h-auto object-contain" />
        </div>

        <div className="mt-3 px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          Main Menu
        </div>

        <nav className="mt-2 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white data-[status=active]:bg-neutral-800 data-[status=active]:font-bold data-[status=active]:text-white"
            >
              <n.icon className="h-4 w-4" strokeWidth={2} />
              <span className="flex-1">{n.label}</span>
              {n.to === "/queue" && pending > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-700 px-1.5 text-[10px] font-bold text-white">
                  {pending}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-2 border-t border-neutral-800 pt-4">
          <a
            href="https://coinspaceprototype.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-900 hover:text-white"
          >
            <Globe className="h-4 w-4" strokeWidth={2} />
            <span>Coinspace Site</span>
          </a>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" strokeWidth={2} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

{/* Mobile Sticky Top Header with Scaled, Prominent Logo */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-center bg-black h-14 px-4 border-b border-neutral-800 md:hidden overflow-hidden">
        <img 
          src="/logo-dark.svg" 
          alt="Coinspace" 
          className="h-28 w-auto object-contain scale-[1.2]" 
        />
      </header>

      {/* Mobile Viewport-Fixed Bottom Nav Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-neutral-800 bg-black pb-[env(safe-area-inset-bottom)] md:hidden shadow-2xl">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="relative flex flex-col items-center gap-1 py-3 text-[10px] font-medium text-neutral-400 data-[status=active]:font-bold data-[status=active]:text-white"
          >
            <n.icon className="h-5 w-5" strokeWidth={1.75} />
            {n.label.replace("Review queue", "Queue")}
            {n.to === "/queue" && pending > 0 && (
              <span className="absolute right-[20%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-700 px-1 text-[9px] font-bold text-white">
                {pending}
              </span>
            )}
          </Link>
        ))}
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-medium text-neutral-400 hover:text-red-400"
        >
          <LogOut className="h-5 w-5" strokeWidth={1.75} />
          Sign out
        </button>
      </nav>

      {/* Scrollable Content Container with Compact Top Padding */}
      <main className="flex-1 overflow-y-auto pt-16 pb-24 md:pt-6 md:ml-64 md:pb-6">
        <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}