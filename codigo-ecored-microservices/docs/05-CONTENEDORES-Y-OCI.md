# Docker, scripts y OCI API Gateway

## Principio de construcción

Las imágenes contienen código y dependencias, pero no configuración sensible.
MongoDB y Oracle son servicios externos: sus URI y credenciales se entregan al
ejecutar el contenedor y posteriormente mediante Secrets de Kubernetes.

## Dockerfile de Empresas

| Instrucción | Qué hace | Por qué |
|---|---|---|
| `FROM python:3.12-slim` | Selecciona Python reducido | Disminuye superficie y tamaño |
| `PYTHONDONTWRITEBYTECODE=1` | Evita `.pyc` | No son necesarios en la imagen |
| `PYTHONUNBUFFERED=1` | Desactiva búfer de salida | Los logs aparecen inmediatamente |
| `WORKDIR /app` | Define directorio de trabajo | Simplifica rutas posteriores |
| `COPY requirements.txt .` | Copia dependencias primero | Aprovecha caché de capas |
| `pip install --no-cache-dir` | Instala sin caché de paquetes | Reduce tamaño |
| `COPY . .` | Copia el servicio | `.dockerignore` excluye secretos |
| `EXPOSE 8001` | Documenta el puerto | No lo publica por sí solo |
| `CMD gunicorn...` | Inicia servidor WSGI | `runserver` no es para producción |

Dos workers ofrecen concurrencia sencilla. Cada worker crea su propio cliente
MongoDB y confirma la conexión antes de atender tráfico.

## Dockerfile de Materiales

| Instrucción | Explicación |
|---|---|
| `FROM node:24-alpine` | Usa Node sobre una base pequeña |
| `HOST=0.0.0.0` | Permite recibir tráfico fuera del contenedor |
| `COPY package*.json` | Separa dependencias para aprovechar caché |
| `npm ci --omit=dev` | Instala exactamente el lockfile y solo producción |
| `COPY src ./src` | No copia pruebas ni SQL al runtime |
| `EXPOSE 8002` | Documenta el puerto |
| `CMD ["npm", "start"]` | Ejecuta el comando definido en package.json |

## Dockerfile del frontend

Es multietapa:

1. Node instala dependencias y compila Vite sin datos del estudiante.
2. Nginx recibe el directorio `dist` y el script de configuración.

La imagen oficial de Nginx ejecuta `40-runtime-config.sh` antes de arrancar.
El script toma las variables `VITE_*` recibidas por el contenedor y genera
`runtime-config.js`. El navegador carga ese archivo antes de React. Por ello,
una sola imagen se puede reutilizar localmente y en OKE.

La etapa final no contiene Node, `node_modules` ni el código fuente completo.

## `nginx.conf`

- `listen 80`: puerto interno.
- `root`: ubicación copiada desde la etapa de compilación.
- `index index.html`: documento inicial.
- La ubicación exacta de `runtime-config.js` desactiva caché para leer cambios.
- `try_files ... /index.html`: entrega React cuando una ruta como
  `/materials` no corresponde a un archivo físico.

Sin esta última regla, recargar una ruta interna produciría `404`.

## `.dockerignore`

Cada servicio excluye al menos:

- `.env` y credenciales.
- `node_modules` o entornos virtuales.
- Cachés y resultados de pruebas.
- Archivos que no se necesitan para ejecutar.

`.dockerignore` reduce contexto, acelera la construcción y evita incorporar
secretos accidentalmente.

## Scripts

### `scripts/test-unit.sh`

| Línea lógica | Propósito |
|---|---|
| `set -eu` | Detiene el script ante error o variable no definida |
| Cálculo de `project_dir` | Permite ejecutarlo desde cualquier directorio |
| `unittest discover` | Ejecuta dominio puro de Empresas |
| `compileall` | Detecta errores sintácticos de Python |
| `node --test` en Materiales | Ejecuta validación pura |
| `npm test` en gateway | Ejecuta pruebas criptográficas locales |
| `node --check` | Comprueba sintaxis de módulos de ejecución |

Las pruebas unitarias no sustituyen las pruebas de conexión. El código ya no
incluye persistencia en memoria.

### `scripts/smoke-local.sh`

1. `set -eu` falla ante cualquier comando incorrecto.
2. Lee `GATEWAY_URL` o usa localhost.
3. Exige `FIREBASE_ID_TOKEN`.
4. Consulta salud.
5. Crea una empresa con Bearer token.
6. Extrae el ID del JSON.
7. Publica un material con ese ID.
8. Consulta ambos recursos.

Cada llamada protegida envía el mismo token. El gateway lo verifica y Materiales
propaga internamente la misma identidad a Empresas.

## Ejecución Docker

La red `ecored-local` proporciona DNS entre contenedores:

```text
materials-service → http://companies-service:8001/api
```

Las bases se alcanzan mediante sus cadenas externas:

```text
companies-service → MONGODB_URI
materials-service → ORACLE_CONNECT_STRING
```

`--env-file` entrega la configuración durante la ejecución. No modifica ni
reconstruye la imagen.

Los puertos se publican en `127.0.0.1` para limitar el diagnóstico al equipo:

```text
127.0.0.1:8001 → contenedor:8001
127.0.0.1:8002 → contenedor:8002
```

## Plantilla de OCI API Gateway

`oci/api-deployment.template.json` es JSON y no admite comentarios. Sus
secciones se interpretan así:

### `requestPolicies.authentication`

| Propiedad | Significado |
|---|---|
| `TOKEN_AUTHENTICATION` | Activa autenticación JWT administrada |
| `tokenHeader: Authorization` | Ubicación del token |
| `tokenAuthScheme: Bearer` | Esquema obligatorio |
| `isAnonymousAccessAllowed: false` | Rechaza solicitudes sin token |
| `maxClockSkewInSeconds` | Tolerancia pequeña de reloj |
| `REMOTE_JWKS` | Descarga claves públicas de Firebase |
| `isSslVerifyDisabled: false` | Conserva validación TLS |
| `issuers` | Acepta únicamente Secure Token del proyecto |
| `audiences` | Exige el Project ID esperado |
| `sub isRequired` | Exige el UID |

### Transformación de encabezados

`X-User-Id` se crea desde `${request.auth[sub]}` y `X-User-Email` desde el
claim email. `OVERWRITE` reemplaza cualquier encabezado enviado por el
cliente; sin esa propiedad, el límite de confianza sería inseguro.

### CORS

Define origen, métodos y encabezados admitidos por el navegador. En producción,
`FRONTEND_ORIGIN` debe reemplazarse por el origen HTTPS exacto.

### Rutas

Cada ruta pública apunta a la entrada alcanzable de OKE. El gateway no puede
usar directamente un DNS `ClusterIP`; necesita conectividad hacia el
balanceador o Ingress configurado.

## Diferencia local y OCI

| Local | Producción |
|---|---|
| Node y `jose` | OCI API Gateway |
| `.env` local | Configuración del deployment |
| URL localhost | Entrada de OKE |
| Solo desarrollo | Punto de acceso administrado |

`jose` no se despliega dentro de OCI API Gateway. Ambos implementan el mismo
contrato: validar el token, rechazar credenciales inválidas y sobrescribir la
identidad interna.

## Archivos que no deben publicarse

- Cualquier `.env` real.
- Contraseñas de Oracle o MongoDB.
- Tokens Firebase copiados desde el navegador.
- Wallets, certificados privados o cuentas de servicio.
- `node_modules` y entornos virtuales.
