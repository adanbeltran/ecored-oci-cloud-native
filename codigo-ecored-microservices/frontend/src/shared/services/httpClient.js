import axios from "axios";
import { env } from "../../config/env.js";
import { getCurrentIdToken } from "../../features/auth/services/authService.js";

/**
 * Cliente HTTP único de la aplicación.
 *
 * Centraliza URL base, cabeceras, tiempo de espera y autenticación. Cada
 * servicio funcional solo declara el endpoint y el método HTTP que necesita.
 */
const httpClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

httpClient.interceptors.request.use(
  async (config) => {
    const token = await getCurrentIdToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

export default httpClient;
