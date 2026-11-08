import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.start();
    o.stop(ctx.currentTime + 0.15);
  } catch {
    /* browsers block sound until the first click on the page */
  }
}

/** Keeps every page live: new cases, client messages and activity appear without refreshing. */
export function useLive() {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => qc.invalidateQueries();
    const ch = supabase
      .channel("staff-live-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, (p: any) => {
        refresh();
        if (p.eventType === "INSERT") {
          toast("New client request received");
          beep();
        }
        const chat = p.new?.chat;
        const last = Array.isArray(chat) ? chat[chat.length - 1] : null;
        if (p.eventType === "UPDATE" && last?.from === "client" && Date.now() - Date.parse(last.at) < 5000) {
          toast(String(last.text || "New message").slice(0, 80));
          beep();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);
}