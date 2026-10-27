import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function useLive() {
  const qc = useQueryClient();
  useEffect(() => {
    const refresh = () => qc.invalidateQueries();
    const ch = supabase
      .channel("staff-live-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "cases" }, (p) => {
        refresh();
        if (p.eventType === "INSERT") toast("New client request received");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, refresh)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}