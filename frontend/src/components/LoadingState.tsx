export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-slate-500">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        {label}
      </div>
    </div>
  );
}
