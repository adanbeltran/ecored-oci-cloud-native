import httpClient from "../../../shared/services/httpClient.js";

const COMPANIES_ENDPOINT = "/companies";

/**
 * Consulta las empresas visibles para el usuario autenticado.
 */
export async function listCompanies({ signal } = {}) {
  const response = await httpClient.get(COMPANIES_ENDPOINT, { signal });
  return response.data;
}

/**
 * Crea una empresa mediante el contrato actual del backend.
 */
export async function createCompany(company) {
  const response = await httpClient.post(COMPANIES_ENDPOINT, company);
  return response.data;
}
