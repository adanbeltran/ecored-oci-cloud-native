/**
 * Pantalla de diagnóstico para fallos ocurridos antes de montar la aplicación.
 *
 * Se utiliza principalmente cuando faltan variables del archivo .env o cuando
 * un módulo principal no puede cargarse. Su objetivo es impedir que el usuario
 * reciba una página completamente blanca sin explicación.
 */
export default function StartupError({ title, message, missingVariables = [] }) {
  return (
    <main className="auth-page">
      <section className="card shadow-sm startup-error-card" role="alert">
        <div className="card-body p-4 p-md-5">
          <h1 className="h3 mb-3 text-danger">{title}</h1>
          <p className="mb-3">{message}</p>

          {missingVariables.length > 0 && (
            <>
              <p className="fw-semibold mb-2">Variables pendientes:</p>
              <ul className="mb-4">
                {missingVariables.map((variableName) => (
                  <li key={variableName}>
                    <code>{variableName}</code>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="text-muted mb-0">
            Después de modificar <code>.env</code>, detenga y vuelva a ejecutar
            <code> npm run dev</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
