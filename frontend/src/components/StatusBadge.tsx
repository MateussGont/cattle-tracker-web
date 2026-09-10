import type { CommunicationStatus } from "../types";

const LABELS: Record<CommunicationStatus, string> = {
  online: "Online",
  attention: "Atenção",
  offline: "Offline",
  never_seen: "Sem comunicação",
};

const DOT_CLASSES: Record<CommunicationStatus, string> = {
  online: "bg-status-online",
  attention: "bg-status-attention",
  offline: "bg-status-offline",
  never_seen: "bg-status-unknown",
};

export function StatusBadge({ status }: { status: CommunicationStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
      <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[status]}`} aria-hidden />
      {LABELS[status]}
    </span>
  );
}
