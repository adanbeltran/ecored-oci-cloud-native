/**
 * Encabezado homogéneo para las páginas funcionales.
 */
export default function PageHeader({ id, title, subtitle }) {
  return (
    <header className="page-header mb-4">
      <h1 id={id} className="page-title">
        {title}
      </h1>
      {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
    </header>
  );
}
