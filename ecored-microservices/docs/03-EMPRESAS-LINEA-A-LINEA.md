# Microservicio de Empresas

## Responsabilidad

El servicio es dueño del registro de empresas y de la colección `companies`
en MongoDB. Nunca consulta Oracle. Cada empresa guarda `owner_uid` para
proteger el aislamiento entre usuarios.

## Inicio de Django

### `manage.py`

| Sentencia | Explicación |
|---|---|
| Shebang de Python | Permite ejecutar el archivo directamente en sistemas compatibles |
| `DJANGO_SETTINGS_MODULE` | Indica que la configuración está en `company_api.settings` |
| Importación dentro de `main()` | Deja que la variable exista antes de cargar Django |
| `execute_from_command_line(sys.argv)` | Entrega a Django comandos como `runserver` |
| Guarda `if __name__...` | Ejecuta `main` solo cuando el archivo es el punto de entrada |

### `company_api/wsgi.py`

Configura el mismo módulo de settings y crea `application`, el objeto que
Gunicorn utiliza para enviar solicitudes HTTP a Django.

### `companies/apps.py`

`CompaniesConfig` identifica la aplicación. `ready()` obtiene el repositorio
al arrancar; su constructor ejecuta `ping` contra MongoDB. Así el proceso no
publica un servicio aparentemente sano con una URI, credencial o ACL incorrecta.

La importación del repositorio está dentro de `ready()` porque Django debe
cargar primero `settings.py` y el archivo `.env`.

## `company_api/settings.py`

| Sentencia o bloque | Qué hace | Por qué |
|---|---|---|
| `BASE_DIR` | Calcula la raíz del servicio | Permite encontrar `.env` sin depender del directorio actual |
| `load_dotenv(...)` | Carga configuración local | En Docker/OKE las variables del proceso prevalecen |
| `SECRET_KEY` | Configura Django y es obligatoria | Evita arrancar con una clave insegura por defecto |
| `DEBUG` | Convierte texto a booleano | Las variables de entorno siempre llegan como texto |
| `ALLOWED_HOSTS` | Separa una lista por comas | Django rechaza hosts no previstos |
| `INSTALLED_APPS` | Activa CORS, DRF y Empresas | Solo incluye módulos necesarios |
| `CorsMiddleware` | Atiende CORS si hay acceso directo local | Debe ejecutarse antes de middleware que responda |
| `ROOT_URLCONF` | Selecciona el mapa principal de rutas | Separa configuración y endpoints |
| `TEMPLATES = []` | Desactiva plantillas | Este servicio solo entrega JSON |
| Base dummy | Evita una base relacional de Django | La persistencia real se realiza con PyMongo |
| `CORS_ALLOWED_ORIGINS` | Configura orígenes autorizados | No se usa un comodín inseguro |
| Autenticación de DRF | Instala `GatewayHeaderAuthentication` | Centraliza el contrato interno de identidad |
| `IsAuthenticated` | Protege por defecto | Una vista debe declarar explícitamente si es pública |
| `UNAUTHENTICATED_USER: None` | Evita depender del modelo User de Django | No existe base relacional de usuarios |

## Rutas

`company_api/urls.py` monta todas las rutas del módulo bajo `/api/`.
`companies/urls.py` define:

| Método y ruta | Vista | Resultado |
|---|---|---|
| `GET /api/health` | `HealthView` | Estado del proceso |
| `GET /api/companies` | `CompanyListCreateView` | Empresas del usuario |
| `POST /api/companies` | `CompanyListCreateView` | Nueva empresa |
| `GET /api/companies/:id` | `CompanyDetailView` | Empresa propia o 404 |

`as_view()` adapta cada clase DRF para que Django pueda invocarla.

## `companies/auth.py`

### `GatewayUser`

`@dataclass(frozen=True)` genera una clase de datos inmutable. Solo conserva
`uid` y `email`. La propiedad `is_authenticated` retorna `True` para que
las reglas estándar de DRF reconozcan la identidad.

### `GatewayHeaderAuthentication.authenticate()`

1. Lee y limpia `X-User-Id`.
2. Si está vacío, lanza `AuthenticationFailed` y DRF responde `401`.
3. Construye `GatewayUser` con UID y correo.
4. Retorna `(user, None)`; no existe un segundo objeto de credencial.

El servicio no verifica el JWT. Esta decisión solo es segura si sus puertos son
privados y el gateway sobrescribe los encabezados.

## `companies/domain.py`

| Línea lógica | Explicación |
|---|---|
| `REQUIRED_FIELDS` | Mantiene en un lugar los cuatro campos del contrato |
| `CompanyValidationError` | Distingue una entrada inválida de un fallo técnico |
| Comprueba `dict` | El cuerpo debe ser un objeto JSON |
| Crea `company = {}` | Evita persistir campos adicionales enviados por el cliente |
| Recorre campos requeridos | Aplica la misma regla a todos |
| `str(...).strip()` | Normaliza valores y espacios |
| Rechaza vacío | Protege el contrato antes de la base |
| Retorna objeto nuevo | Entrega al repositorio datos permitidos |

## `companies/repositories.py`

### Importaciones

- `os` obtiene configuración.
- `datetime` y `timezone` generan una fecha UTC consciente de zona.
- `lru_cache` conserva una sola instancia por proceso.
- `ObjectId` convierte el identificador textual de la URL.
- `InvalidId` permite responder “no encontrado” sin producir error interno.
- `MongoClient` administra conexiones a MongoDB.

### Constructor

| Sentencia | Motivo |
|---|---|
| `MongoClient(uri, serverSelectionTimeoutMS=5000)` | Configura cliente y limita la espera inicial |
| `client.admin.command("ping")` | Fuerza conexión real porque MongoClient es perezoso |
| Selección de base y colección | Mantiene nombres físicos dentro de infraestructura |

### `_serialize()`

MongoDB retorna BSON. El método copia el documento, cambia `_id` por `id`,
convierte ObjectId a texto y convierte la fecha a ISO 8601. No modifica el
objeto original entregado por PyMongo.

### Consultas

| Método | Consulta | Regla protegida |
|---|---|---|
| `list_by_owner` | `find({owner_uid})` y orden descendente | Un usuario solo lista sus empresas |
| `create` | `insert_one` | El UID viene del gateway, no del JSON |
| `get_owned` | Filtra por `_id` y `owner_uid` | Conocer un ID no concede acceso |

`get_owned` captura `InvalidId`: un ID mal formado se trata como recurso no
encontrado y no como error 500.

### `get_company_repository()`

`@lru_cache(maxsize=1)` construye una instancia por proceso. Exige
`MONGODB_URI`, aplica un nombre de base predeterminado y no ofrece una
alternativa en memoria. En Gunicorn cada worker mantiene su propio cliente,
comportamiento normal y seguro.

## `companies/views.py`

### `HealthView`

Sobrescribe autenticación y permisos para ser pública. El proceso ya comprobó
MongoDB durante `ready()`, por lo que una respuesta exitosa implica que el
arranque se completó.

### `CompanyListCreateView.get()`

Usa `request.user.uid` generado por la autenticación y llama al método de
repositorio que filtra por propietario.

### `CompanyListCreateView.post()`

1. Valida `request.data`.
2. Convierte errores esperados en HTTP `400`.
3. Pasa al repositorio el UID separado de los datos del cliente.
4. Retorna el documento creado con HTTP `201`.

### `CompanyDetailView.get()`

Busca por ID y UID. Retorna `404` tanto si no existe como si pertenece a otra
persona; así no revela la existencia de recursos ajenos.

## Pruebas

`tests/test_domain.py` solo prueba lógica pura: normalización correcta y
rechazo de campos faltantes. No crea un sustituto de MongoDB. La prueba real de
persistencia se realiza ejecutando el servicio contra la URI configurada.

## Dependencias y contenedor

| Archivo | Propósito |
|---|---|
| `requirements.txt` | Django, DRF, PyMongo, CORS, dotenv y Gunicorn |
| `.env.example` | Variables documentadas sin secretos reales |
| `.dockerignore` | Impide copiar `.env`, cachés y entorno virtual |
| `Dockerfile` | Instala dependencias y ejecuta Gunicorn en el puerto 8001 |
