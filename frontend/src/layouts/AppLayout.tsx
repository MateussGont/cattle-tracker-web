import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/map", label: "Mapa" },
  { to: "/animals", label: "Animais" },
  { to: "/devices", label: "Dispositivos" },
  { to: "/gateways", label: "Gateways" },
  { to: "/history", label: "Histórico" },
  { to: "/alerts", label: "Alertas" },
  { to: "/alert-rules", label: "Regras de Alerta" },
  { to: "/properties", label: "Propriedades" },
  { to: "/settings", label: "Configurações" },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  useRealtimeUpdates();

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4">
          <p className="text-lg font-semibold text-slate-900">Cattle Tracker</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <p className="truncate text-sm font-medium text-slate-700">{user?.name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
