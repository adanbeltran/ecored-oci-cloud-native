import { useState } from "react";

const INITIAL_FORM = Object.freeze({
  email: "",
  password: "",
});

/**
 * Formulario presentacional de autenticación.
 *
 * Mantiene los campos controlados y delega la operación de Firebase a la página
 * contenedora mediante callbacks.
 */
export default function LoginForm({
  onEmailLogin,
  onGoogleLogin,
  isSubmitting,
}) {
  const [form, setForm] = useState(INITIAL_FORM);

  const handleChange = ({ target }) => {
    setForm((current) => ({
      ...current,
      [target.name]: target.value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onEmailLogin({
      email: form.email.trim(),
      password: form.password,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-3 text-start">
        <label htmlFor="login-email" className="form-label">
          Correo electrónico
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
          className="form-control"
          placeholder="correo@ejemplo.com"
          value={form.email}
          onChange={handleChange}
          autoComplete="email"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="mb-4 text-start">
        <label htmlFor="login-password" className="form-label">
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          className="form-control"
          placeholder="********"
          value={form.password}
          onChange={handleChange}
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="d-grid gap-3">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? "Autenticando…" : "Ingresar con correo y contraseña"}
        </button>

        <div className="text-center text-muted" aria-hidden="true">
          o
        </div>

        <button
          type="button"
          className="btn btn-outline-dark"
          onClick={onGoogleLogin}
          disabled={isSubmitting}
        >
          Ingresar con Google
        </button>
      </div>
    </form>
  );
}
