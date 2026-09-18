import { useState } from "react";

const INITIAL_FORM = Object.freeze({
  company_id: "",
  material_type: "",
  quantity: "",
  unit: "kg",
  location: "",
});

/**
 * Formulario de publicación de materiales.
 */
export default function MaterialForm({ companies, onSubmit }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = ({ target }) => {
    setForm((current) => ({
      ...current,
      [target.name]: target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        // MongoDB entrega un ObjectId textual; se conserva sin conversiones.
        company_id: form.company_id,
        material_type: form.material_type.trim(),
        quantity: Number(form.quantity),
        unit: form.unit.trim(),
        location: form.location.trim(),
      });
      setForm(INITIAL_FORM);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formDisabled = isSubmitting || companies.length === 0;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <label htmlFor="material-company" className="form-label">
          Empresa
        </label>
        <select
          id="material-company"
          name="company_id"
          className="form-select"
          value={form.company_id}
          onChange={handleChange}
          required
          disabled={formDisabled}
        >
          <option value="">Seleccione empresa</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        {companies.length === 0 && (
          <div className="form-text">
            Registra primero una empresa para publicar materiales.
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="material-type" className="form-label">
          Tipo de material
        </label>
        <input
          id="material-type"
          type="text"
          name="material_type"
          className="form-control"
          placeholder="Ej. Cartón, plástico, vidrio"
          value={form.material_type}
          onChange={handleChange}
          required
          disabled={formDisabled}
        />
      </div>

      <div className="row">
        <div className="col-md-6 mb-3">
          <label htmlFor="material-quantity" className="form-label">
            Cantidad
          </label>
          <input
            id="material-quantity"
            type="number"
            name="quantity"
            className="form-control"
            placeholder="Ej. 80"
            value={form.quantity}
            onChange={handleChange}
            min="0.01"
            step="any"
            required
            disabled={formDisabled}
          />
        </div>

        <div className="col-md-6 mb-3">
          <label htmlFor="material-unit" className="form-label">
            Unidad
          </label>
          <input
            id="material-unit"
            type="text"
            name="unit"
            className="form-control"
            placeholder="Ej. kg"
            value={form.unit}
            onChange={handleChange}
            required
            disabled={formDisabled}
          />
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="material-location" className="form-label">
          Ubicación
        </label>
        <input
          id="material-location"
          type="text"
          name="location"
          className="form-control"
          placeholder="Ciudad o ubicación del material"
          value={form.location}
          onChange={handleChange}
          autoComplete="address-level2"
          required
          disabled={formDisabled}
        />
      </div>

      <div className="d-grid">
        <button type="submit" className="btn btn-success" disabled={formDisabled}>
          {isSubmitting ? "Creando…" : "Crear publicación"}
        </button>
      </div>
    </form>
  );
}
