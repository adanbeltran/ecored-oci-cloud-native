import { useContext } from "react";
import AuthContext from "../context/authContext.js";

/**
 * Acceso seguro al contexto de autenticación.
 */
export default function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  }

  return context;
}
