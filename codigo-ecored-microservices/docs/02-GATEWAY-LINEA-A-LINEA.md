# Gateway local y validación Firebase

## Alcance

`local-gateway` reproduce en desarrollo el límite de confianza que ofrecerá
OCI API Gateway. Es una herramienta local, no un tercer microservicio y no se
despliega en OKE.

## `src/firebaseTokenValidator.js`

### Importación

```javascript
import { createRemoteJWKSet, jwtVerify } from "jose";
```

- `createRemoteJWKSet` obtiene las claves públicas del proveedor.
- `jwtVerify` verifica la firma y los claims; no se limita a decodificar.
- No se usa una cuenta de servicio ni una clave privada porque verificar una
  firma solo requiere claves públicas.

### Endpoint JWKS

`DEFAULT_FIREBASE_JWKS_URL` centraliza la dirección de las claves públicas de
Firebase. Se puede sobrescribir mediante entorno para pruebas o cambios de
infraestructura, pero el estudiante normalmente conserva el valor sugerido.

### `AuthenticationError`

La clase diferencia un fallo esperado de autenticación de un fallo de red o del
microservicio. `server.js` convierte esta clase en HTTP `401`.

### `extractBearerToken()`

| Línea lógica | Explicación |
|---|---|
| Comprueba que `authorization` sea texto | Evita invocar expresiones regulares sobre `undefined` |
| `/^Bearer\s+(\S+)$/i` | Exige el esquema Bearer y un token sin espacios internos |
| `i` | Hace que el nombre del esquema no dependa de mayúsculas |
| Si no coincide, lanza `AuthenticationError` | Una petición sin credencial no debe continuar |
| `return match[1]` | Retorna solamente el JWT, sin la palabra Bearer |

### `createFirebaseTokenValidator()`

La función es una fábrica: recibe configuración una vez y retorna la función
que validará muchas solicitudes.

| Sentencia | Qué hace | Por qué |
|---|---|---|
| Normaliza `projectId` | Elimina espacios y valores falsos | Issuer y audience deben coincidir exactamente |
| Rechaza Project ID vacío | Detiene una configuración insegura | No existe un valor válido por defecto |
| Usa `keyResolver` o JWKS remoto | Permite producción y pruebas | Las pruebas no dependen de Google |
| Construye `issuer` | Forma la URL propia del proyecto | Impide aceptar tokens de otro emisor |
| `extractBearerToken()` | Obtiene la credencial | Separa parseo de verificación |
| `algorithms: ["RS256"]` | Restringe el algoritmo | Evita aceptar algoritmos inesperados |
| `issuer` | Valida `iss` | El token debe proceder del proyecto |
| `audience` | Valida `aud` | El token debe estar destinado a la aplicación |
| `clockTolerance: 30` | Tolera 30 segundos de diferencia | Reduce falsos rechazos por relojes levemente desalineados |
| Comprueba `payload.sub` | Exige un UID no vacío | Es la identidad usada por los servicios |
| Retorna UID y correo | Produce un contrato mínimo | No expone claims innecesarios |
| Captura errores de `jose` | Devuelve un mensaje homogéneo | No filtra detalles criptográficos al cliente |

## `server.js`

### Configuración inicial

| Sentencia | Explicación |
|---|---|
| `import http` | Usa el servidor incluido en Node para mantener el gateway pequeño |
| Importación del validador | Separa seguridad de transporte |
| `PORT || 8080` | Permite configuración con un valor local predecible |
| Lectura de `FIREBASE_PROJECT_ID` | Define issuer y audience |
| Error si falta Project ID | Evita iniciar un gateway que no pueda validar |
| `createFirebaseTokenValidator(...)` | Prepara y reutiliza el validador |
| `routes` | Relaciona prefijos públicos con destinos internos |

### CORS

`corsHeaders()` separa los orígenes permitidos por comas, normaliza espacios y
solo refleja el origen cuando pertenece a la lista. También permite
`Authorization` y `Content-Type`, necesarios para el token y el JSON.

La respuesta incluye `Vary: Origin` para que una caché no reutilice la
respuesta CORS de un origen para otro.

### `sendJson()`

Esta función evita repetir `content-type`, CORS, serialización y cierre de
respuesta en las rutas de salud, error y autenticación.

### `proxy()`

| Orden | Sentencia | Razón |
|---:|---|---|
| 1 | Acumula los fragmentos del cuerpo | Node entrega el cuerpo como stream |
| 2 | Construye `Headers` | Permite borrar y sobrescribir de forma explícita |
| 3 | Elimina `host` y `content-length` | El destino y el tamaño pueden cambiar en el proxy |
| 4 | Elimina `authorization` | Los microservicios no necesitan el token Firebase |
| 5 | Elimina todos los `X-User-*` | El navegador no puede escoger su identidad |
| 6 | Inserta `X-User-Id` verificado | Traduce `sub` al contrato interno |
| 7 | Inserta correo si existe | El claim email es opcional |
| 8 | Llama `fetch` al origen | Reenvía método, ruta, encabezados y cuerpo |
| 9 | `redirect: "manual"` | Evita que el proxy siga redirecciones inesperadas |
| 10 | Copia encabezados seguros de respuesta | Conserva tipo y metadatos sin romper el transporte |
| 11 | Devuelve estado y cuerpo | Mantiene el contrato del microservicio |

### Servidor HTTP

El orden de las ramas importa:

1. `OPTIONS` responde sin token porque es la comprobación CORS del navegador.
2. `/health` es pública y permite comprobar el proceso.
3. Una ruta desconocida retorna `404`.
4. Una ruta conocida valida el token.
5. Solo después de validar ejecuta `proxy()`.
6. `AuthenticationError` produce `401`.
7. Un fallo del destino produce `502`.

`listen(..., "127.0.0.1")` limita el gateway al equipo del estudiante. En
producción se utiliza OCI API Gateway.

## Pruebas del validador

`test/firebaseTokenValidator.test.js` genera un par RSA únicamente para la
prueba. La clave privada firma tokens locales y `createLocalJWKSet` presenta la
clave pública al validador.

| Prueba | Riesgo que cubre |
|---|---|
| Extraer Bearer | Formato correcto del encabezado |
| Petición sin token | Rechazo obligatorio |
| Token correcto | Firma, issuer, audience, UID y correo |
| Audience diferente | Rechazo de tokens de otro proyecto |

Estas pruebas no llaman a Firebase y no contienen credenciales reales.

## Variables

| Variable | Consumidor | Propósito |
|---|---|---|
| `PORT` | servidor | Puerto local |
| `FIREBASE_PROJECT_ID` | validador | Issuer y audience esperados |
| `FIREBASE_JWKS_URL` | `jose` | Claves públicas |
| `CORS_ORIGINS` | navegador | Orígenes permitidos |
| `COMPANIES_URL` | proxy | Destino de Empresas |
| `MATERIALS_URL` | proxy | Destino de Materiales |

## Archivos npm

- `package.json`: declara ESM, comandos `start` y `test`, y `jose`.
- `--env-file-if-exists=.env`: permite usar el mismo comando con o sin archivo
  local; la configuración obligatoria sigue siendo validada por el código.
- `package-lock.json`: fija la versión exacta instalada y no se edita a mano.
