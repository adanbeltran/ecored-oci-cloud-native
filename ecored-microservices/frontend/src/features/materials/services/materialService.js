import httpClient from "../../../shared/services/httpClient.js";

const MATERIALS_ENDPOINT = "/materials";

/**
 * Consulta las publicaciones de materiales disponibles.
 */
export async function listMaterials({ signal } = {}) {
  const response = await httpClient.get(MATERIALS_ENDPOINT, { signal });
  return response.data;
}

/**
 * Crea una publicación de material.
 */
export async function createMaterial(material) {
  const response = await httpClient.post(MATERIALS_ENDPOINT, material);
  return response.data;
}
