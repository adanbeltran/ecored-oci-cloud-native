/**
 * Extrae un mensaje legible de respuestas HTTP, errores de Firebase o fallos de
 * red sin acoplar los componentes a una estructura concreta del backend.
 */
export function getErrorMessage(error, fallback = "Ocurrió un error inesperado.") {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (typeof data?.detail === "string") {
    return data.detail;
  }

  if (typeof data?.message === "string") {
    return data.message;
  }

  if (data && typeof data === "object") {
    const firstValue = Object.values(data).flat().find(Boolean);

    if (typeof firstValue === "string") {
      return firstValue;
    }
  }

  if (error?.code === "ERR_NETWORK") {
    return "No fue posible establecer comunicación con el backend.";
  }

  return fallback;
}
