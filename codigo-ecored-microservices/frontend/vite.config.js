import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Configuración de Vite.
 *
 * El plugin oficial de React habilita la transformación de JSX y la
 * actualización rápida de componentes durante el desarrollo.
 */
export default defineConfig({
  plugins: [react()],
});
