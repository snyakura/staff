import { supabase } from "@/integrations/supabase/client";

/** Pushes a message or a decision to the client's open chat instantly. */
export function liveSend(caseId: string, event: "staff" | "status", payload: Record<string, unknown>) {
  const ch = supabase.channel(`case:${caseId}`);
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void ch.send({ type: "broadcast", event, payload }).then(() => supabase.removeChannel(ch));
    }
  });
}