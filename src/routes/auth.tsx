import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Coinspace Staff" },
      { name: "description", content: "Staff sign-in for the Coinspace review queue." },
      { property: "og:title", content: "Sign in — Coinspace Staff" },
      { property: "og:description", content: "Staff sign-in for the Coinspace review queue." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [forgot, setForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (forgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Check your email to set a new password.");
        setForgot(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/queue", replace: true });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-full bg-card px-6 py-3.5 text-sm shadow-sm outline-none placeholder:text-foreground focus:ring-2 focus:ring-ring";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-[260px] text-center">
        <h1 className="mb-8 flex items-center justify-center gap-1 font-display text-[32px] font-extrabold leading-none">
          COINSPACE<span className="text-primary">*</span>
        </h1>
        <div className="space-y-3">
          <input className={field} type="email" placeholder="Email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {!forgot && (
            <input className={field} type="password" placeholder="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          )}
          <button disabled={busy} className="w-full rounded-full bg-ink py-3.5 text-sm text-ink-foreground disabled:opacity-60">
            {busy ? "Please wait…" : forgot ? "Send reset link" : "Log in"}
          </button>
        </div>
        <p className="mt-5 text-xs">
          {forgot ? "Remembered it? " : "Forgot or want to change your password? "}
          <button type="button" onClick={() => setForgot(!forgot)} className="font-bold">
            {forgot ? "Log in" : "Reset"}
          </button>
        </p>
      </form>
    </div>
  );
}
