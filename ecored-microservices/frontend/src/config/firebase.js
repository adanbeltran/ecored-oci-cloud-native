import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { env } from "./env.js";

/**
 * Configuración única de Firebase.
 *
 * getApps evita inicializar una segunda instancia durante React Refresh. La
 * configuración proviene exclusivamente de variables VITE_*.
 */
const firebaseApp = getApps().length
  ? getApp()
  : initializeApp({
      apiKey: env.firebase.apiKey,
      authDomain: env.firebase.authDomain,
      projectId: env.firebase.projectId,
      appId: env.firebase.appId,
    });

export const auth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();

// Solicita al usuario escoger una cuenta en cada autenticación interactiva.
googleProvider.setCustomParameters({ prompt: "select_account" });

export { firebaseApp };
