# EcoRed separada en dos microservicios

Esta versión separa el backend original en dos dominios y mantiene el frontend
como aplicación desplegable independiente:

| Componente | Tecnología | Puerto local | Responsabilidad |
|---|---|---:|---|
| `companies-service` | Django REST + MongoDB | 8001 | Empresas del usuario |
| `materials-service` | Node.js + Express + Oracle | 8002 | Publicaciones de materiales |
| `frontend` | React + Vite + Nginx | 5173/80 | Interfaz y obtención del token Firebase |
| `local-gateway` | Node.js + `jose` | 8080 | Validar Firebase JWT y enrutar exclusivamente en local |

El gateway local no es un tercer microservicio ni debe desplegarse. En OCI se
reemplaza por **OCI API Gateway**.

## Arquitectura

```mermaid
flowchart TB
    F["Frontend React"] -->|"Bearer ID token"| G["OCI API Gateway"]
    G -->|"X-User-Id"| C["Empresas · Django"]
    G -->|"X-User-Id"| M["Materiales · Express"]
    C --> DB1[(MongoDB)]
    M --> DB2[(Oracle)]
    M -->|"validar empresa propia"| C
```

Firebase inicia la sesión en el navegador y emite el ID token. OCI API Gateway
valida firma, expiración, emisor (`iss`), audiencia (`aud`) y sujeto (`sub`). Si
el token es válido, sobrescribe `X-User-Id` con `sub`; si es inválido responde
`401` antes de llegar a OKE. Los microservicios no incluyen Firebase Admin ni
repiten la validación criptográfica.

> **Condición de seguridad:** los servicios deben permanecer privados en OKE.
> Si se publican directamente, un cliente podría fabricar `X-User-Id` y omitir
> el gateway.

## 1. Requisitos locales

- Python 3.12 o superior.
- Node.js 24 o superior y npm.
- MongoDB y Oracle Database/Autonomous Database para las pruebas funcionales.
- Configuración pública de una aplicación web de Firebase para usar la interfaz.

No copie archivos de cuenta de servicio Firebase dentro del proyecto. La API
key web de Firebase es configuración pública del cliente; una clave privada de
cuenta de servicio sí es un secreto y no se necesita en esta arquitectura.

## 2. Preparar y ejecutar los servicios

Los servicios usan MongoDB y Oracle de forma predeterminada. Copie cada
`.env.example` como `.env` y reemplace las cadenas de ejemplo antes de
iniciarlos. No existe modo en memoria: si una base no está configurada o no
responde, el servicio falla al iniciar para que el problema sea visible.

La explicación pedagógica de los archivos y de cada sentencia relevante está
en [DOCUMENTACION-CODIGO.md](DOCUMENTACION-CODIGO.md).

### 2.1 Empresas

Abra una terminal:

```bash
cd services/companies-service
python -m venv .venv
```

Activación en Linux/macOS:

```bash
source .venv/bin/activate
```

Activación en PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

Instale y ejecute:

```bash
pip install -r requirements.txt
cp .env.example .env
python manage.py runserver 127.0.0.1:8001 --noreload
```

En PowerShell, use `Copy-Item .env.example .env` en lugar de `cp`.

### 2.2 Materiales

Abra una segunda terminal:

```bash
cd services/materials-service
npm install
cp .env.example .env
npm start
```

El servicio de Materiales consulta internamente a Empresas antes de aceptar una
publicación. Envía la misma identidad recibida del gateway y verifica que la
empresa exista y pertenezca al usuario.

### 2.3 Gateway de desarrollo con validación Firebase

Abra una tercera terminal:

```bash
cd local-gateway
npm install
cp .env.example .env
npm start
```

Antes de iniciar, edite `.env` y asigne a `FIREBASE_PROJECT_ID` el mismo Project
ID utilizado por el frontend. El gateway escucha únicamente en
`127.0.0.1:8080`. Mediante `jose`, descarga las claves públicas de Firebase,
valida firma RS256, expiración, `iss` y `aud`, elimina cualquier encabezado de
identidad enviado por el cliente e inyecta `X-User-Id` desde el claim `sub`.
Nunca debe usarse en producción.

La forma más directa de probar el flujo es iniciar sesión y operar desde el
frontend. Para ejecutar el script integral necesita un ID token vigente:

```bash
FIREBASE_ID_TOKEN="PEGUE_EL_TOKEN" sh scripts/smoke-local.sh
```

Sin token, una ruta protegida debe responder `401`:

```bash
curl -i http://127.0.0.1:8080/api/companies
```

### 2.4 Pruebas unitarias

Estas pruebas no requieren Django, Express, MongoDB ni Oracle instalados:

```bash
sh scripts/test-unit.sh
```

También pueden ejecutarse por separado:

```bash
cd services/companies-service
python -m unittest discover -s tests -v

cd ../materials-service
node --test

cd ../../local-gateway
npm test
```

## 3. Probar el frontend local

Copie `frontend/.env.example` como `frontend/.env` y complete:

```dotenv
VITE_API_URL=http://127.0.0.1:8080/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

Después:

```bash
cd frontend
npm install
npm run dev
```

El frontend siempre envía `Authorization: Bearer <ID_TOKEN>`. El gateway local
lo valida con `jose`; OCI API Gateway realiza la validación equivalente mediante
su política administrada `TOKEN_AUTHENTICATION`. El código del frontend es el
mismo en ambos ambientes y solo cambia `VITE_API_URL`.

## 4. Pruebas con MongoDB y Oracle reales

### 4.1 Empresas con MongoDB

Edite `services/companies-service/.env`:

```dotenv
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@CLUSTER/ecored_companies?retryWrites=true&w=majority
MONGODB_DB_NAME=ecored_companies
```

Al iniciar Django se ejecuta `ping` contra MongoDB. La colección `companies`
se crea al insertar el primer documento. No se ejecutan migraciones SQL porque
Django usa un repositorio PyMongo, no el ORM relacional.

### 4.2 Materiales con Oracle

Ejecute una vez, con el usuario de la aplicación, el archivo:

```text
services/materials-service/sql/001_schema.sql
```

Edite `services/materials-service/.env`:

```dotenv
ORACLE_USER=ecored
ORACLE_PASSWORD=su-clave
ORACLE_CONNECT_STRING=(description=(address=(protocol=tcps)(port=1521)(host=HOST_ORACLE))(connect_data=(service_name=SERVICIO_TP))(security=(ssl_server_dn_match=yes)))
```

Antes de abrir el puerto, Node ejecuta `SELECT 1 FROM dual`. Reinicie Node y
vuelva a ejecutar `scripts/smoke-local.sh`. `node-oracledb` trabaja en Thin
mode para este caso, por lo que normalmente no requiere Oracle Instant Client.

## 5. Construir las imágenes

No se incluyen `.env`, credenciales, `node_modules` ni entornos virtuales en el
contexto de las imágenes.

```bash
docker build -t ecored-companies:1.0 services/companies-service
docker build -t ecored-materials:1.0 services/materials-service
docker build -t ecored-local-gateway:1.0 local-gateway
```

El frontend se construye una sola vez, sin incorporar configuración:

```bash
docker build -t ecored-frontend:1.0 frontend
```

Al iniciar el contenedor, el script `40-runtime-config.sh` escribe las
variables públicas en `runtime-config.js`. Por ello, la misma imagen puede
entregarse a distintos estudiantes y configurarse con `docker run -e`.

La imagen `ecored-local-gateway` permite reproducir todo el recorrido con
contenedores. Es una herramienta de laboratorio y OCI API Gateway la reemplaza
en el despliegue de OKE.

Antes de subir a OCIR, pruebe que las imágenes arrancan. En contenedores,
configure MongoDB y Oracle mediante variables/secrets y use
  `COMPANIES_SERVICE_URL=http://companies-service:8001/api` en Materiales.
La prueba reproducible y encadenada está en `tests/ecored-end-to-end.http`.

### 5.1 Probar los contenedores con bases reales

```bash
docker network create ecored-local

docker run --rm --name companies-service --network ecored-local \
  -p 8001:8001 \
  --env-file services/companies-service/.env \
  -e DJANGO_ALLOWED_HOSTS=companies-service,localhost,127.0.0.1 \
  ecored-companies:1.0
```

En otra terminal:

```bash
docker run --rm --name materials-service --network ecored-local \
  -p 8002:8002 \
  --env-file services/materials-service/.env \
  -e HOST=0.0.0.0 \
  -e COMPANIES_SERVICE_URL=http://companies-service:8001/api \
  ecored-materials:1.0
```

Los archivos `.env` se leen al ejecutar los contenedores, pero no quedan
copiados en las imágenes. Mantenga el gateway local en el host y pruebe el flujo
desde el frontend o con `FIREBASE_ID_TOKEN`. En OKE, los servicios deben
quedar accesibles exclusivamente a través del gateway.

Ejecute el frontend preconstruido pasando su configuración en tiempo de
ejecución:

```bash
docker run --rm --name ecored-frontend \
  -p 8084:80 \
  -e VITE_API_URL=http://127.0.0.1:8080/api \
  -e VITE_FIREBASE_API_KEY=VALOR_PUBLICO \
  -e VITE_FIREBASE_AUTH_DOMAIN=PROYECTO.firebaseapp.com \
  -e VITE_FIREBASE_PROJECT_ID=PROYECTO \
  -e VITE_FIREBASE_APP_ID=APP_ID \
  ecored-frontend:1.0
```

## 6. Configurar OCI API Gateway

Use `oci/api-deployment.template.json` y siga `oci/README.md`. La plantilla:

1. Recibe el token en `Authorization` con esquema `Bearer`.
2. Descarga las claves públicas de Firebase mediante `REMOTE_JWKS`.
3. Valida `iss`, `aud`, expiración y `sub`.
4. Sobrescribe `X-User-Id` y `X-User-Email`.
5. Enruta `/companies` y `/materials` al punto de entrada de OKE.

API Gateway debe poder salir por HTTPS hacia Google para obtener las JWKS y
alcanzar el balanceador/Ingress de OKE. Los `ClusterIP` de Kubernetes no son
direcciones utilizables directamente por API Gateway.

## Estructura final

```text
ecored-microservices/
├── DOCUMENTACION-CODIGO.md     # índice de lectura pedagógica
├── docs/                       # explicación por componente
├── frontend/                   # React y Dockerfile de Nginx
├── local-gateway/              # validador JWT local con jose; no desplegar
├── oci/                        # plantilla de API Gateway + Firebase
├── scripts/                    # pruebas unitarias e integrales
└── services/
    ├── companies-service/      # Django + repositorio MongoDB
    └── materials-service/      # Express + repositorio Oracle
```
