export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-8 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-8 text-center">
      <p className="font-medium text-red-700">Não foi possível carregar os dados.</p>
      <p className="mt-1 text-sm text-red-600">{message}</p>
    </div>
  );
}
