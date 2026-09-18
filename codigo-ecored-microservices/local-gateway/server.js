import http from "node:http";

import {
  AuthenticationError,
  createFirebaseTokenValidator,
} from "./src/firebaseTokenValidator.js";

const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || "127.0.0.1";
const projectId = String(process.env.FIREBASE_PROJECT_ID || "").trim();

if (!projectId) {
  throw new Error(
    "Falta FIREBASE_PROJECT_ID. Copie .env.example como .env y configure el proyecto Firebase.",
  );
}

const validateFirebaseToken = createFirebaseTokenValidator({
  projectId,
  jwksUrl: process.env.FIREBASE_JWKS_URL,
});

// La tabla hace explícita la única responsabilidad de enrutamiento local.
const routes = [
  { prefix: "/api/companies", origin: process.env.COMPANIES_URL || "http://127.0.0.1:8001" },
  { prefix: "/api/materials", origin: process.env.MATERIALS_URL || "http://127.0.0.1:8002" },
];

function corsHeaders(req) {
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const requestedOrigin = req.headers.origin;
  const allowedOrigin = allowedOrigins.includes(requestedOrigin) ? requestedOrigin : allowedOrigins[0];
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "Authorization,Content-Type",
    vary: "Origin",
  };
}

/** Escribe respuestas JSON homogéneas con encabezados CORS. */
function sendJson(req, res, status, body) {
  res.writeHead(status, { "content-type": "application/json", ...corsHeaders(req) });
  return res.end(JSON.stringify(body));
}

async function proxy(req, res, route, identity) {
  // Se conserva el cuerpo para reenviarlo sin interpretar reglas de negocio.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");
  // Ningún dato de identidad creado por el navegador llega al microservicio.
  headers.delete("authorization");
  headers.delete("x-user-id");
  headers.delete("x-user-email");
  headers.delete("x-user-role");
  headers.set("X-User-Id", identity.uid);
  if (identity.email) headers.set("X-User-Email", identity.email);

  const method = req.method || "GET";
  const upstream = await fetch(`${route.origin}${req.url}`, {
    method,
    headers,
    body: ["GET", "HEAD"].includes(method) ? undefined : Buffer.concat(chunks),
    redirect: "manual",
  });

  const responseHeaders = { ...corsHeaders(req) };
  upstream.headers.forEach((value, name) => {
    if (!["content-length", "transfer-encoding", "connection"].includes(name.toLowerCase())) {
      responseHeaders[name] = value;
    }
  });
  res.writeHead(upstream.status, responseHeaders);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

const server = http.createServer(async (req, res) => {
  // El navegador usa OPTIONS para comprobar CORS antes de algunas peticiones.
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  // Salud es pública y no revela información del usuario.
  if (req.url === "/health") {
    return sendJson(req, res, 200, {
      service: "local-gateway",
      status: "ok",
      authentication: "firebase-jwt",
    });
  }

  const route = routes.find(
    ({ prefix }) =>
      req.url === prefix || req.url?.startsWith(`${prefix}/`) || req.url?.startsWith(`${prefix}?`),
  );
  if (!route) return sendJson(req, res, 404, { detail: "Ruta no encontrada" });

  try {
    // Un JWT inválido se rechaza antes de hacer proxy al backend.
    const identity = await validateFirebaseToken(req.headers.authorization);
    return await proxy(req, res, route, identity);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return sendJson(req, res, 401, { detail: error.message });
    }
    console.error(error);
    return sendJson(req, res, 502, { detail: "Microservicio no disponible" });
  }
});

server.listen(port, host, () => {
  console.log(`Gateway local con validación Firebase en http://${host}:${port}`);
  console.log(`Proyecto Firebase esperado: ${projectId}`);
});
