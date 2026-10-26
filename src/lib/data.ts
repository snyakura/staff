import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ChatItem =
  | { from: "client" | "bot" | "staff"; text: string; at?: string }
  | { from: "pay"; gateway: string; amount: number; merchant: string; code: string; number: string; reference: string }
  | { from: "ai" }
  | { from: "checking" };

export type AiRead = { amount: number; amount_mismatch?: boolean; reference: string; sender: string; confidence: number };

export const money = (n: number) =>
  "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const hhmm = (d: string) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const casesQuery = queryOptions({
  queryKey: ["cases"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("cases")
      .select("*, client:clients(*)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const clientsQuery = queryOptions({
  queryKey: ["clients"],
  queryFn: async () => {
    const [{ data: clients, error }, { data: cases, error: e2 }] = await Promise.all([
      supabase.from("clients").select("*").order("joined_at", { ascending: false }),
      supabase.from("cases").select("client_id, kind, status"),
    ]);
    if (error) throw error;
    if (e2) throw e2;
    return (clients ?? []).map((c) => {
      const mine = (cases ?? []).filter((x) => x.client_id === c.id);
      return {
        ...c,
        depositsApproved: mine.filter((x) => x.kind === "deposit" && x.status === "approved").length,
        total: mine.length,
      };
    });
  },
});

export const activityQuery = queryOptions({
  queryKey: ["activity"],
  queryFn: async () => {
    const { data, error } = await supabase.from("activity").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return data;
  },
});

export const rulesQuery = queryOptions({
  queryKey: ["rules"],
  queryFn: async () => {
    const { data, error } = await supabase.from("rules").select("*").order("sort");
    if (error) throw error;
    return data;
  },
});

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    return { id: u.user.id, email: u.user.email, roles: (roles ?? []).map((r) => r.role) };
  },
});
