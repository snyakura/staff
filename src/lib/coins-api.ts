import { supabase } from "@/integrations/supabase/client";
import { money } from "@/lib/data";

/**
 * Deriv deposits are paid out by the Coinspace payments server (the Coins project), because only that server holds the
 * Deriv agent token. Marking a case "approved" here would send nothing. So for a Deriv deposit case, Approve / Reject
 * must go through that server first, with the staff member's own login token.
 *
 * Set VITE_COINS_API_URL only if the payments server is not at https://coinspace.digital.
 */
const COINS_API = ((import.meta.env["VITE_COINS_API_URL"] as string | undefined) || "https://coinspace.digital").replace(/\/+$/, "");

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const asId = (v: unknown): string | null => (typeof v === "string" && ID.test(v) ? v : null);

/**
 * The id of the Deriv deposit on the payments server, or null when this case is not a Deriv deposit.
 * The chat app stores it twice on purpose: in the AI read (`ai_read.deriv_deposit_id`) and as a marker message in the chat.
 */
export function derivDepositId(c: any): string | null {
  if (!c || c.kind !== "deposit") return null;
  const fromRead = asId(c.ai_read?.deriv_deposit_id);
  if (fromRead) return fromRead;
  const chat: any[] = Array.isArray(c.chat) ? c.chat : [];
  for (const m of chat) {
    const id = asId(m?.deriv_deposit_id);
    if (id) return id;
  }
  return null;
}

/** A deposit case that is labelled as Deriv ("Deriv · Ecocash") but has no deposit id. It must never be approved with the old, local-only button. */
export const looksLikeDerivDeposit = (c: any): boolean =>
  !!c && c.kind === "deposit" && typeof c.platform === "string" && /^deriv\b/i.test(c.platform.trim());

function explain(status: number, body: any, approve: boolean): string {
  const code: string | undefined = body?.code;
  if (status === 401) return "The payments server didn't accept your sign-in. Sign out of the staff dashboard, sign back in, and try again.";
  if (status === 403) return 'Your account is not allowed to approve Deriv deposits. Its Supabase app_metadata needs { "role": "admin" }.';
  if (status === 404) return "The payments server can't find this Deriv deposit.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (code === "NO_PROOF") return "The client hasn't uploaded proof for this deposit on the payments server yet. Ask them to send it again (the quick reply “Please resend proof” does that).";
  if (status === 409)
    return `${body?.error ?? "This deposit has already been processed."} Check this deposit in the Coins admin before trying again.`;
  return body?.error ?? `The payments server returned an error (${status}). Check this deposit in the Coins admin before trying ${approve ? "to approve" : "to reject"} it again.`;
}

/**
 * Sends the decision for one Deriv deposit to the payments server.
 * Returns a short sentence when the decision is done and the case can be closed here.
 * Throws an Error (with a message for staff) in every other situation, and then the case is left untouched.
 */
export async function sendDerivDecision(depositId: string, decision: "approved" | "rejected"): Promise<{ done: string }> {
  const approve = decision === "approved";
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your staff session has expired. Please sign in again.");

  let res: Response;
  try {
    res = await fetch(`${COINS_API}/api/deposits/${encodeURIComponent(depositId)}/${approve ? "approve" : "reject"}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    throw new Error(
      "Couldn't reach the Coinspace payments server, so we can't confirm what happened. Check this deposit in the Coins admin before trying again. (If this keeps happening, the dashboard's address may not be allowed on the payments server yet.)",
    );
  }

  const body: any = await res.json().catch(() => ({}));

  if (!res.ok) {
    // Nothing was ever sent to Deriv for this deposit and it can't be, because no proof reached the server. Closing the case here is safe.
    if (!approve && body?.code === "NO_PROOF") return { done: "Rejected. The client had not sent proof to the payments server, so nothing was sent to Deriv." };
    throw new Error(explain(res.status, body, approve));
  }

  const d = body?.deposit ?? {};
  const net = money(Number(d.net_amount));
  if (!approve) {
    if (d.status === "REJECTED") return { done: "Rejected. Nothing was sent to Deriv." };
    throw new Error(`The payments server returned an unexpected status (${d.status ?? "unknown"}). Check this deposit in the Coins admin.`);
  }
  switch (d.status) {
    case "COMPLETED":
      return { done: `Sent to Deriv: ${net} credited to ${d.deriv_nickname}.` };
    case "PROCESSING_DERIV":
      return { done: `Approved. Deriv is still processing the ${net} transfer to ${d.deriv_nickname}; it finishes on its own.` };
    case "FAILED":
      throw new Error(`Deriv did not accept the transfer${d.error_message ? `: ${d.error_message}` : ""}. Nothing was sent. Check this deposit in the Coins admin.`);
    default:
      throw new Error(`The payments server returned an unexpected status (${d.status ?? "unknown"}). Check this deposit in the Coins admin before trying again.`);
  }
}