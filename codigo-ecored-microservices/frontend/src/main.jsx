import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/global.css";
import {
  getMissingEnvironmentVariables,
  isEnvironmentConfigured,
} from "./config/env.js";
import StartupError from "./shared/components/StartupError.jsx";

/**
 * Nodo HTML donde React monta la interfaz completa.
 */
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("No se encontró el elemento HTML #root en index.html.");
}

const root = createRoot(rootElement);

/**
 * Monta una pantalla de error legible cuando el frontend no puede iniciar.
 */
function renderStartupError({ title, message, missingVariables = [] }) {
  root.render(
    <StrictMode>
      <StartupError
        title={title}
        message={message}
        missingVariables={missingVariables}
      />
    </StrictMode>,
  );
}

/**
 * Antes de importar App se verifica el archivo .env.
 *
 * Firebase se inicializa dentro del árbol de módulos de App. La importación
 * dinámica evita inicializarlo con valores vacíos y, por tanto, evita una
 * pantalla blanca causada por una excepción durante el arranque.
 */
if (!isEnvironmentConfigured()) {
  renderStartupError({
    title: "Configuración incompleta",
    message:
      "El frontend no puede inicializar Firebase ni conectarse con el backend porque faltan variables de entorno.",
    missingVariables: getMissingEnvironmentVariables(),
  });
} else {
  import("./app/App.jsx")
    .then(({ default: App }) => {
      // createElement hace explícito el uso del componente importado dinámicamente.
      root.render(createElement(StrictMode, null, createElement(App)));
    })
    .catch((error) => {
      console.error("Error durante el arranque del frontend:", error);
      renderStartupError({
        title: "No fue posible iniciar la aplicación",
        message:
          "Se produjo un error al cargar los módulos principales. Revise la consola del navegador y la terminal de Vite.",
      });
    });
}
