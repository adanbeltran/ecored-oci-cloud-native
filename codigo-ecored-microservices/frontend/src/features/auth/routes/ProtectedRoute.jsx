import { Navigate, Outlet, useLocation } from "react-router-dom";
import LoadingSpinner from "../../../shared/components/LoadingSpinner.jsx";
import useAuth from "../hooks/useAuth.js";

/**
 * Guardia declarativa para rutas privadas.
 *
 * Espera a que Firebase determine el estado de sesión. Cuando no existe un
 * usuario, conserva la ubicación solicitada para regresar después del login.
 */
export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullPage label="Verificando autorización" />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
