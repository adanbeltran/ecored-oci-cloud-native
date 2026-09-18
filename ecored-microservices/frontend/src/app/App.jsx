import AppProviders from "./AppProviders.jsx";
import AppRouter from "./AppRouter.jsx";

/**
 * Componente raíz.
 *
 * Mantiene separadas dos responsabilidades globales: los proveedores de
 * infraestructura y la definición de rutas.
 */
export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
