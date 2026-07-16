import { cn } from "@/lib/utils";

type Status = "available" | "busy" | "off";

const label: Record<Status, string> = {
  available: "Available today",
  busy: "Busy",
  off: "Off duty",
};

export function StatusBadge({ status, size = "md" }: { status: Status; size?: "sm" | "md" | "lg" }) {
  const cls = {
    available: "bg-status-available text-status-available-foreground",
    busy: "bg-status-busy text-status-busy-foreground",
    off: "bg-status-off text-status-off-foreground",
  }[status];
  const sizeCls = size === "lg" ? "text-sm px-3 py-1.5" : size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide", cls, sizeCls)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-90" />
      {label[status]}
    </span>
  );
}
