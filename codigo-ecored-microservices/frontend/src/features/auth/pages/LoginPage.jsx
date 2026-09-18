import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import AlertMessage from "../../../shared/components/AlertMessage.jsx";
import LoadingSpinner from "../../../shared/components/LoadingSpinner.jsx";
import { getErrorMessage } from "../../../shared/utils/getErrorMessage.js";
import LoginForm from "../components/LoginForm.jsx";
import useAuth from "../hooks/useAuth.js";

/**
 * Página pública de autenticación.
 *
 * Coordina el estado de envío, traduce errores técnicos y redirige al destino
 * que el usuario intentaba visitar antes de iniciar sesión.
 */
export default function LoginPage() {
  const { user, loading, loginWithEmail, loginWithGoogle } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const destination = location.state?.from?.pathname ?? "/home";

  if (loading) {
    return <LoadingSpinner fullPage label="Restaurando sesión" />;
  }

  if (user) {
    return <Navigate to="/home" replace />;
  }

  const executeLogin = async (operation) => {
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await operation();
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "No fue posible iniciar sesión. Verifique sus datos."),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailLogin = ({ email, password }) =>
    executeLogin(() => loginWithEmail(email, password));

  const handleGoogleLogin = () => executeLogin(loginWithGoogle);

  return (
    <main className="auth-page">
      <section className="card shadow-sm auth-card" aria-labelledby="login-title">
        <div className="card-body p-4 p-md-5">
          <h1 id="login-title" className="h3 text-center mb-3">
            Iniciar sesión
          </h1>
          <p className="text-muted text-center mb-4">
            Ingresa con correo y contraseña o utiliza tu cuenta de Google.
          </p>

          <AlertMessage type="danger" message={errorMessage} />

          <LoginForm
            onEmailLogin={handleEmailLogin}
            onGoogleLogin={handleGoogleLogin}
            isSubmitting={isSubmitting}
          />
        </div>
      </section>
    </main>
  );
}
