import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoadingState } from "./components/LoadingState";
import { AlertRulesPage } from "./pages/AlertRulesPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AnimalDetailPage } from "./pages/AnimalDetailPage";
import { AnimalsPage } from "./pages/AnimalsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { GatewaysPage } from "./pages/GatewaysPage";
import { LoginPage } from "./pages/LoginPage";
import { PropertiesPage } from "./pages/PropertiesPage";
import { SettingsPage } from "./pages/SettingsPage";

// MapLibre GL is ~1MB minified and only needed on these two screens — keeping
// it out of the initial bundle matters for a product used over rural mobile
// data.
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/map"
            element={
              <Suspense fallback={<LoadingState label="Carregando mapa..." />}>
                <MapPage />
              </Suspense>
            }
          />
          <Route path="/animals" element={<AnimalsPage />} />
          <Route path="/animals/:id" element={<AnimalDetailPage />} />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/gateways" element={<GatewaysPage />} />
          <Route
            path="/history"
            element={
              <Suspense fallback={<LoadingState label="Carregando histórico..." />}>
                <HistoryPage />
              </Suspense>
            }
          />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/alert-rules" element={<AlertRulesPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
