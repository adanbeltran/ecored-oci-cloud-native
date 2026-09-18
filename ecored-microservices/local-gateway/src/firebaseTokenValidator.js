import { createRemoteJWKSet, jwtVerify } from "jose";

export const DEFAULT_FIREBASE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

export class AuthenticationError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "AuthenticationError";
  }
}

/** Extrae el JWT y rechaza encabezados con un esquema diferente de Bearer. */
export function extractBearerToken(authorization) {
  const match = typeof authorization === "string"
    ? authorization.match(/^Bearer\s+(\S+)$/i)
    : null;

  if (!match) {
    throw new AuthenticationError("Falta un token Bearer de Firebase");
  }
  return match[1];
}

export function createFirebaseTokenValidator({
  projectId,
  jwksUrl = DEFAULT_FIREBASE_JWKS_URL,
  keyResolver,
  clockTolerance = 30,
} = {}) {
  // Project ID participa tanto en issuer como en audience.
  const normalizedProjectId = String(projectId || "").trim();
  if (!normalizedProjectId) throw new Error("Falta projectId para validar Firebase");

  // El resolvedor remoto descarga y almacena temporalmente las claves públicas.
  const keys = keyResolver || createRemoteJWKSet(new URL(jwksUrl));
  const issuer = `https://securetoken.google.com/${normalizedProjectId}`;

  return async function validateFirebaseToken(authorization) {
    try {
      const token = extractBearerToken(authorization);
      // jwtVerify valida criptografía y claims; decodificar no sería suficiente.
      const { payload } = await jwtVerify(token, keys, {
        algorithms: ["RS256"],
        issuer,
        audience: normalizedProjectId,
        clockTolerance,
      });

      if (typeof payload.sub !== "string" || !payload.sub.trim()) {
        throw new AuthenticationError("El token no contiene un UID válido");
      }

      // Solo claims verificados pueden convertirse en identidad interna.
      return {
        uid: payload.sub,
        email: typeof payload.email === "string" ? payload.email : "",
      };
    } catch (error) {
      if (error instanceof AuthenticationError) throw error;
      throw new AuthenticationError("Token de Firebase inválido o expirado", { cause: error });
    }
  };
}
