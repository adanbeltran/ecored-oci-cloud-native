import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "../../../config/firebase.js";

/**
 * Autentica un usuario mediante correo y contraseña.
 */
export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Autentica un usuario mediante el proveedor de Google.
 */
export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/**
 * Finaliza la sesión administrada por Firebase.
 */
export function logout() {
  return signOut(auth);
}

/**
 * Suscribe la aplicación a los cambios reales de la sesión Firebase.
 */
export function observeAuthState(onChange, onError) {
  return onAuthStateChanged(auth, onChange, onError);
}

/**
 * Obtiene un ID token vigente para autenticar una llamada al backend.
 * Firebase renueva el token automáticamente cuando está próximo a expirar.
 */
export async function getCurrentIdToken() {
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
