import "dotenv/config";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Falta la variable obligatoria ${name}`);
  return value;
}

/**
 * Configuración inmutable del servicio.
 *
 * Las credenciales se leen del entorno para no incorporarlas en el código ni
 * en la imagen. required() hace que el proceso falle temprano si falta una.
 */
export const config = Object.freeze({
  port: Number(process.env.PORT || 8002),
  host: process.env.HOST || "127.0.0.1",
  oracle: Object.freeze({
    user: required("ORACLE_USER"),
    password: required("ORACLE_PASSWORD"),
    connectString: required("ORACLE_CONNECT_STRING"),
  }),
  companiesServiceUrl: process.env.COMPANIES_SERVICE_URL || "http://127.0.0.1:8001/api",
});
