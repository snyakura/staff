import { AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink font-display text-[11px] font-extrabold text-primary", className)}>
      {initials}
    </div>
  );
}

export function FlagChip({ label, tone }: { label: string; tone: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
        tone === "danger" ? "bg-danger-soft text-destructive" : "bg-warn-soft text-warn-foreground",
      )}
    >
      <AlertTriangle className="h-3 w-3" /> {label}
    </span>
  );
}

export function KindIcon({ kind }: { kind: string }) {
  return kind === "deposit" ? (
    <ArrowDownLeft className="h-3 w-3 text-success" />
  ) : (
    <ArrowUpRight className="h-3 w-3 text-destructive" />
  );
}

export function PageHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-[26px] font-extrabold leading-tight">{title}</h1>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

export function Pills<T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full px-5 py-1.5 text-[11px] font-semibold transition-colors",
            value === o.v ? "bg-ink text-primary" : "bg-card text-foreground hover:bg-muted",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("panel", className)}>{children}</div>;
}
