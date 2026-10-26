import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set new password — Coinspace Staff" },
      { name: "description", content: "Choose a new password for your Coinspace staff account." },
      { property: "og:title", content: "Set new password — Coinspace Staff" },
      { property: "og:description", content: "Choose a new password for your Coinspace staff account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    navigate({ to: "/queue", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-card px-4">
      <form onSubmit={submit} className="w-full max-w-[330px] rounded-[28px] border bg-card px-10 py-10 text-center">
        <h1 className="text-2xl font-medium tracking-tight">Set a new password</h1>
        <input
          className="mt-8 w-full rounded-xl border bg-card px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          type="password" placeholder="New password" minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} required
        />
        <button disabled={busy} className="mt-3 w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-ink-foreground disabled:opacity-60">
          {busy ? "Please wait…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
