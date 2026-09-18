import { useEffect, useMemo, useState } from "react";
import AuthContext from "./authContext.js";
import {
  loginWithEmail as authenticateWithEmail,
  loginWithGoogle as authenticateWithGoogle,
  logout as closeSession,
  observeAuthState,
} from "../services/authService.js";

/**
 * Proveedor del estado global de autenticación.
 *
 * La sesión no se infiere a partir de una cadena guardada manualmente. Firebase
 * informa el usuario real mediante onAuthStateChanged y renueva sus tokens.
 */
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = observeAuthState(
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      loginWithEmail: authenticateWithEmail,
      loginWithGoogle: authenticateWithGoogle,
      logout: closeSession,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
