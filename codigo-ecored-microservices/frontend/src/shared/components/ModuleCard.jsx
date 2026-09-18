import { Link } from "react-router-dom";

/**
 * Tarjeta reutilizable para presentar un módulo funcional en la página inicial.
 */
export default function ModuleCard({
  title,
  description,
  to,
  actionLabel,
  variant = "primary",
}) {
  return (
    <article className="card h-100 shadow-sm module-card">
      <div className="card-body d-flex flex-column p-4 text-center">
        <h2 className="h4">{title}</h2>
        <p className="text-muted flex-grow-1">{description}</p>
        <Link to={to} className={`btn btn-${variant}`}>
          {actionLabel}
        </Link>
      </div>
    </article>
  );
}
