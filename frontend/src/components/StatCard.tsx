interface StatCardProps {
  label: string;
  value: number | string;
  tone?: "default" | "online" | "attention" | "offline";
}

const TONE_CLASSES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-900",
  online: "text-status-online",
  attention: "text-status-attention",
  offline: "text-status-offline",
};

export function StatCard({ label, value, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${TONE_CLASSES[tone]}`}>{value}</p>
    </div>
  );
}
