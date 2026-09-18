import { NavLink, Outlet, useNavigate } from "react-router-dom";
import useAuth from "../../features/auth/hooks/useAuth.js";

/**
 * Estructura visual común para todas las rutas privadas.
 */
export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navClassName = ({ isActive }) =>
    `nav-link${isActive ? " active" : ""}`;

  return (
    <div className="app-shell">
      <nav className="navbar navbar-expand-lg bg-white border-bottom shadow-sm">
        <div className="container">
          <NavLink className="navbar-brand fw-semibold" to="/home">
            EcoRed Circular
          </NavLink>

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#main-navigation"
            aria-controls="main-navigation"
            aria-expanded="false"
            aria-label="Mostrar navegación"
          >
            <span className="navbar-toggler-icon" />
          </button>

          <div className="collapse navbar-collapse" id="main-navigation">
            <div className="navbar-nav me-auto">
              <NavLink className={navClassName} to="/home">
                Inicio
              </NavLink>
              <NavLink className={navClassName} to="/companies">
                Empresas
              </NavLink>
              <NavLink className={navClassName} to="/materials">
                Materiales
              </NavLink>
            </div>

            <div className="d-flex align-items-center gap-3 mt-3 mt-lg-0">
              <span className="small text-muted text-truncate user-email">
                {user?.email}
              </span>
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container py-5">
        <Outlet />
      </main>
    </div>
  );
}
