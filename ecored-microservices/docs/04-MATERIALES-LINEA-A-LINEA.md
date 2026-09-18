# Microservicio de Materiales

## Responsabilidad

El servicio registra publicaciones en Oracle. Conserva `company_id` como
referencia lógica, pero no se conecta a MongoDB: consulta la API privada de
Empresas para comprobar existencia y propiedad.

## `src/config.js`

`import "dotenv/config"` carga `.env` durante desarrollo. En Docker u OKE,
las variables suministradas al proceso cumplen el mismo contrato.

### `required()`

1. Lee la variable por nombre.
2. La convierte a texto y elimina espacios laterales.
3. Si está vacía, lanza un error de arranque.
4. Si existe, retorna el valor.

Esta función evita iniciar con credenciales incompletas y no proporciona
contraseñas predeterminadas.

### Objeto `config`

| Propiedad | Fuente | Propósito |
|---|---|---|
| `port` | `PORT` o 8002 | Puerto HTTP |
| `host` | `HOST` o localhost | Interfaz local; Docker sobrescribe con 0.0.0.0 |
| `oracle.user` | obligatoria | Usuario de aplicación |
| `oracle.password` | obligatoria | Contraseña |
| `oracle.connectString` | obligatoria | Cadena TLS |
| `companiesServiceUrl` | variable o URL local | API privada de Empresas |

`Object.freeze` expresa que la configuración no cambia durante la ejecución.
Tampoco existe una bandera para omitir la validación de empresa.

## `src/server.js`

### Importaciones

- `oracledb` crea y administra el pool.
- `createApp` construye Express sin abrir el puerto.
- `config` contiene configuración validada.
- `OracleMaterialRepository` encapsula SQL.

### `verifyOracleConnection()`

| Sentencia | Explicación |
|---|---|
| `pool.getConnection()` | Obtiene una conexión real |
| `SELECT 1 FROM dual` | Verifica credenciales, cadena, red y sesión |
| `finally` | Se ejecuta con éxito o error |
| `connection.close()` | Devuelve la conexión al pool |

`createPool()` puede ser perezoso; esta consulta impide abrir el puerto si
Oracle no está disponible.

### `main()`

1. Crea un pool reutilizable.
2. Comprueba una conexión real.
3. Inyecta el pool en el repositorio.
4. Inyecta repositorio y configuración en Express.
5. Abre el puerto solo después de completar los pasos anteriores.

`main().catch()` registra un error de inicio y termina con código 1. Docker y
Kubernetes interpretan correctamente que el proceso falló.

## `src/app.js`

`createApp({ repository, config })` es una fábrica. Recibir dependencias como
argumentos reduce acoplamiento y permite probar HTTP sin que el módulo abra
puertos o cree conexiones por sí mismo.

### Middleware inicial

| Línea | Razón |
|---|---|
| `express()` | Crea la aplicación |
| `disable("x-powered-by")` | No anuncia innecesariamente Express |
| `express.json({limit: "100kb"})` | Parsea JSON y limita cuerpos excesivos |
| `GET /api/health` | Proporciona diagnóstico público |
| `app.use("/api", gatewayIdentity)` | Protege todas las rutas siguientes |

### `GET /api/materials`

Llama `repository.list()` y retorna JSON. El bloque `try/catch` envía errores
al middleware central mediante `next(error)`.

### `GET /api/materials/:id`

Busca por ID. Si existe, retorna el objeto; si no, responde `404`. La expresión
ternaria mantiene compacta una decisión con dos resultados sencillos.

### `POST /api/materials`

El orden implementa la regla de negocio:

1. `validateMaterial(req.body)` limpia y valida la entrada.
2. `assertOwnedCompany(...)` consulta Empresas usando el mismo UID.
3. Solo si la empresa es válida ejecuta `repository.create()`.
4. `published_by` proviene de `req.identity.uid`, no del cliente.
5. Retorna HTTP `201`.

### Middleware de errores

`ValidationError` se convierte en `400`. Los errores con propiedad
`status`, como 400 o 502 del cliente de Empresas, conservan ese estado. Los
demás se registran y se convierten en un mensaje genérico `500` para no
exponer información interna.

La firma contiene cuatro argumentos porque Express reconoce así un middleware
de errores, aunque `next` no se invoque dentro del cuerpo.

## `src/auth.js`

`gatewayIdentity()` lee `X-User-Id`, lo normaliza y responde `401` si no
existe. Después crea `req.identity` con UID y correo y llama `next()`.

No valida Firebase porque esa tarea pertenece al gateway. Esta separación
funciona únicamente si el servicio es privado.

## `src/companyClient.js`

### Solicitud interna

| Sentencia | Explicación |
|---|---|
| `encodeURIComponent(companyId)` | Impide que un ID altere la ruta |
| `X-User-Id` | Propaga la identidad ya validada |
| `X-User-Email` | Propaga metadato opcional |
| `AbortSignal.timeout(5000)` | Limita la dependencia síncrona a cinco segundos |

Una respuesta `404` se traduce en `400` para el cliente que intenta crear el
material. Otros fallos de Empresas se traducen en `502`, porque Materiales no
pudo completar una llamada necesaria a otro servicio.

## `src/validation.js`

| Línea lógica | Explicación |
|---|---|
| `ValidationError` | Identifica errores esperados de entrada |
| Comprueba objeto no nulo y no arreglo | Exige un objeto JSON |
| Convierte campos de texto y aplica `trim` | Normaliza sin mutar el cuerpo |
| `Number(payload.quantity)` | Convierte una cantidad textual válida |
| Comprueba campos vacíos | Aplica obligatoriedad |
| `Number.isFinite` y `> 0` | Rechaza NaN, infinito, cero y negativos |
| Retorna objeto nuevo | Solo persiste propiedades permitidas |
| `status: "available"` | El servidor decide el estado inicial |

## `src/repositories/oracle.js`

### Configuración y mapeo

`OUT_FORMAT_OBJECT` hace que Oracle retorne columnas nombradas.
`mapRow()` traduce nombres en mayúscula a las propiedades JSON en
`snake_case` que consume el frontend.

### Patrón de conexión

Cada método aplica:

```javascript
const connection = await this.pool.getConnection();
try {
  // operación SQL
} finally {
  await connection.close();
}
```

`close()` devuelve la conexión al pool incluso si SQL falla. Omitir `finally`
agotaría el pool gradualmente.

### `list()`

Selecciona únicamente las columnas públicas y ordena por fecha descendente. No
usa `SELECT *`, lo que mantiene explícito el contrato.

### `create()`

| Elemento | Propósito |
|---|---|
| Variables `:companyId`, etc. | Bind parameters contra SQL injection |
| `publishedBy` separado | Impide que el cuerpo escoja el UID |
| `RETURNING id INTO :id` | Obtiene el identificador sin otra búsqueda ambigua |
| `BIND_OUT` | Indica que `:id` es una salida |
| `autoCommit: true` | Confirma la unidad de trabajo |
| `findById(...)` | Retorna el objeto completo con fecha y valores de Oracle |

### `findById()`

Convierte el parámetro a número y lo mantiene como bind. Si no hay filas,
`mapRow(undefined)` retorna `null`, que la capa HTTP transforma en `404`.

## SQL

`sql/001_schema.sql`:

1. Crea la tabla propiedad de este servicio.
2. Genera el ID automáticamente.
3. Guarda el ObjectId de MongoDB como texto, sin llave foránea física.
4. Aplica `NOT NULL` a campos obligatorios.
5. Aplica `CHECK (quantity > 0)` como última barrera de integridad.
6. Define estado y fecha predeterminados en la base.
7. Registra el UID Firebase en `published_by`.
8. Crea índices para consultas por empresa y estado.

## Pruebas

`test/validation.test.js` prueba la lógica pura:

- Convierte una cantidad textual y asigna estado inicial.
- Rechaza cantidades no positivas.

No contiene un repositorio sustituto. La integración con Oracle se demuestra al
iniciar el servicio y ejecutar operaciones contra la tabla real.

## Dependencias y contenedor

| Archivo | Propósito |
|---|---|
| `package.json` | Express, dotenv y node-oracledb |
| `package-lock.json` | Versiones exactas reproducibles |
| `.env.example` | Contrato de configuración sin valores reales |
| `.dockerignore` | Excluye secretos, dependencias locales y temporales |
| `Dockerfile` | Instala con `npm ci --omit=dev` y ejecuta el servicio |
