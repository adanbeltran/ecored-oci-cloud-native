import express from "express";

import { gatewayIdentity } from "./auth.js";
import { assertOwnedCompany } from "./companyClient.js";
import { ValidationError, validateMaterial } from "./validation.js";

export function createApp({ repository, config }) {
  // La fábrica permite probar Express sin abrir un puerto ni crear otro pool.
  const app = express();

  // Oculta información de implementación y limita el tamaño del JSON recibido.
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  // Salud es pública; el resto de /api exige identidad generada por el gateway.
  app.get("/api/health", (req, res) => res.json({ service: "materials", status: "ok" }));
  app.use("/api", gatewayIdentity);

  app.get("/api/materials", async (req, res, next) => {
    try {
      res.json(await repository.list());
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/materials/:id", async (req, res, next) => {
    try {
      const item = await repository.findById(req.params.id);
      return item ? res.json(item) : res.status(404).json({ detail: "Material no encontrado" });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/materials", async (req, res, next) => {
    try {
      const material = validateMaterial(req.body);
      // Materiales no consulta MongoDB: pregunta a Empresas por su API privada.
      await assertOwnedCompany({
        baseUrl: config.companiesServiceUrl,
        companyId: material.company_id,
        identity: req.identity,
      });
      return res.status(201).json(await repository.create(material, req.identity.uid));
    } catch (error) {
      return next(error);
    }
  });

  // Un único middleware transforma errores del dominio en respuestas HTTP.
  app.use((error, req, res, next) => {
    if (error instanceof ValidationError) return res.status(400).json({ detail: error.message });
    console.error(error);
    return res.status(error.status || 500).json({ detail: error.status ? error.message : "Error interno" });
  });
  return app;
}
