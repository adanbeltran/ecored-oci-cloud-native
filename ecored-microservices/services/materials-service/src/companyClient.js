/**
 * Comprueba por HTTP que la empresa existe y pertenece al mismo usuario.
 *
 * Se usa la API del dueño de los datos en vez de consultar MongoDB directamente;
 * así cada microservicio conserva el control de su propia persistencia.
 */
export async function assertOwnedCompany({ baseUrl, companyId, identity }) {
  const response = await fetch(`${baseUrl}/companies/${encodeURIComponent(companyId)}`, {
    headers: {
      "X-User-Id": identity.uid,
      "X-User-Email": identity.email || "",
    },
    // El timeout evita que una caída de Empresas bloquee indefinidamente Node.
    signal: AbortSignal.timeout(5000),
  });
  if (response.status === 404) {
    const error = new Error("La empresa no existe o no pertenece al usuario");
    error.status = 400;
    throw error;
  }
  if (!response.ok) {
    const error = new Error("No fue posible validar la empresa");
    error.status = 502;
    throw error;
  }
}
