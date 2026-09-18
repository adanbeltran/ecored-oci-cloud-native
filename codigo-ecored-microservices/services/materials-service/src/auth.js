/**
 * Convierte los encabezados internos del gateway en la identidad de la petición.
 *
 * Este servicio no valida Firebase de nuevo. Por eso debe ser privado y solo
 * recibir tráfico del gateway o de otros servicios confiables.
 */
export function gatewayIdentity(req, res, next) {
  const uid = String(req.get("X-User-Id") || "").trim();
  if (!uid) {
    return res.status(401).json({ detail: "Falta la identidad validada por el gateway" });
  }
  req.identity = {
    uid,
    email: String(req.get("X-User-Email") || "").trim(),
  };
  return next();
}
