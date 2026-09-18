import ModuleCard from "../../../shared/components/ModuleCard.jsx";
import useAuth from "../../auth/hooks/useAuth.js";

/**
 * Panel inicial del usuario autenticado.
 */
export default function HomePage() {
  const { user } = useAuth();
  const displayName = user?.displayName || "Usuario autenticado";

  return (
    <section aria-labelledby="home-title">
      <div className="mb-4">
        <h1 id="home-title" className="page-title">
          Inicio
        </h1>
        <p className="text-muted mb-0">
          Selecciona el módulo al que deseas ingresar.
        </p>
      </div>

      <article className="card shadow-sm mb-4">
        <div className="card-body text-center p-4">
          <h2 className="h4">Usuario autenticado</h2>
          <p className="mb-1">
            <strong>Nombre:</strong> {displayName}
          </p>
          <p className="mb-0">
            <strong>Correo:</strong> {user?.email ?? "No disponible"}
          </p>
        </div>
      </article>

      <div className="row g-4">
        <div className="col-md-6">
          <ModuleCard
            title="Empresas"
            description="Registra empresas asociadas al usuario autenticado y deja disponible la información para otros módulos."
            to="/companies"
            actionLabel="Ir a Empresas"
            variant="primary"
          />
        </div>

        <div className="col-md-6">
          <ModuleCard
            title="Materiales"
            description="Consulta y registra publicaciones de materiales relacionadas con las empresas disponibles."
            to="/materials"
            actionLabel="Ir a Materiales"
            variant="success"
          />
        </div>
      </div>
    </section>
  );
}
