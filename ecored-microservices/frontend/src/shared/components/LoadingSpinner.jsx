/**
 * Indicador de carga reutilizable.
 */
export default function LoadingSpinner({ label = "Cargando", fullPage = false }) {
  const className = fullPage
    ? "loading-container loading-container--full"
    : "loading-container";

  return (
    <div className={className} role="status" aria-live="polite">
      <div className="spinner-border text-primary" aria-hidden="true" />
      <span>{label}…</span>
    </div>
  );
}
