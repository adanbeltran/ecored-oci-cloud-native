import { createContext } from "react";

/**
 * Contrato interno del contexto de autenticación.
 *
 * El valor concreto se suministra desde AuthProvider y se consume únicamente
 * mediante useAuth para evitar accesos sin proveedor.
 */
const AuthContext = createContext(null);

export default AuthContext;
