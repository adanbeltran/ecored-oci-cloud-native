# Taller 10. Automatización e integración de la arquitectura destino de EcoRed

[← Taller 9](09-Seguridad-Observabilidad-y-Monitoreo.md) | [Índice de la ruta](README.md) | [Índice / cierre de ruta →](README.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **CI/CD — Continuous Integration / Continuous Delivery or Deployment:** Integración Continua / Entrega o Despliegue Continuo.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **OCIR — Oracle Cloud Infrastructure Registry / OCI Container Registry:** Registro de Contenedores de Oracle Cloud Infrastructure.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **REST — Representational State Transfer:** Transferencia de Estado Representacional.
- **JWT — JSON Web Token:** Token Web JSON.
- **IAM — Identity and Access Management:** Gestión de Identidad y Acceso.
- **APM — Application Performance Monitoring:** Monitoreo del Rendimiento de Aplicaciones.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller integra todos los bloques de la arquitectura destino y automatiza el flujo de entrega. Un cambio versionado debe poder convertirse en una imagen, publicarse en el registro, desplegarse en Kubernetes y validarse mediante los recorridos síncronos, asíncronos, de persistencia y observabilidad construidos en los talleres anteriores.

**Bloques de la arquitectura destino trabajados en este taller:**

- Build Pipeline
- Publicación de imágenes
- Deployment Pipeline
- Despliegue a Kubernetes
- Validación de arquitectura extremo a extremo

**Proyecto:** EcoRed Circular  
**Meta final:** automatizar la entrega y demostrar la arquitectura objetivo funcionando de extremo a extremo.

# 1. Propósito

Crear pipelines de integración y despliegue con OCI DevOps para que un cambio versionado produzca pruebas, imagen, publicación en OCIR y despliegue controlado en OKE. Después se valida la arquitectura completa de EcoRed contra los bloques definidos como objetivo.





# 2. Objetivo

```text
Git commit/push
      │
      ▼
OCI DevOps Build Pipeline
      │
      ├── tests
      ├── docker build
      ├── tag
      └── push
      │
      ▼
     OCIR
      │
      ▼
OCI DevOps Deployment Pipeline
      │
      ▼
     OKE
      │
      ▼
EcoRed microservicios
```

# 3. Arquitectura que debe existir antes de iniciar

```text
Clientes
  ↓
API Gateway + autenticación
  ↓
OKE + microservicios
  ↓
REST + OCI Streaming
  ↓
Persistencias por dominio + Object Storage + OpenSearch

Transversal:
IAM + secretos + Logging + Monitoring + APM
```

# Fase 1. Preparar OCI DevOps

## Paso 1.1. Crear proyecto DevOps

Abra:

```text
Developer Services → DevOps → Projects → Create DevOps Project
```

Configure:

```text
Name: ecored-devops
Compartment: ecored-dev
```

## Paso 1.2. Definir origen del código

Use un repositorio soportado por OCI DevOps. Si el repositorio público de clase se mantiene en GitHub, configure la conexión soportada; para una práctica controlada también puede utilizar OCI Code Repository si el docente lo decide.

### Verificación

El pipeline puede leer el commit seleccionado.

## Paso 1.3. Crear Build Pipeline

Cree:

```text
Name: ecored-build
```

Etapas mínimas:

```text
1. Checkout
2. Tests
3. Build imágenes modificadas
4. Tag con versión/commit
5. Push a OCIR
```

## Paso 1.4. Definir estrategia de versionamiento

Utilice un tag reproducible, por ejemplo:

```text
v2.0.0
```

o:

```text
<version>-<short-commit>
```

No sobrescriba como única estrategia `latest`.

# Fase 2. Automatizar build y publicación

## Paso 2.1. Crear build specification

Cree `build_spec.yaml` según el formato de OCI DevOps. Debe ejecutar pruebas y construir al menos un microservicio.

Pseudo-secuencia:

```text
python -m pytest

docker build services/empresas

docker tag ...
docker push ...
```

Ajuste al mecanismo de build administrado de OCI DevOps.

## Paso 2.2. Configurar permisos mínimos del pipeline

Cree políticas para que DevOps pueda:

```text
leer código
publicar artefactos en OCIR
acceder al entorno de despliegue OKE
```

No conceda administración global de la tenancy.

## Paso 2.3. Ejecutar pipeline

Realice un cambio pequeño y ejecute el build.

### Verificación

- pruebas pasan;
- nueva imagen aparece en OCIR;
- el tag corresponde al commit/versión.

# Fase 3. Automatizar despliegue a OKE

## Paso 3.1. Crear environment de OKE en DevOps

Registre `ecored-oke` como Kubernetes Cluster Environment.

## Paso 3.2. Crear Deployment Pipeline

Cree:

```text
Name: ecored-deploy
```

Agregue una etapa de despliegue a OKE usando manifiestos/Helm según el enfoque del curso.

## Paso 3.3. Parametrizar imagen

El Deployment debe recibir la versión producida por el Build Pipeline.

No edite manualmente en producción:

```text
kubectl set image ...
```

como procedimiento normal.

## Paso 3.4. Ejecutar despliegue y validar rollout

Compruebe:

```bash
kubectl rollout status deployment/<servicio> -n ecored
```

### Verificación

La versión desplegada coincide con el artefacto producido por el pipeline.

# Fase 4. Integrar y validar arquitectura objetivo

## Paso 4.1. Probar recorrido síncrono

```text
Usuario
→ Web React
→ JWT
→ API Gateway
→ Empresas/Materiales/Actores
→ persistencia propia
```

Registre evidencia de un caso exitoso y uno no autorizado.

## Paso 4.2. Probar recorrido asíncrono

```text
POST Material
→ materiales-service
→ MaterialPublicado
→ OCI Streaming
→ catalogo-service
→ OpenSearch
→ impacto-service
```

### Verificación

El mismo `correlationId/eventId` puede seguirse en logs/trazas.

## Paso 4.3. Probar evidencia/archivo

Suba una evidencia y compruebe que:

```text
metadata → dominio Materiales
archivo  → Object Storage
```

Reinicie el pod y vuelva a consultar el archivo.

## Paso 4.4. Probar resiliencia

Elimine un pod de un microservicio con múltiples réplicas y compruebe:

```text
Service continúa disponible
Deployment repone la réplica
Monitoring registra el cambio
```

## Paso 4.5. Probar pipeline de cambio

Cambie una versión de `empresas-service` y ejecute:

```text
commit
→ build
→ tests
→ OCIR
→ deploy OKE
```

sin reconstruir los demás servicios innecesariamente.

# Fase 5. Cerrar arquitectura y documentación

## Paso 5.1. Construir diagrama final

Debe mostrar:

```text
1. Canales/clientes
2. API Gateway + identidad
3. Microservicios en OKE
4. Event Bus / OCI Streaming
5. Persistencia por servicio + Object Storage + OpenSearch + analítica
6. IAM, secretos, observabilidad, monitoreo, CI/CD
```

## Paso 5.2. Crear matriz componente → servicio OCI

Ejemplo:

| Arquitectura objetivo | Implementación |
|---|---|
| API Gateway | OCI API Gateway |
| Kubernetes | OKE |
| Registry | OCI Container Registry |
| Event Bus | OCI Streaming |
| Evidencias | OCI Object Storage |
| Búsqueda | OCI Search with OpenSearch |
| Secretos | OCI Secret Management |
| Logs | OCI Logging |
| Métricas/Alarmas | OCI Monitoring |
| Trazas | OCI APM |
| CI/CD | OCI DevOps |

## Paso 5.3. Revisar costos y limpieza

1. Identifique recursos de mayor costo.
2. Detenga/elimine entornos que no deban conservarse.
3. No elimine evidencias antes de la evaluación.
4. Documente los recursos, dependencias y parámetros necesarios para reconstruir la arquitectura de forma reproducible.

# Entregables finales

- [ ] Proyecto OCI DevOps `ecored-devops`.
- [ ] Build Pipeline funcional.
- [ ] Pruebas automatizadas ejecutadas por pipeline.
- [ ] Imágenes versionadas en OCIR.
- [ ] Deployment Pipeline a OKE.
- [ ] Despliegue reproducible de al menos un microservicio.
- [ ] Flujo síncrono extremo a extremo.
- [ ] Flujo asíncrono extremo a extremo.
- [ ] Persistencia por dominio validada.
- [ ] Object Storage y OpenSearch integrados.
- [ ] IAM/Secret Management/Logging/Monitoring/APM operativos.
- [ ] Prueba de resiliencia.
- [ ] Diagrama final de arquitectura.
- [ ] Matriz componente → servicio OCI.
- [ ] Informe de costos/recursos conservados y eliminados.

# Criterio de éxito del ciclo

El ciclo termina cuando EcoRed puede demostrar, con evidencias técnicas, esta transformación:

```text
Taller base
Docker + Docker Hub + Render

        ↓

Taller 1
OCI Container Instances

        ↓

Taller 2
OCIR + networking privado

        ↓

Talleres 3-4
OKE + resiliencia

        ↓

Taller 5
Microservicios

        ↓

Talleres 6-7
API Gateway + eventos

        ↓

Taller 8
Datos distribuidos + servicios administrados

        ↓

Taller 9
Seguridad + observabilidad

        ↓

Taller 10
CI/CD + arquitectura objetivo integrada
```

# Referencias oficiales

- OCI DevOps getting started: https://docs.oracle.com/en-us/iaas/Content/devops/using/getting_started.htm
- Build Pipeline: https://docs.oracle.com/en-us/iaas/Content/devops/using/create_buildpipeline.htm
- Deployment Pipeline: https://docs.oracle.com/en-us/iaas/Content/devops/using/create_pipeline.htm
- Deploying to OKE: https://docs.oracle.com/en-us/iaas/Content/devops/using/deploy_oke.htm
- Helm to OKE: https://docs.oracle.com/en-us/iaas/Content/devops/using/deploy-helmchart.htm
- OKE: https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm


---

[← Taller 9](09-Seguridad-Observabilidad-y-Monitoreo.md) | [Índice de la ruta](README.md) | [Índice / cierre de ruta →](README.md)
