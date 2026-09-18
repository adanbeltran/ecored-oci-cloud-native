import oracledb from "oracledb";

// Los resultados como objetos son más legibles que arreglos por posición.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

/** Traduce las columnas Oracle al contrato JSON público de la API. */
function mapRow(row) {
  if (!row) return null;
  return {
    id: row.ID,
    company_id: row.COMPANY_ID,
    material_type: row.MATERIAL_TYPE,
    quantity: row.QUANTITY,
    unit: row.UNIT,
    location: row.LOCATION,
    status: row.STATUS,
    published_by: row.PUBLISHED_BY,
    created_at: row.CREATED_AT,
  };
}

export class OracleMaterialRepository {
  /** Recibe el pool para separar persistencia, servidor HTTP y configuración. */
  constructor(pool) {
    this.pool = pool;
  }

  async list() {
    // Cada operación toma y devuelve una conexión al pool.
    const connection = await this.pool.getConnection();
    try {
      // Los binds evitan concatenar entrada del usuario y previenen SQL injection.
      const result = await connection.execute(
        `SELECT id, company_id, material_type, quantity, unit, location,
                status, published_by, created_at
           FROM materials
          ORDER BY created_at DESC`,
      );
      return result.rows.map(mapRow);
    } finally {
      await connection.close();
    }
  }

  async create(material, publishedBy) {
    const connection = await this.pool.getConnection();
    try {
      const result = await connection.execute(
        `INSERT INTO materials
           (company_id, material_type, quantity, unit, location, status, published_by)
         VALUES
           (:companyId, :materialType, :quantity, :unit, :location, :status, :publishedBy)
         RETURNING id INTO :id`,
        {
          companyId: material.company_id,
          materialType: material.material_type,
          quantity: material.quantity,
          unit: material.unit,
          location: material.location,
          status: material.status,
          publishedBy,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        // La creación es una unidad de trabajo completa y se confirma aquí.
        { autoCommit: true },
      );
      return this.findById(result.outBinds.id[0]);
    } finally {
      await connection.close();
    }
  }

  async findById(id) {
    const connection = await this.pool.getConnection();
    try {
      const result = await connection.execute(
        `SELECT id, company_id, material_type, quantity, unit, location,
                status, published_by, created_at
           FROM materials WHERE id = :id`,
        // El bind conserva separado el dato recibido de la sentencia SQL.
        { id: Number(id) },
      );
      return mapRow(result.rows[0]);
    } finally {
      await connection.close();
    }
  }
}
