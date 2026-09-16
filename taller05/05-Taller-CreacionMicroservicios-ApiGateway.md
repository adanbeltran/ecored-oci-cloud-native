# Taller 5 — EcoRed: microservicios, autenticación y contenedores

## Propósito

Poner en funcionamiento EcoRed con dos microservicios, comprobar su comunicación y demostrar que las mismas imágenes pueden ejecutarse con configuraciones distintas sin reconstruirlas.

El taller se divide en dos etapas:

1. **Construcción:** configurar las bases externas, ejecutar desde el código, probar, construir las imágenes y publicarlas en Docker Hub.
2. **Reproducción:** descargar las imágenes entregadas por el docente, crear los archivos de entorno, inyectar la configuración y repetir la prueba integral.

OCI y OKE solo se presentan como destino de la arquitectura. Su creación, configuración y evaluación pertenecen al próximo taller.

## Resultado esperado

Al finalizar, el estudiante podrá explicar y verificar:

- por qué Empresas y Materiales son microservicios independientes;
- cómo el frontend envía un token de Firebase al gateway;
- cómo el gateway convierte una identidad externa validada en `X-User-Id`;
- cómo Materiales consulta a Empresas sin acceder a MongoDB;
- cómo cada servicio se conecta directamente a su base administrada;
- cómo construir, publicar y volver a ejecutar imágenes sin incluir credenciales;
- qué elementos locales se convertirán en recursos de OKE.

## Arquitectura del taller

| Componente | Programa principal | Tecnología | Responsabilidad | Puerto local |
|---|---|---|---|---:|
| Frontend | `frontend/src/main.jsx` | React + Vite / Nginx | Interfaz, sesión Firebase y envío del token | 5173 o 8088 |
| Gateway local | `local-gateway/server.js` | Node.js + `jose` | Validar el JWT, crear identidad interna y enrutar | 8080 |
| Empresas | `companies-service/manage.py` | Django REST + PyMongo | Empresas del usuario | 8001 |
| Materiales | `materials-service/src/server.js` | Node.js + Express + `node-oracledb` | Publicaciones de materiales | 8002 |
| MongoDB | Servicio externo | MongoDB | Datos exclusivos de Empresas | URI externa |
| Oracle | Autonomous Database | Oracle Database | Datos exclusivos de Materiales | TLS 1521 |

```mermaid
flowchart TB
    U["Usuario"] --> F["Frontend React"]
    F -->|"Bearer ID token"| G["Gateway local / OCI API Gateway"]
    G -->|"X-User-Id"| C["Empresas · Django"]
    G -->|"X-User-Id"| M["Materiales · Express"]
    M -->|"HTTP privado + X-User-Id"| C
    C --> DBM[(MongoDB)]
    M --> DBO[(Oracle)]
```

El navegador entra siempre por el gateway. `local-gateway/server.js` usa `createFirebaseTokenValidator()` y `proxy()`; Empresas recibe la identidad en `GatewayHeaderAuthentication.authenticate()` y Materiales en `gatewayIdentity()`. `assertOwnedCompany()` permite que Materiales consulte a Empresas por HTTP. Ningún microservicio consulta la base del otro.

### 1. Modo local

El gateway local permite comprobar la misma frontera de autenticación que tendrá la nube. Los procesos pueden ejecutarse desde el código o como contenedores; MongoDB y Oracle permanecen como servicios externos.

### 2. Modo OCI/OKE

OCI API Gateway reemplazará al gateway local. Los dos microservicios se ejecutarán como cargas privadas de OKE y se descubrirán mediante Services de Kubernetes. Las mismas imágenes y contratos HTTP se conservarán.

---

# Etapa 1 — Construir, probar, contenerizar y publicar

## Fase 1 — Preparar configuración y bases de datos

### 1. Modo local

#### 1.1 Herramientas mínimas

Use la terminal integrada de Visual Studio Code y verifique:

```powershell
python --version
node --version
npm --version
docker version
```

Se requiere Python 3.12 o superior, Node.js 24 o superior, Docker Desktop, una aplicación web de Firebase, acceso a MongoDB y acceso a Oracle Autonomous Database.

#### 1.2 MongoDB para Empresas

Use la URI que ya funciona en el proyecto y colóquela únicamente en `services/companies-service/.env`:

```dotenv
MONGODB_URI=mongodb+srv://USUARIO:CLAVE@CLUSTER/ecored_companies?retryWrites=true&w=majority
MONGODB_DB_NAME=ecored_companies
```

La colección `companies` se crea al guardar la primera empresa. Django no usa su ORM relacional: `MongoCompanyRepository` es el único componente que conoce MongoDB.

#### 1.3 Oracle Autonomous Database para Materiales

En la consola de OCI:

1. Abra **Oracle AI Database → Autonomous AI Database**.
![fig_oracleDatabase](image-10.png)![alt text](image-11.png)
2. Crear la BaseDeDatos y confirmar que esté disponible.
![fig_createDB1](image-12.png)![alt text](image-13.png)

3. En **Network access**, permita la IP pública desde la que se ejecutará el taller.
![alt text](image-14.png)
Antes de seleccionar Create Autonomous Database, solo confirme en las secciones anteriores:

        Transaction Processing.
        Always Free activado.
        Contraseña de ADMIN guardada.
        Acceso de red configurado.
        mTLS desactivado si utilizará la cadena TLS sin Wallet.

Después puede **crear** la base.
![alt text](image-15.png) ![alt text](image-19.png)
4. Abra **Database Actions → SQL** como `ADMIN`.
![alt text](image-20.png) ![alt text](image-21.png)

5. Cree un usuario exclusivo para la aplicación:

```sql
CREATE USER ecored
IDENTIFIED BY "Welcome2026!"
DEFAULT TABLESPACE DATA
TEMPORARY TABLESPACE TEMP
QUOTA UNLIMITED ON DATA
ACCOUNT UNLOCK;

GRANT CREATE SESSION TO ecored;
GRANT CREATE TABLE TO ecored;
GRANT CREATE SEQUENCE TO ecored;

BEGIN
    ORDS_ADMIN.ENABLE_SCHEMA(
        p_enabled             => TRUE,
        p_schema              => 'ECORED',
        p_url_mapping_type    => 'BASE_PATH',
        p_url_mapping_pattern => 'ecored',
        p_auto_rest_auth      => FALSE
    );

    COMMIT;
END;
/
```
![alt text](image-27.png)

6. Conéctese como `ecored` y ejecute `services/materials-service/sql/001_schema.sql`.
![alt text](image-24.png) ![alt text](image-28.png)

![alt text](image-29.png)
![alt text](image-30.png)

7. Regrese a **Database connection → Connection strings**.

![alt text](image-31.png)
![alt text](image-32.png)
8. Seleccione una cadena **TLS**, servicio `TP`, y copie el descriptor completo en una sola línea.

Complete `services/materials-service/.env`:

```dotenv
PORT=8002
HOST=127.0.0.1
ORACLE_USER=ecored
ORACLE_PASSWORD=UNA_CLAVE_SEGURA
ORACLE_CONNECT_STRING=(description=(address=(protocol=tcps)(port=1521)(host=HOST_ORACLE))(connect_data=(service_name=SERVICIO_TP))(security=(ssl_server_dn_match=yes)))
COMPANIES_SERVICE_URL=http://127.0.0.1:8001/api
```
![alt text](image-33.png)

`ORACLE_CONNECT_STRING` debe contener exactamente la cadena TLS copiada, no el ejemplo. El servicio usa `node-oracledb` en modo Thin y no necesita Oracle Instant Client para esta modalidad.

#### ¿Qué es un Wallet de Oracle?

Un Wallet es un archivo ZIP con certificados y descriptores de red que permiten al cliente confiar en la base y, cuando se usa mTLS, presentar credenciales de cliente. No reemplaza al usuario ni a su contraseña y nunca debe incluirse en Git o en una imagen. Este taller usa TLS de una vía y una lista de acceso de red, por lo que no requiere Wallet. 

```mermaid
sequenceDiagram
    participant D as "Django · CompaniesConfig.ready()"
    participant R as "MongoCompanyRepository.__init__(uri, db)"
    participant M as "MongoDB"
    D->>R: get_company_repository(MONGODB_URI, MONGODB_DB_NAME)
    R->>M: admin.command("ping")
    M-->>R: conexión válida
```

En Empresas, `CompaniesConfig.ready()` obtiene el repositorio y su constructor fuerza `ping`; si la URI falla, Django no publica el puerto. La comprobación usa el mismo `MongoClient` que atenderá las operaciones del servicio.

```mermaid
sequenceDiagram
    participant N as "Node · main()"
    participant O as "oracledb.createPool(config.oracle)"
    participant A as "Oracle Autonomous"
    N->>O: user, password, connectString
    O->>A: conexión TLS
    N->>A: verifyOracleConnection() · SELECT 1 FROM dual
    A-->>N: conexión válida
```

En Materiales, `main()` crea el pool con `config.oracle` y `verifyOracleConnection(pool)` ejecuta `SELECT 1 FROM dual` antes de iniciar Express. Así se comprueban las credenciales, la cadena TLS y el acceso de red desde el código que usará Oracle.

### 2. Modo OCI/OKE

MongoDB y Oracle seguirán siendo backing services externos. En OKE las URI y credenciales se entregarán mediante Secrets; el código y los Dockerfile no cambiarán. La configuración del Wallet, si fuera requerida, se realizará en el próximo taller y no se prueba aquí.

## Fase 2 — Ejecutar desde el código fuente

### 1. Modo local

Abra cuatro terminales integradas en Visual Studio Code.

#### Terminal 1: Empresas

```powershell
cd services/companies-service
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edite `.env` con MongoDB y ejecute:

```powershell
python manage.py runserver 127.0.0.1:8001 --noreload
```
![fig-Terminal1](image-9.png)

#### Terminal 2: Materiales (Oracle)

```powershell
cd services/materials-service
npm ci
Copy-Item .env.example .env
npm start
```

Edite `.env` antes de `npm start`. La consola debe mostrar que el servicio escucha en `127.0.0.1:8002`; ese mensaje aparece únicamente después de validar Oracle.

#### Terminal 3: gateway local

```powershell
cd local-gateway
npm ci
Copy-Item .env.example .env
npm start
```

En `.env`, `FIREBASE_PROJECT_ID` debe coincidir con el proyecto usado por el frontend. Para ejecución desde código, mantenga:

```dotenv
HOST=127.0.0.1
COMPANIES_URL=http://127.0.0.1:8001
MATERIALS_URL=http://127.0.0.1:8002
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

#### Terminal 4: frontend

```powershell
cd frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Complete `frontend/.env` con la configuración pública de la aplicación web de Firebase:

```dotenv
VITE_API_URL=http://127.0.0.1:8080/api
VITE_FIREBASE_API_KEY=VALOR_FIREBASE
VITE_FIREBASE_AUTH_DOMAIN=VALOR_FIREBASE
VITE_FIREBASE_PROJECT_ID=VALOR_FIREBASE
VITE_FIREBASE_APP_ID=VALOR_FIREBASE
```

La API key web de Firebase identifica la aplicación; no es una clave privada de servidor. Aun así, sus restricciones deben configurarse en Firebase/Google Cloud. Nunca use ni distribuya un archivo de cuenta de servicio.

### 2. Modo OCI/OKE

Cada proceso local se convertirá en un Deployment. Los puertos serán expuestos dentro del clúster mediante Services. OCI API Gateway será la única entrada a los microservicios; esta fase se realizará en el próximo taller.

## Fase 3 — Entender y verificar la comunicación

### 1. Modo local

#### 3.1 Token de Firebase y `X-User-Id`

`X-User-Id` es un encabezado interno que transporta el UID del usuario autenticado. No lo crea el frontend y no se confía en un valor enviado por el navegador.

Su origen es el claim `sub` del ID token de Firebase:

1. Firebase autentica al usuario y emite el token.
2. El frontend envía `Authorization: Bearer <ID_TOKEN>`.
3. El gateway valida firma, expiración, emisor y audiencia con `jose`.
4. El gateway elimina cualquier `X-User-*` recibido del cliente.
5. El gateway crea `X-User-Id` usando el `sub` ya validado.
6. Los microservicios usan ese UID para separar y autorizar datos.

```mermaid
sequenceDiagram
    participant F as "Frontend · authService + httpClient"
    participant A as "Firebase Auth"
    participant G as "gateway/server.js · validateFirebaseToken(authorization)"
    participant J as "firebaseTokenValidator.js · jwtVerify(token, keys, options)"
    participant S as "Servicio · authenticate(request) / gatewayIdentity(req)"
    F->>A: loginWithEmail(email, password)
    A-->>F: user + ID token
    F->>F: getCurrentIdToken() + interceptor(config)
    F->>G: Authorization: Bearer idToken
    G->>J: token, issuer, audience, RS256
    J-->>G: payload verificado {sub, email}
    G->>S: X-User-Id=sub, X-User-Email=email
    S-->>F: respuesta del dominio
```

`authService.getCurrentIdToken()` entrega el token al interceptor de `httpClient`. `createFirebaseTokenValidator()` configura las claves públicas y `validateFirebaseToken(authorization)` devuelve una identidad solo después de `jwtVerify()`. `proxy()` construye `X-User-Id`; después `GatewayHeaderAuthentication.authenticate()` en Django o `gatewayIdentity(req)` en Express lo convierten en el usuario de la solicitud.

#### 3.2 Comunicación Materiales → Empresas

Crear un material requiere una empresa válida, pero Oracle no duplica los datos de MongoDB y Materiales no recibe la URI de MongoDB.

```mermaid
sequenceDiagram
    participant F as "Frontend/Gateway · createMaterial() + proxy()"
    participant M as "app.js · POST /api/materials"
    participant C as "companyClient.js · assertOwnedCompany(baseUrl, companyId, identity)"
    participant D as "Django · CompanyDetailView.get() + get_owned()"
    participant O as "OracleMaterialRepository.create(material, publishedBy)"
    F->>M: material + X-User-Id validado
    M->>M: validateMaterial(req.body)
    M->>C: baseUrl, company_id, req.identity
    C->>D: GET /companies/{id} + X-User-Id
    D->>D: get_owned(company_id, request.user.uid)
    D-->>C: 200 o 404
    C-->>M: empresa autorizada
    M->>O: material, identity.uid
    O-->>F: material creado
```

`createMaterial(material)` llama al gateway. En Express, `validateMaterial()` normaliza la entrada y `assertOwnedCompany()` llama a la API privada de Empresas con el mismo UID. `CompanyDetailView.get()` delega en `MongoCompanyRepository.get_owned()`, que busca a la vez por ID y propietario. Solo después de un `200`, `OracleMaterialRepository.create()` inserta el material y registra `publishedBy`.

### 2. Modo OCI/OKE

El frontend enviará el mismo Bearer token a OCI API Gateway. Este generará la identidad interna y enrutará a los Services de OKE. La consulta Materiales → Empresas permanecerá dentro del clúster y no saldrá por el gateway público. Los pods no serán accesibles directamente desde Internet.

## Fase 4 — Probar de principio a fin

### 1. Modo local

El archivo `tests/ecored-end-to-end.http` contiene el recorrido completo. Instale la extensión **REST Client** en Visual Studio Code, abra el archivo y use **Send Request** en este orden:

1. salud del gateway;
2. rechazo sin token;
3. inicio de sesión Firebase;
4. creación de empresa;
5. listado de empresas;
6. publicación de material;
7. consulta y listado de materiales;
8. rechazo al llamar directamente los backends sin identidad interna.

La solicitud `firebaseLogin` pide la API key, el correo y la contraseña sin guardarlos. El archivo toma `idToken` de su respuesta y el `id` de `createCompany` para las peticiones siguientes. Ejecute cada solicitud nombrada antes de usar sus valores.

```mermaid
sequenceDiagram
    actor E as "Estudiante · REST Client"
    participant F as "Firebase Auth REST · signInWithPassword"
    participant G as "Gateway · /api"
    participant C as "CompanyListCreateView.post(request)"
    participant M as "Express · POST /api/materials"
    E->>F: firebaseApiKey, email, password
    F-->>E: idToken
    E->>G: POST /companies + Bearer idToken
    G->>C: empresa + X-User-Id
    C-->>E: company.id
    E->>G: POST /materials + company.id + Bearer idToken
    G->>M: material + X-User-Id
    M-->>E: material.id, status=available
```

REST Client encadena respuestas por nombre: `firebaseLogin.response.body.$.idToken` alimenta `Authorization` y `createCompany.response.body.$.id` alimenta `company_id`. Si se obtienen `201` en ambas creaciones, se comprobaron Firebase, el gateway, los dos microservicios, la llamada interna y las dos bases externas.

#### Opción equivalente con Postman

1. Cree un Environment con `gatewayUrl`, `firebaseApiKey`, `firebaseToken` y `companyId`.
2. Envíe `POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={{firebaseApiKey}}` con correo, contraseña y `returnSecureToken: true`.
3. Copie el campo `idToken` de la respuesta a `firebaseToken`.
4. En las rutas EcoRed seleccione **Authorization → Bearer Token** y use `{{firebaseToken}}`.
5. Envíe `POST {{gatewayUrl}}/api/companies`, copie su `id` a `companyId`.
6. Envíe `POST {{gatewayUrl}}/api/materials` usando `{{companyId}}` en `company_id`.
7. Liste empresas y materiales y confirme los mismos resultados del archivo `.http`.

![alt text](image-34.png)

![alt text](image-35.png)
![alt text](image-36.png)
![alt text](image-37.png)
![alt text](image-38.png)

![alt text](image-39.png)
![alt text](image-40.png)

### 2. Modo OCI/OKE

El mismo archivo `.http` y la misma colección de Postman servirán en el siguiente taller; únicamente cambiará `gatewayUrl` por el endpoint de OCI API Gateway. En este taller no se prueba ni se evalúa ningún recurso OCI.

## Fase 5 — Construir y publicar imágenes

### 1. Modo local

Los `.dockerignore` excluyen `.env`, dependencias instaladas, pruebas y archivos temporales. Antes de construir, confirme que ningún archivo con credenciales forme parte del contexto.

#### 5.1 Dockerfile de Empresas, línea por línea

| Línea/instrucción | Por qué se usa | Alternativa |
|---|---|---|
| `FROM python:3.12-slim` | Base oficial reducida compatible con el proyecto. | `python:3.12` facilita herramientas de compilación, pero pesa más. Alpine es menor, aunque algunas dependencias Python requieren ajustes. |
| `ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1` | Evita `.pyc` y muestra logs inmediatamente. | Mantener valores predeterminados genera cachés y puede retrasar logs. |
| `WORKDIR /app` | Define un directorio estable para copiar y ejecutar. | Otro directorio funciona si todas las rutas se actualizan. |
| `COPY requirements.txt .` | Separa dependencias para reutilizar la caché. | Copiar todo primero invalida la instalación ante cualquier cambio. |
| `RUN pip install --no-cache-dir -r requirements.txt` | Instala dependencias sin conservar caché de paquetes. | Un entorno multietapa puede reducir más la imagen, con mayor complejidad. |
| `COPY . .` | Copia el servicio después de las dependencias. | Copiar directorios explícitos da más control. |
| `EXPOSE 8001` | Documenta el puerto interno. | No publica el puerto; puede omitirse, pero reduce claridad. |
| `CMD ["gunicorn", ...]` | Ejecuta Django con un servidor apropiado para contenedores. | `runserver` es solo para desarrollo; Uvicorn sería opción con ASGI. |

#### 5.2 Dockerfile de Materiales, línea por línea

| Línea/instrucción | Por qué se usa | Alternativa |
|---|---|---|
| `FROM node:24-alpine` | Imagen oficial pequeña para Node. | `node:24-slim` ofrece mayor compatibilidad con librerías nativas a cambio de tamaño. |
| `ENV HOST=0.0.0.0` | Permite recibir tráfico desde fuera del contenedor. | Pasar `HOST` en `docker run`; declararlo aquí documenta el comportamiento seguro del contenedor. |
| `WORKDIR /app` | Unifica rutas de ejecución. | Cualquier ruta consistente es válida. |
| `COPY package*.json ./` | Permite cachear la capa de dependencias. | Copiar todo primero reconstruye más capas. |
| `RUN npm ci --omit=dev` | Instala exactamente el lockfile y omite herramientas de desarrollo. | `npm install` puede modificar resolución; una imagen distroless reduce superficie, pero dificulta diagnóstico. |
| `COPY src ./src` | Incluye solo el código requerido en ejecución. | Copiar todo exige un `.dockerignore` más estricto. |
| `EXPOSE 8002` | Documenta el puerto interno. | Puede omitirse sin impedir `-p`, pero pierde documentación. |
| `CMD ["npm", "start"]` | Usa el punto de entrada declarado en `package.json`. | `node src/server.js` elimina una capa de indirección. |

#### 5.3 Dockerfile del gateway local, línea por línea

| Línea/instrucción | Por qué se usa | Alternativa |
|---|---|---|
| `FROM node:24-alpine` | Mantiene la misma versión de Node y una imagen pequeña. | `node:24-slim` si se prioriza compatibilidad. |
| `ENV HOST=0.0.0.0` | Hace visible el gateway fuera del contenedor. | Inyectar `HOST` al ejecutar. |
| `WORKDIR /app` | Fija la ruta de trabajo. | Otra ruta consistente. |
| `COPY package*.json ./` | Aprovecha caché de dependencias. | Copiar todo primero es menos eficiente. |
| `RUN npm ci --omit=dev` | Instala solamente producción de forma reproducible. | `npm install --omit=dev` es menos estricto con el lockfile. |
| `COPY server.js` y `COPY src` | Incluye el proxy y el validador JWT. | Una etapa de empaquetado sería innecesaria para este gateway pequeño. |
| `EXPOSE 8080` | Documenta el puerto del adaptador local. | Puede omitirse, no reemplaza `-p`. |
| `CMD ["npm", "start"]` | Ejecuta el gateway con su script oficial. | Ejecutar Node directamente. |

Esta imagen existe para reproducir la prueba local. No se desplegará en OKE.

#### 5.4 Dockerfile del frontend, línea por línea

| Línea/instrucción | Por qué se usa | Alternativa |
|---|---|---|
| `FROM node:24-alpine AS build` | Primera etapa: compila React. | `node:24-slim` mejora compatibilidad y aumenta tamaño temporal. |
| `WORKDIR /app` | Define la ruta de compilación. | Otra ruta consistente. |
| `COPY package*.json ./` + `RUN npm ci` | Instala versiones exactas y reutiliza caché. | `npm install` es menos reproducible. |
| `COPY . .` + `RUN npm run build` | Produce los archivos estáticos sin valores del estudiante. | Construir fuera de Docker reduce reproducibilidad. |
| `FROM nginx:1.29-alpine` | Segunda etapa pequeña para servir HTML, CSS y JS. | Caddy o Apache también sirven archivos estáticos. Ejecutar Vite preview no es una opción de producción. |
| `COPY nginx.conf ...` | Configura rutas de la SPA y evita cachear la configuración. | Una configuración Nginx montada externamente permite modificarla sin construir. |
| `COPY --from=build ...` | Copia solo el resultado; Node y las fuentes no quedan en producción. | Una sola etapa produciría una imagen mayor. |
| `COPY 40-runtime-config.sh ...` | Genera `runtime-config.js` al iniciar con los valores recibidos. | Montar directamente un archivo `runtime-config.js` mediante ConfigMap en OKE. |
| `RUN chmod +x ...` | Permite que el entrypoint oficial ejecute el generador. | Integrar la lógica en otro entrypoint requiere mantener más código. |
| `EXPOSE 80` | Documenta el puerto HTTP de Nginx. | Puede omitirse sin impedir publicar el puerto. |

El frontend no utiliza `ARG` ni incorpora variables `VITE_*` durante el build. `index.html` carga `runtime-config.js`; Nginx lo genera al arrancar el contenedor. Por tanto, una sola imagen sirve para todos los estudiantes y, después, para OKE.

#### 5.5 Construir y comprobar

Inicie Docker.desktop

![alt text](image-41.png)
Desde la raíz del proyecto:

```powershell
docker build -t ecored-companies:1.0 services/companies-service
```
![alt text](image-42.png)
```powershell
docker build -t ecored-materials:1.0 services/materials-service
```
![alt text](image-43.png)
```powershell

docker build -t ecored-local-gateway:1.0 local-gateway
```
![alt text](image-44.png)

```powershell
docker build -t ecored-frontend:1.0 frontend
```
![alt text](image-45.png)

```powershell
docker image ls ecored-*
```
![alt text](image-46.png)


#### 5.6 Publicar en Docker Hub

Reemplace `SU_USUARIO` y publique solamente imágenes, nunca `.env` ni Wallets:

```powershell
docker login
```
![alt text](image-47.png)

```powershell
docker tag ecored-companies:1.0 SU_USUARIO/ecored-companies:1.0
```

```powershell
docker tag ecored-materials:1.0 SU_USUARIO/ecored-materials:1.0
```
```powershell
docker tag ecored-local-gateway:1.0 SU_USUARIO/ecored-local-gateway:1.0
```
```powershell
docker tag ecored-frontend:1.0 SU_USUARIO/ecored-frontend:1.0
```
![alt text](image-49.png)

```powershell

docker push SU_USUARIO/ecored-companies:1.0
```
```powershell

docker push SU_USUARIO/ecored-materials:1.0
```
```powershell

docker push SU_USUARIO/ecored-local-gateway:1.0
```
```powershell

docker push SU_USUARIO/ecored-frontend:1.0
```
![alt text](image-50.png)
![alt text](image-51.png)
![alt text](image-52.png)
![alt text](image-53.png)
![alt text](image-54.png)

Use una etiqueta fija como `1.0` para que la clase ejecute exactamente los mismos artefactos. `latest` puede existir, pero no debe ser la única referencia del taller.

### 2. Modo OCI/OKE

Los Dockerfile y las imágenes no se modifican para Kubernetes. En el próximo taller las imágenes se publicarán o copiarán a OCIR, se referenciarán desde Deployments y recibirán configuración mediante ConfigMaps y Secrets.

---

# Etapa 2 — Reproducir desde las imágenes del docente

Esta etapa comienza sin compilar el código. Su objetivo es demostrar que una imagen es un artefacto portable y que la configuración pertenece al entorno de ejecución.

## Fase 6 — Descargar imágenes y preparar variables

### 1. Modo local

#### 6.1 Descargar

El docente comunicará `DOCENTE_DOCKERHUB` y `VERSION`:

```powershell
docker pull DOCENTE_DOCKERHUB/ecored-companies:VERSION
docker pull DOCENTE_DOCKERHUB/ecored-materials:VERSION
docker pull DOCENTE_DOCKERHUB/ecored-local-gateway:VERSION
docker pull DOCENTE_DOCKERHUB/ecored-frontend:VERSION
```

#### 6.2 Crear archivos de entorno

Las credenciales no pueden ni deben extraerse de una imagen. `docker image inspect` solo muestra valores no secretos declarados con `ENV`; las URI, contraseñas y configuración del estudiante se entregan al crear el contenedor.

Cree en una carpeta de trabajo estos cuatro archivos. No los publique.

`companies.docker.env`:

```powershell


python -c "import secrets; print(secrets.token_urlsafe(50))"
```
![alt text](image-65.png)
![alt text](image-66.png)

```dotenv
DJANGO_SECRET_KEY=CLAVE_LOCAL_ALEATORIA
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,ecored-companies
CORS_ALLOWED_ORIGINS=http://127.0.0.1:8088,http://localhost:8088
MONGODB_URI=URI_REAL_DE_MONGODB
MONGODB_DB_NAME=ecored_companies
```

`materials.docker.env`:

```dotenv
PORT=8002
HOST=0.0.0.0
ORACLE_USER=ecored
ORACLE_PASSWORD=CLAVE_REAL
ORACLE_CONNECT_STRING=CADENA_TLS_REAL_EN_UNA_LINEA
COMPANIES_SERVICE_URL=http://ecored-companies:8001/api
```

`gateway.docker.env`:

```dotenv
PORT=8080
HOST=0.0.0.0
FIREBASE_PROJECT_ID=PROJECT_ID_REAL
FIREBASE_JWKS_URL=https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com
CORS_ORIGINS=http://127.0.0.1:8088,http://localhost:8088
COMPANIES_URL=http://ecored-companies:8001
MATERIALS_URL=http://ecored-materials:8002
```

`frontend.docker.env`:

```dotenv
VITE_API_URL=http://127.0.0.1:8080/api
VITE_FIREBASE_API_KEY=VALOR_FIREBASE
VITE_FIREBASE_AUTH_DOMAIN=VALOR_FIREBASE
VITE_FIREBASE_PROJECT_ID=VALOR_FIREBASE
VITE_FIREBASE_APP_ID=VALOR_FIREBASE
```

Observe la diferencia de direcciones:

- el navegador usa `127.0.0.1` y los puertos publicados;
- un contenedor usa los nombres `ecored-companies` y `ecored-materials` dentro de la red Docker;
- las bases usan sus URI externas.

### 2. Modo OCI/OKE

Los nombres de variables serán los mismos. En el próximo taller los valores no sensibles irán a ConfigMaps, los sensibles a Secrets y las direcciones internas usarán nombres de Services de Kubernetes.

## Fase 7 — Inyectar la configuración y poner el sistema en funcionamiento

### 1. Modo local

Si necesita borrar un contenedor desde CLI (por ejemplo el ecored-companies)
```powershell
 docker rm -f ecored-companies ecored-companies
 ```

Cree una red privada para los cuatro contenedores:

```powershell
docker network create ecored-net
```
![alt text](image-55.png)

Ejecute las imágenes en este orden en la carpeta donde estan los .env:
![alt text](image-58.png)

```powershell
docker run -d --name ecored-companies --network ecored-net --env-file companies.docker.env -p 8001:8001 DOCENTE_DOCKERHUB/ecored-companies:VERSION
```
![alt text](image-59.png)

```powershell
docker run -d --name ecored-materials --network ecored-net --env-file materials.docker.env -p 8002:8002 DOCENTE_DOCKERHUB/ecored-materials:VERSION
```
![alt text](image-60.png)

```powershell
docker run -d --name ecored-local-gateway --network ecored-net --env-file gateway.docker.env -p 8080:8080 DOCENTE_DOCKERHUB/ecored-local-gateway:VERSION
```
![alt text](image-61.png)

```powershell
docker run -d --name ecored-frontend --network ecored-net --env-file frontend.docker.env -p 8088:80 DOCENTE_DOCKERHUB/ecored-frontend:VERSION
```
![alt text](image-62.png)
Abra `http://127.0.0.1:8088` y espere que el inicio de sesión muestre la aplicación.
![alt text](image-63.png)
![alt text](image-64.png)

![alt text](image-67.png)

![alt text](image-68.png)
![alt text](image-69.png)

Compruebe los procesos desde la terminal de Visual Studio Code:

```powershell
docker ps
docker logs ecored-companies
docker logs ecored-materials
docker logs ecored-local-gateway
docker logs ecored-frontend
```

```mermaid
sequenceDiagram
    participant F as "Navegador/Nginx · runtime-config.js"
    participant G as "ecored-local-gateway:8080"
    participant M as "ecored-materials:8002"
    participant C as "ecored-companies:8001"
    participant DB as "MongoDB / Oracle externos"
    F->>F: cargar VITE_API_URL + Firebase en ejecución
    F->>G: /api + Bearer token
    G->>M: X-User-Id + solicitud
    M->>C: companyId + X-User-Id
    C->>DB: MongoDB URI
    M->>DB: Oracle connectString
    DB-->>F: datos persistidos mediante las APIs
```

El entrypoint de Nginx crea `runtime-config.js` con `frontend.docker.env`; no recompila React. El navegador llama al puerto publicado del gateway. Dentro de `ecored-net`, `proxy()` y `assertOwnedCompany()` resuelven los contenedores por nombre. Los repositorios usan las URI externas, de modo que eliminar un contenedor no elimina los datos.

### 2. Modo OCI/OKE

Docker Network será reemplazada por la red del clúster; los nombres de contenedor por Services; `docker run` por Deployments; y `--env-file` por ConfigMaps y Secrets. La imagen del gateway local no se utilizará.

## Fase 8 — Repetir la prueba integral con las imágenes

### 1. Modo local

Abra `tests/ecored-end-to-end.http` y repita las solicitudes en orden. Debe obtener:

| Verificación | Resultado esperado |
|---|---|
| `GET /health` del gateway | `200` |
| ruta protegida sin Bearer token | `401` |
| login de Firebase | respuesta con `idToken` |
| crear empresa | `201` e `id` de MongoDB |
| crear material con esa empresa | `201` e `id` de Oracle |
| listas autenticadas | incluyen los datos creados |
| llamada directa sin `X-User-Id` | `401` |

También puede importar o reconstruir las mismas solicitudes en Postman siguiendo la Fase 4. No cambie los payloads ni la identidad entre las pruebas desde código y desde imágenes.

Para confirmar persistencia, detenga y elimine los cuatro contenedores, ejecútelos nuevamente con los mismos archivos de entorno y repita los listados. Las empresas y materiales deben continuar porque las bases son servicios externos.

```powershell
docker stop ecored-frontend ecored-local-gateway ecored-materials ecored-companies
docker rm ecored-frontend ecored-local-gateway ecored-materials ecored-companies
```

### 2. Modo OCI/OKE

En el próximo taller se repetirá la misma prueba contra la URL de OCI API Gateway. No se solicita evidencia, configuración ni evaluación de OCI en este taller.

---

## Puente hacia el próximo taller de OKE

| En este taller | En OCI/OKE |
|---|---|
| proceso o contenedor de Empresas | Deployment + Service privado |
| proceso o contenedor de Materiales | Deployment + Service privado |
| Nginx del frontend | Deployment + Service y mecanismo de publicación |
| gateway local con `jose` | OCI API Gateway con validación JWT |
| nombres de la red Docker | DNS de Services de Kubernetes |
| archivo `.env` / `--env-file` | ConfigMap y Secret |
| Docker Hub | OCIR o registro autorizado |
| reinicio manual | reconciliación de Deployments |
| `docker logs` | logs de pods y observabilidad de OCI |

Las imágenes ya probadas serán la entrada del siguiente taller. Allí se construirán manifiestos, se configurará OCI API Gateway y se verificará que solo el gateway pueda alcanzar públicamente los microservicios.

## Comprobación final del taller

- [ ] Empresas arranca únicamente si MongoDB responde.
- [ ] Materiales arranca únicamente si Oracle responde.
- [ ] El frontend obtiene un token real de Firebase.
- [ ] El gateway rechaza una solicitud sin token.
- [ ] `X-User-Id` procede del claim `sub` validado y no del frontend.
- [ ] Materiales valida la empresa mediante la API de Empresas.
- [ ] Las cuatro imágenes se construyen y publican con una etiqueta fija.
- [ ] Las imágenes del docente se ejecutan usando archivos de entorno externos.
- [ ] La imagen del frontend acepta configuración en tiempo de ejecución.
- [ ] El archivo `.http` completa el flujo empresa → material.
- [ ] Los datos sobreviven al reemplazo de los contenedores.

## Referencias

- [Firebase Authentication REST: inicio de sesión con correo y contraseña](https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password)
- [Firebase: verificar ID tokens con una biblioteca JWT externa](https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library)
- [REST Client para Visual Studio Code](https://github.com/Huachao/vscode-restclient)
- [Dockerfile: descripción de instrucciones](https://docs.docker.com/reference/dockerfile/)
- [Docker: variables de entorno al ejecutar contenedores](https://docs.docker.com/engine/containers/run/#environment-variables)
- [Oracle Autonomous Database: cadenas de conexión y Wallet](https://docs.oracle.com/en/cloud/paas/autonomous-database/serverless/adbsb/connect-download-wallet.html)
- [node-oracledb: conexión TLS de una vía con Autonomous Database](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html#one-way-tls-connection-to-oracle-autonomous-database)
- [Oracle Kubernetes Engine](https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm)
