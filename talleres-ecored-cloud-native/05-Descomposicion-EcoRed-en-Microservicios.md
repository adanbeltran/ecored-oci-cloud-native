# Taller 5. Descomposición de EcoRed en microservicios

[← Taller 4](04-Resiliencia-Escalabilidad-y-Entrada-OKE.md) | [Índice de la ruta](README.md) | [Taller 6 →](06-API-Gateway-Autenticacion-Comunicacion-Sincrona.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **OCIR — Oracle Cloud Infrastructure Registry / OCI Container Registry:** Registro de Contenedores de Oracle Cloud Infrastructure.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **REST — Representational State Transfer:** Transferencia de Estado Representacional.
- **HTTP — Hypertext Transfer Protocol:** Protocolo de Transferencia de Hipertexto.
- **DNS — Domain Name System:** Sistema de Nombres de Dominio.
- **JSON — JavaScript Object Notation:** Notación de Objetos de JavaScript.
- **WSGI — Web Server Gateway Interface:** Interfaz de Pasarela para Servidores Web.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye el bloque central de **microservicios de negocio** de la arquitectura destino. Los dominios de EcoRed comienzan a convertirse en servicios con ciclo de construcción, imagen, despliegue y endpoint internos independientes.

**Bloques de la arquitectura destino trabajados en este taller:**

- Microservicio de Empresas
- Microservicio de Materiales
- Microservicio de Actores
- Servicios Kubernetes y descubrimiento por DNS
- Backlog de extracción de los dominios restantes

**Proyecto:** EcoRed Circular  
**Meta:** iniciar la descomposición del backend por dominio sin cambiar simultáneamente todas las tecnologías.

# 1. Propósito

Separar de forma incremental responsabilidades de negocio de EcoRed y desplegarlas como servicios independientes sobre el cluster OKE creado en los talleres anteriores. Para reducir variables, los primeros servicios mantienen **Python + Django REST Framework** y utilizan el mismo mecanismo de contenerización aprendido.





# 2. Alcance mínimo obligatorio

En este taller se separan primero:

```text
Empresas
Materiales
Actores
```

Los demás dominios se preparan como backlog de evolución:

```text
Búsqueda/Catálogo
Solicitudes/Matching
Notificaciones
Georreferenciación
Impacto/Analítica
Administración
```

# 3. Objetivo

```text
                        OKE
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
  empresas-service  materiales-service  actores-service
        │                │                │
   Deployment       Deployment       Deployment
        │                │                │
     Service          Service          Service
```

# 4. Conceptos nuevos

- **microservicio:** unidad desplegable de forma independiente alrededor de una responsabilidad de negocio.
- **bounded context:** límite explícito donde un modelo de dominio tiene significado coherente.
- **contrato API:** interfaz pública que otros clientes/servicios consumen.
- **service discovery:** capacidad de encontrar un servicio por un nombre estable; Kubernetes proporciona DNS para Services.
- **acoplamiento:** dependencia entre componentes. El objetivo no es “crear muchos proyectos”, sino reducir dependencias de despliegue y de datos.

# Fase 1. Definir límites y contratos

## Paso 1.1. Inventariar funciones actuales de EcoRed

A partir del backend actual identifique qué endpoints/modelos pertenecen a:

```text
Empresas
Materiales/Publicaciones
Actores/Perfiles
```

No modifique código todavía. Cree `docs/microservicios-mapa.md` con una tabla:

| Dominio | Funciones actuales | Datos que posee | API esperada |
|---|---|---|---|
| Empresas | registro/consulta | empresas | `/api/empresas` |
| Materiales | publicar/consultar materiales | materiales | `/api/materiales` |
| Actores | perfiles | actores | `/api/actores` |

## Paso 1.2. Definir contratos HTTP mínimos

Para cada servicio documente al menos:

```text
GET  /health
GET  /api/<recurso>
POST /api/<recurso>
GET  /api/<recurso>/<built-in function id>
```

Mantenga JSON y códigos HTTP coherentes.

### Verificación

Los contratos se pueden leer sin conocer la implementación interna.

## Paso 1.3. Crear estructura de servicios

Dentro del repositorio cree:

```text
services/
├── empresas/
├── materiales/
└── actores/
```

Cada servicio debe tener su propio:

```text
manage.py
requirements.txt
Dockerfile
README.md
```

No copie secretos ni `.env` al repositorio.

# Fase 2. Extraer y probar los primeros servicios

## Paso 2.1. Crear el servicio Empresas

Manteniendo Django REST Framework:

```bash
mkdir -p services/empresas
cd services/empresas
python -m venv .venv
# activar entorno según el sistema operativo
pip install django djangorestframework gunicorn

django-admin startproject config .
python manage.py startapp empresas
```

Migre únicamente la lógica y contratos necesarios para Empresas. Agregue:

```text
GET /health
GET/POST /api/empresas
```

### Verificación

El servicio responde localmente sin iniciar el backend monolítico completo.

## Paso 2.2. Repetir para Materiales

Cree un servicio independiente `services/materiales` con:

```text
GET /health
GET/POST /api/materiales
```

No haga consultas directas al código interno de Empresas. Si necesita identificar una empresa, use un identificador en el contrato y documente la dependencia temporal.

## Paso 2.3. Repetir para Actores

Cree `services/actores` con:

```text
GET /health
GET/POST /api/actores
```

## Paso 2.4. Ejecutar pruebas independientes

Cada servicio debe arrancar en un puerto local distinto durante desarrollo, por ejemplo:

```text
Empresas   8101
Materiales 8102
Actores    8103
```

Pruebe con `curl` o Postman.

# Fase 3. Contenerizar y publicar en OCIR

## Paso 3.1. Crear un Dockerfile por servicio

Use una imagen base Python compatible y un servidor WSGI. Cada imagen debe exponer un puerto interno estándar, por ejemplo `8000`.

Ejemplo conceptual:

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

## Paso 3.2. Construir y probar localmente

```bash
docker build -t ecored-empresas:v1.0 services/empresas
docker run --rm -p 8101:8000 ecored-empresas:v1.0
```

Repita para materiales y actores.

## Paso 3.3. Crear repositories en OCIR

```text
ecored/empresas
ecored/materiales
ecored/actores
```

Etiquete y publique:

```bash
docker tag ecored-empresas:v1.0 <OCIR>/<TENANCY_NAMESPACE>/ecored/empresas:v1.0
docker push <OCIR>/<TENANCY_NAMESPACE>/ecored/empresas:v1.0
```

Repita para los demás.

### Verificación

Los tres repositories muestran `v1.0`.

# Fase 4. Desplegar microservicios y comprobar descubrimiento

## Paso 4.1. Crear Deployment y Service por microservicio

Para Empresas cree `k8s/empresas.yaml` con un Deployment y un Service `ClusterIP` llamado:

```text
empresas-service
```

Repita:

```text
materiales-service
actores-service
```

Use labels distintos por aplicación.

## Paso 4.2. Aplicar manifiestos

```bash
kubectl apply -f k8s/empresas.yaml
kubectl apply -f k8s/materiales.yaml
kubectl apply -f k8s/actores.yaml
kubectl get deploy,pods,svc -n ecored
```

### Verificación

Cada servicio tiene pods y un Service estable.

## Paso 4.3. Probar DNS interno de Kubernetes

Entre temporalmente a un pod de diagnóstico o a uno de los servicios y pruebe:

```text
http://empresas-service/health
http://materiales-service/health
http://actores-service/health
```

### Verificación

Los nombres se resuelven mediante DNS interno sin usar IP de pods.

## Paso 4.4. Mantener transición controlada

No elimine todavía el monolito completo. Documente qué rutas ya fueron extraídas y cuáles permanecen en `ecored`.

El resultado puede ser temporalmente:

```text
OKE
├── ecored (funciones aún no extraídas)
├── empresas-service
├── materiales-service
└── actores-service
```

# Fase 5. Preparar los dominios restantes

## Paso 5.1. Crear backlog de extracción

Orden recomendado:

```text
1. Búsqueda/Catálogo
2. Solicitudes/Matching
3. Notificaciones
4. Georreferenciación
5. Impacto/Analítica
6. Administración
```

## Paso 5.2. Dibujar arquitectura de transición

Marque con dos estilos:

- servicios extraídos;
- funcionalidades aún dentro del monolito.

## Paso 5.3. Verificar independencia de despliegue

Actualice únicamente `empresas-service` a `v1.1` y compruebe que Materiales y Actores no necesitan ser reconstruidos.

# Entregables

- [ ] Mapa de dominios y contratos.
- [ ] `services/empresas`, `services/materiales`, `services/actores`.
- [ ] Tres imágenes independientes en OCIR.
- [ ] Tres Deployments y Services independientes en OKE.
- [ ] Resolución DNS interna por nombre de Service.
- [ ] Prueba de actualización independiente de Empresas.
- [ ] Arquitectura de transición monolito → microservicios.
- [ ] Backlog de extracción de los dominios restantes.

# Contrato de entrada para el Taller 6

El Taller 6 asume que existen **varios endpoints internos** y resuelve el nuevo problema: los clientes no deben conocer directamente cada microservicio.

# Referencias oficiales

- OKE: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengoverview.htm
- Kubernetes Services and networking: https://kubernetes.io/docs/concepts/services-networking/service/
- Kubernetes DNS: https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/


---

[← Taller 4](04-Resiliencia-Escalabilidad-y-Entrada-OKE.md) | [Índice de la ruta](README.md) | [Taller 6 →](06-API-Gateway-Autenticacion-Comunicacion-Sincrona.md)
