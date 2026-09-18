import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../features/auth/routes/ProtectedRoute.jsx";
import useAuth from "../features/auth/hooks/useAuth.js";
import LoadingSpinner from "../shared/components/LoadingSpinner.jsx";
import AppLayout from "../shared/layouts/AppLayout.jsx";
import NotFoundPage from "../shared/pages/NotFoundPage.jsx";

// Las páginas se cargan únicamente cuando la ruta correspondiente se visita.
const LoginPage = lazy(() => import("../features/auth/pages/LoginPage.jsx"));
const HomePage = lazy(() => import("../features/home/pages/HomePage.jsx"));
const CompaniesPage = lazy(() =>
  import("../features/companies/pages/CompaniesPage.jsx"),
);
const MaterialsPage = lazy(() =>
  import("../features/materials/pages/MaterialsPage.jsx"),
);

/**
 * Decide el destino inicial una vez Firebase termina de restaurar la sesión.
 */
function RootRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullPage label="Verificando sesión" />;
  }

  return <Navigate to={user ? "/home" : "/login"} replace />;
}

/**
 * Mapa central de navegación.
 *
 * Las rutas funcionales se agrupan bajo ProtectedRoute y AppLayout. La ruta
 * histórica /company se conserva como alias para no romper enlaces previos.
 */
export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage label="Cargando módulo" />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route
              path="/company"
              element={<Navigate to="/companies" replace />}
            />
            <Route path="/materials" element={<MaterialsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
