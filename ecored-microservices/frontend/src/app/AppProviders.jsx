import { BrowserRouter } from "react-router-dom";
import AuthProvider from "../features/auth/context/AuthProvider.jsx";

/**
 * Registra los proveedores transversales de la aplicación.
 *
 * BrowserRouter administra la navegación del lado del cliente y AuthProvider
 * expone el estado de Firebase Authentication a todo el árbol de componentes.
 */
export default function AppProviders({ children }) {
  return (
    <BrowserRouter>
      <AuthProvider>{children}</AuthProvider>
    </BrowserRouter>
  );
}
