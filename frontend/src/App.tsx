import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoadingState } from "./components/LoadingState";
import { DevicesPage } from "./pages/DevicesPage";
import { GatewaysPage } from "./pages/GatewaysPage";
import { LoginPage } from "./pages/LoginPage";

// MapLibre GL is only needed on the map — keeping
// it out of the initial bundle matters for a product used over rural mobile
// data.
const MapPage = lazy(() => import("./pages/MapPage").then((m) => ({ default: m.MapPage })));

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/map" replace />} />
          <Route
            path="/map"
            element={
              <Suspense fallback={<LoadingState label="Carregando mapa..." />}>
                <MapPage />
              </Suspense>
            }
          />
          <Route path="/devices" element={<DevicesPage />} />
          <Route path="/gateways" element={<GatewaysPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/map" replace />} />
    </Routes>
  );
}
