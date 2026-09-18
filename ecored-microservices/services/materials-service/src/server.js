import oracledb from "oracledb";

import { createApp } from "./app.js";
import { config } from "./config.js";
import { OracleMaterialRepository } from "./repositories/oracle.js";

/**
 * Comprueba una conexión real antes de publicar el puerto HTTP.
 *
 * createPool() puede ser perezoso; SELECT 1 evita anunciar un servicio sano
 * cuando la cadena, las credenciales o la ACL de Oracle son incorrectas.
 */
async function verifyOracleConnection(pool) {
  const connection = await pool.getConnection();
  try {
    await connection.execute("SELECT 1 FROM dual");
  } finally {
    await connection.close();
  }
}

async function main() {
  // Un pool reutiliza conexiones y evita abrir una sesión por cada solicitud.
  const pool = await oracledb.createPool(config.oracle);
  await verifyOracleConnection(pool);

  const repository = new OracleMaterialRepository(pool);
  const app = createApp({ repository, config });

  app.listen(config.port, config.host, () => {
    console.log(
      `materials-service escuchando en http://${config.host}:${config.port}`,
    );
  });
}

// Si Oracle no está disponible, el proceso termina y Docker/OKE puede reiniciarlo.
main().catch((error) => {
  console.error("No fue posible iniciar materials-service:", error);
  process.exit(1);
});
