/** Error esperado cuando el JSON no cumple el contrato de Materiales. */
export class ValidationError extends Error {}

/** Valida datos no confiables y retorna un objeto nuevo listo para persistir. */
export function validateMaterial(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("El cuerpo debe ser un objeto JSON");
  }
  // La conversión a texto normaliza valores sin mutar req.body.
  const companyId = String(payload.company_id || "").trim();
  const materialType = String(payload.material_type || "").trim();
  const unit = String(payload.unit || "").trim();
  const location = String(payload.location || "").trim();
  const quantity = Number(payload.quantity);

  if (!companyId || !materialType || !unit || !location) {
    throw new ValidationError("company_id, material_type, unit y location son obligatorios");
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new ValidationError("quantity debe ser un número mayor que cero");
  }
  // El cliente no decide el estado inicial: la regla de negocio lo fija.
  return {
    company_id: companyId,
    material_type: materialType,
    quantity,
    unit,
    location,
    status: "available",
  };
}
