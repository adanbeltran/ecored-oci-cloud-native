/**
 * Mensaje accesible y reutilizable para estados de éxito, error o información.
 */
export default function AlertMessage({ type = "info", message }) {
  if (!message) {
    return null;
  }

  return (
    <div className={`alert alert-${type}`} role="alert">
      {message}
    </div>
  );
}
