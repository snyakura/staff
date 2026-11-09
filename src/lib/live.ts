import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
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

// ---- "open this chat" requests (the queue page listens for them) ----
const OPEN_KEY = "staff_open_case";
let chatOpen = false; // the queue page tells us whether a chat panel is open right now

export const setStaffChatOpen = (v: boolean) => {
  chatOpen = v;
};

export function requestOpenCase(id: string) {
  try { sessionStorage.setItem(OPEN_KEY, id); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("staff:open-case", { detail: id }));
}

export function takePendingCase(): string | null {
  try {
    const v = sessionStorage.getItem(OPEN_KEY);
    sessionStorage.removeItem(OPEN_KEY);
    return v;
  } catch {
    return null;
  }
}

/** Keeps every page live: new cases, client messages and activity appear without refreshing. */
export function useLive() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const refresh = () => qc.invalidateQueries();
    const announce = (id: string, text: string) => {
      beep();
      const onQueue = pathRef.current.startsWith("/queue");
      // nothing open on the queue page: open this client's chat, with its history
      if (onQueue && !chatOpen) requestOpenCase(id);
      toast(text.slice(0, 80), {
        description: "New message from a client",
        action: {
          label: "Open chat",
          onClick: () => {
            if (!pathRef.current.startsWith("/queue")) navigate({ to: "/queue" });
            requestOpenCase(id);
          },
        },
      });
    };

    const ch = supabase
      .channel("staff-live-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, (p: any) => {
        refresh();
        const row = p.new;
        const chat = row?.chat;
        const last = Array.isArray(chat) ? chat[chat.length - 1] : null;
        if (p.eventType === "INSERT") {
          announce(row.id, "New client request received");
        } else if (p.eventType === "UPDATE" && last?.from === "client" && Date.now() - Date.parse(last.at) < 8000 && last.text) {
          announce(row.id, String(last.text));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, navigate]);
}