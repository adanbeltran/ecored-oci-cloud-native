import { Link } from "react-router-dom";

/**
 * Respuesta visual para rutas no definidas.
 */
export default function NotFoundPage() {
  return (
    <main className="auth-page text-center">
      <section className="card shadow-sm p-5">
        <h1 className="display-5">404</h1>
        <p className="text-muted">La página solicitada no existe.</p>
        <Link to="/" className="btn btn-primary">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
