# Taller 9. Seguridad, observabilidad y monitoreo de EcoRed

[← Taller 8](08-Persistencia-Distribuida-y-Servicios-Administrados.md) | [Índice de la ruta](README.md) | [Taller 10 →](10-CICD-e-Integracion-Arquitectura-Destino.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **IAM — Identity and Access Management:** Gestión de Identidad y Acceso.
- **RBAC — Role-Based Access Control:** Control de Acceso Basado en Roles.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **APM — Application Performance Monitoring:** Monitoreo del Rendimiento de Aplicaciones.
- **JSON — JavaScript Object Notation:** Notación de Objetos de JavaScript.
- **YAML — YAML Ain’t Markup Language:** YAML no es un Lenguaje de Marcado.
- **CPU — Central Processing Unit:** Unidad Central de Procesamiento.
- **ID — Identifier:** Identificador.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye las **capacidades transversales de seguridad, observabilidad y monitoreo** de la arquitectura destino. La plataforma queda preparada para controlar identidades y secretos y para diagnosticar el comportamiento de una transacción distribuida mediante logs, métricas, trazas y alarmas.

**Bloques de la arquitectura destino trabajados en este taller:**

- IAM y RBAC
- Gestión de secretos
- Logging estructurado
- Monitoring y alarmas
- APM y trazas
- Dashboards operativos

**Proyecto:** EcoRed Circular  
**Capacidades transversales:** IAM, workload identity, secretos, RBAC, logs, métricas, trazas, alarmas y dashboards.

# 1. Propósito

Transformar una arquitectura distribuida funcional en una plataforma operable y segura. El objetivo es eliminar credenciales permanentes innecesarias, aplicar mínimo privilegio y disponer de evidencia para diagnosticar una petición que atraviesa varios componentes.





# 2. Objetivo

```text
                         ECORED
                           │
     ┌─────────────────────┼────────────────────┐
     │                     │                    │
 Seguridad             Observabilidad        Monitoreo
     │                     │                    │
 IAM/RBAC/Secrets      logs/métricas/trazas  alarmas/dashboard
```

# 3. Conceptos nuevos

- **Workload Identity:** identidad de un workload OKE definida por cluster + namespace + service account para acceder a recursos OCI con políticas IAM.
- **RBAC:** autorización dentro de Kubernetes.
- **Secret Management Service:** servicio OCI para almacenar y gestionar información sensible; desde 2026 es un servicio separado de la gestión de secretos histórica de Vault.
- **Logging:** centralización/búsqueda de logs de servicios OCI.
- **Monitoring:** métricas y alarmas sobre salud, capacidad y rendimiento.
- **APM:** trazas y spans para diagnosticar transacciones distribuidas.
- **Correlation ID:** identificador de una solicitud que se propaga por servicios y eventos.

# Fase 1. Endurecer identidad y secretos

## Paso 1.1. Crear ServiceAccounts por workload

Ejemplo:

```bash
kubectl create serviceaccount materiales-sa -n ecored
kubectl create serviceaccount catalogo-sa -n ecored
kubectl create serviceaccount impacto-sa -n ecored
```

Asocie cada Deployment con su `serviceAccountName`.

## Paso 1.2. Configurar OKE Workload Identity para recursos OCI compatibles

Si el cluster es compatible con Workload Identity, cree políticas IAM que otorguen permisos mínimos según combinación cluster/namespace/service account.

Ejemplo conceptual:

```text
materiales-sa → escribir objetos en bucket ecored-evidencias
catalogo-sa   → acceso requerido a recursos de búsqueda
impacto-sa    → escribir en ecored-analytics
```

No otorgue `manage all-resources`.

## Paso 1.3. Crear secretos en OCI Secret Management

Migre al menos:

```text
DJANGO_SECRET_KEY
credencial Firebase
credenciales de persistencia que aún sean necesarias
```

Cree secretos separados y versiones controladas. No coloque valores reales en YAML de Git.

## Paso 1.4. Retirar Auth Tokens permanentes de pods cuando exista identidad de workload

Revise Secrets Kubernetes creados en talleres anteriores y elimine los que ya no se requieran.

### Verificación

Un pod autorizado accede al recurso OCI sin credencial de usuario permanente; otro ServiceAccount no autorizado recibe denegación.

# Fase 2. Implementar logs estructurados y correlación

## Paso 2.1. Estandarizar logs JSON

Cada microservicio debe emitir al menos:

```json
{
  "timestamp": "...",
  "service": "materiales",
  "level": "INFO",
  "correlationId": "...",
  "message": "material publicado"
}
```

No registre tokens ni secretos.

## Paso 2.2. Propagar `X-Correlation-ID`

API Gateway/servicios deben aceptar o generar un identificador y reenviarlo en llamadas síncronas. Inclúyalo también en metadatos de eventos cuando aplique.

## Paso 2.3. Habilitar/centralizar logs OCI

Cree un Log Group:

```text
ecored-logs
```

y habilite logs de servicios compatibles (por ejemplo API Gateway, Load Balancer y otros utilizados). Integre logs de aplicación mediante el mecanismo definido para OKE/Logging.

### Verificación

Puede buscar por `correlationId` y encontrar más de un componente.

# Fase 3. Métricas, trazas y alarmas

## Paso 3.1. Identificar métricas mínimas

```text
API Gateway: solicitudes, errores, latencia
Load Balancer: backends saludables/no saludables
OKE: CPU/memoria/estado de pods
OpenSearch: salud/capacidad
Aplicación: tasa de errores y latencia de endpoints clave
```

## Paso 3.2. Crear alarmas en OCI Monitoring

Cree al menos dos:

1. error rate superior a umbral definido;
2. backend/pod no saludable o métrica equivalente disponible.

## Paso 3.3. Crear Topic de Notifications

Cree un topic:

```text
ecored-alertas
```

y asocie un endpoint permitido por el laboratorio.

## Paso 3.4. Crear APM Domain e instrumentar una ruta crítica

Ruta propuesta:

```text
POST /materiales
→ API Gateway
→ materiales-service
→ Streaming
→ catalogo-service
```

Instrumente spans suficientes para observar la transacción.

### Verificación

Trace Explorer muestra la transacción y sus tiempos.

# Fase 4. Construir dashboard y realizar prueba de incidente

## Paso 4.1. Crear dashboard EcoRed

Incluya como mínimo:

```text
solicitudes API
errores
latencia
estado OKE
estado OpenSearch
alarmas activas
```

## Paso 4.2. Provocar fallo controlado

Ejemplo:

```bash
kubectl scale deployment catalogo --replicas=0 -n ecored
```

Publique un material.

## Paso 4.3. Diagnosticar sin entrar manualmente a cada pod

Utilice:

```text
Logging
Monitoring
APM
Alarmas
```

para localizar el punto de fallo.

## Paso 4.4. Restaurar servicio

```bash
kubectl scale deployment catalogo --replicas=1 -n ecored
```

Compruebe recuperación.

# Entregables

- [ ] ServiceAccounts por responsabilidad.
- [ ] Políticas IAM de mínimo privilegio.
- [ ] Al menos un acceso OCI mediante Workload Identity cuando sea compatible.
- [ ] Secretos críticos migrados a Secret Management.
- [ ] Logs estructurados.
- [ ] Correlation ID propagado.
- [ ] Log Group y consultas de búsqueda.
- [ ] Dos alarmas de Monitoring.
- [ ] Notifications configurado.
- [ ] APM/trace de una ruta crítica.
- [ ] Dashboard EcoRed.
- [ ] Informe de incidente controlado y diagnóstico.

# Contrato de entrada para el Taller 10

La arquitectura está funcional, securizada y observable. El último taller elimina el procedimiento manual de build/push/deploy e integra todo el recorrido de entrega.

# Referencias oficiales

- OKE Workload Identity: https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contenggrantingworkloadaccesstoresources.htm
- Secret Management: https://docs.oracle.com/en-us/iaas/Content/secret-management/overview.htm
- Managing secrets: https://docs.oracle.com/en-us/iaas/Content/secret-management/Concepts/manage-secrets.htm
- OCI Logging: https://docs.oracle.com/en-us/iaas/Content/Logging/Concepts/loggingoverview.htm
- OCI Monitoring: https://docs.oracle.com/en-us/iaas/Content/Monitoring/home.htm
- OCI Notifications: https://docs.oracle.com/en-us/iaas/Content/Notification/Concepts/notificationoverview.htm
- Application Performance Monitoring: https://docs.oracle.com/en-us/iaas/application-performance-monitoring/home.htm


---

[← Taller 8](08-Persistencia-Distribuida-y-Servicios-Administrados.md) | [Índice de la ruta](README.md) | [Taller 10 →](10-CICD-e-Integracion-Arquitectura-Destino.md)
