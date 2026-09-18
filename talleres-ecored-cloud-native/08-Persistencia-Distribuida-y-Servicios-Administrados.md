# Taller 8. Persistencia distribuida y servicios administrados para EcoRed

[← Taller 7](07-Arquitectura-Event-Driven-OCI-Streaming.md) | [Índice de la ruta](README.md) | [Taller 9 →](09-Seguridad-Observabilidad-y-Monitoreo.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **CRUD — Create, Read, Update, Delete:** Crear, Leer, Actualizar y Eliminar.
- **JSON — JavaScript Object Notation:** Notación de Objetos de JavaScript.
- **CSV — Comma-Separated Values:** Valores Separados por Comas.
- **DB — Database:** Base de Datos.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye la capa de **persistencia y servicios de apoyo** de la arquitectura destino. Cada dominio asume propiedad explícita sobre sus datos y se incorporan servicios administrados para evidencias, búsqueda, georreferenciación y analítica.

**Bloques de la arquitectura destino trabajados en este taller:**

- Persistencia por microservicio
- Object Storage para archivos y evidencias
- OpenSearch para búsqueda y catálogo
- Georreferenciación
- Impacto y analítica

**Proyecto:** EcoRed Circular  
**Capa objetivo:** persistencia por dominio + Object Storage + búsqueda + geodatos/analítica.

# 1. Propósito

Aplicar ownership de datos por microservicio y sustituir responsabilidades técnicas específicas por servicios administrados de OCI. Para mantener el laboratorio viable, la separación puede implementarse con recursos lógicos independientes y credenciales/usuarios separados, pero cada dominio debe tener **propietario exclusivo** de sus datos.





# 2. Objetivo

```text
Empresas      → datos Empresas
Materiales    → datos Materiales
Actores       → datos Actores
Solicitudes   → datos Solicitudes

Archivos      → OCI Object Storage
Búsqueda      → OCI Search with OpenSearch
Geodatos      → persistencia geoespacial definida
Impacto       → Object Storage / capa analítica
```

# 3. Principios obligatorios

1. Un microservicio **no consulta directamente** las tablas/colecciones de otro.
2. La integración entre dominios se realiza mediante API o eventos.
3. Los documentos/binarios no se guardan en el filesystem efímero de pods.
4. Los índices de búsqueda son una **vista derivada**, no la fuente autoritativa del dominio Materiales.

# Fase 1. Diseñar ownership de datos

## Paso 1.1. Crear matriz de ownership

Cree `docs/data-ownership.md`:

| Servicio | Datos autoritativos | Acceso directo permitido |
|---|---|---|
| Empresas | empresas | solo Empresas |
| Materiales | materiales/publicaciones | solo Materiales |
| Actores | perfiles | solo Actores |
| Solicitudes | solicitudes/matching | solo Solicitudes |
| Notificaciones | historial de envío | solo Notificaciones |
| Administración | catálogos maestros | solo Administración |

## Paso 1.2. Seleccionar persistencia OCI para el laboratorio

Utilice un servicio administrado compatible con el modelo de cada dominio. Para datos JSON/documentales puede utilizar **Oracle NoSQL Database Cloud Service**; para datos relacionales/espaciales puede utilizar un servicio Oracle Database administrado disponible en la cuenta.

Registre en el informe la elección y justificación. No cambie simultáneamente todos los dominios si no es necesario para demostrar el patrón.

## Paso 1.3. Crear recursos de datos por dominio

Como mínimo cree recursos separados para:

```text
Empresas
Materiales
Actores
Solicitudes
```

Si se usa NoSQL, utilice tablas independientes y políticas que permitan a cada workload acceder solo a sus recursos.

### Verificación

Cada servicio puede operar sus datos sin credenciales de otro dominio.

# Fase 2. Migrar los dominios prioritarios

## Paso 2.1. Migrar Empresas

1. Exporte un conjunto pequeño de datos de prueba.
2. Cree la estructura OCI de destino.
3. Importe.
4. Configure `empresas-service` para usar únicamente la nueva persistencia.
5. Ejecute CRUD y pruebas de regresión.

## Paso 2.2. Migrar Materiales

Repita con Materiales. Mantenga `empresaId` como referencia de negocio; no abra conexión directa a la persistencia de Empresas.

Cuando necesite validar empresa:

```text
Materiales → API Empresas
```

o use información derivada mediante eventos si el caso lo justifica.

## Paso 2.3. Migrar Actores y Solicitudes

Repita el mismo criterio de ownership.

### Verificación

Las pruebas muestran que quitar credenciales de una base ajena no rompe operaciones legítimas del servicio.

# Fase 3. Incorporar Object Storage y OpenSearch

## Paso 3.1. Crear bucket de evidencias

Abra **Storage → Object Storage & Archive Storage → Buckets**.

Cree:

```text
Bucket: ecored-evidencias
Compartment: ecored-dev
Visibility: Private
```

No haga el bucket público.

## Paso 3.2. Modificar Materiales para almacenar archivos en Object Storage

El registro de Materiales debe guardar únicamente metadatos/referencia del objeto:

```text
objectName
bucket
contentType
checksum opcional
```

El archivo se almacena en Object Storage.

### Verificación

Reiniciar un pod no elimina la evidencia.

## Paso 3.3. Crear OCI Search with OpenSearch

Cree un cluster OpenSearch con dimensionamiento de laboratorio, revisando costo antes de confirmar.

Índice mínimo:

```text
materiales
```

Campos de ejemplo:

```text
materialId
titulo
descripcion
categoria
ciudad
empresaId
```

## Paso 3.4. Alimentar el índice desde eventos

`catalogo-service` debe consumir `MaterialPublicado` y actualizar OpenSearch.

La búsqueda no debe leer directamente la persistencia interna de Materiales.

### Verificación

Una búsqueda por término retorna el material publicado.

# Fase 4. Completar geodatos y analítica mínima

## Paso 4.1. Crear `georreferenciacion-service`

Implemente un servicio que gestione ubicaciones/sedes y exponga al menos:

```text
POST /api/ubicaciones
GET  /api/ubicaciones
```

Use un almacenamiento OCI apropiado; si emplea Oracle Database, documente el uso de capacidades espaciales cuando aplique.

## Paso 4.2. Crear `impacto-service`

Consuma eventos como:

```text
MaterialPublicado
MaterialAprovechado
```

y genere métricas básicas:

```text
materiales publicados
materiales aprovechados
tasa de aprovechamiento
```

## Paso 4.3. Crear zona analítica en Object Storage

Cree bucket privado:

```text
ecored-analytics
```

Escriba archivos derivados de eventos en un formato documentado (JSON/CSV/Parquet según el alcance).

### Verificación

Los datos analíticos se separan de las bases transaccionales.

# Fase 5. Validar desacoplamiento de datos

## Paso 5.1. Prohibir acceso cruzado

Revise configuración y políticas para que cada microservicio use únicamente sus recursos.

## Paso 5.2. Probar flujo completo

```text
POST Material
→ DB/tabla Materiales
→ MaterialPublicado
→ OpenSearch
→ Impacto
→ Object Storage analítico
```

## Paso 5.3. Actualizar arquitectura

El diagrama debe mostrar explícitamente qué persistencia pertenece a cada servicio.

# Entregables

- [ ] Matriz de ownership.
- [ ] Persistencia separada de al menos cuatro dominios.
- [ ] Sin consultas directas entre bases de microservicios.
- [ ] Bucket privado `ecored-evidencias`.
- [ ] Evidencia subida desde un microservicio.
- [ ] Cluster/índice OpenSearch funcional.
- [ ] Catálogo actualizado desde evento.
- [ ] `georreferenciacion-service` mínimo.
- [ ] `impacto-service` mínimo.
- [ ] Bucket/zona analítica separada.
- [ ] Diagrama de datos actualizado.

# Contrato de entrada para el Taller 9

La arquitectura ya es distribuida. El siguiente taller agrega controles transversales para **protegerla y observarla**.

# Referencias oficiales

- Object Storage: https://docs.oracle.com/en-us/iaas/Content/Object/Concepts/objectstorageoverview.htm
- OCI Search with OpenSearch: https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Concepts/ociopensearch.htm
- OpenSearch clusters: https://docs.oracle.com/en-us/iaas/Content/search-opensearch/Tasks/manageociopensearch.htm
- Oracle NoSQL Database: https://docs.oracle.com/en-us/iaas/nosql-database/index.html
- OKE Workload Identity: https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contenggrantingworkloadaccesstoresources.htm


---

[← Taller 7](07-Arquitectura-Event-Driven-OCI-Streaming.md) | [Índice de la ruta](README.md) | [Taller 9 →](09-Seguridad-Observabilidad-y-Monitoreo.md)
