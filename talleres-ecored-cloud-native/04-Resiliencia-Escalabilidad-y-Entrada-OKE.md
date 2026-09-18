# Taller 4. Resiliencia, escalabilidad y entrada controlada de EcoRed

[← Taller 3](03-EcoRed-en-OKE-Kubernetes.md) | [Índice de la ruta](README.md) | [Taller 5 →](05-Descomposicion-EcoRed-en-Microservicios.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **OCIR — Oracle Cloud Infrastructure Registry / OCI Container Registry:** Registro de Contenedores de Oracle Cloud Infrastructure.
- **HPA — Horizontal Pod Autoscaler:** Autoescalador Horizontal de Pods.
- **CPU — Central Processing Unit:** Unidad Central de Procesamiento.
- **HTTP — Hypertext Transfer Protocol:** Protocolo de Transferencia de Hipertexto.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **IP — Internet Protocol:** Protocolo de Internet.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller fortalece la capacidad de **orquestación y disponibilidad** de la arquitectura destino. EcoRed pasa de un único Pod a un conjunto de réplicas administradas por Kubernetes, con health checks, escalamiento, actualización controlada y un punto de entrada balanceado.

**Bloques de la arquitectura destino trabajados en este taller:**

- Réplicas y self-healing
- Readiness y liveness
- Escalamiento
- Load Balancer
- Rolling update y rollback

**Proyecto:** EcoRed Circular  
**Punto de partida:** una réplica de EcoRed en OKE  
**Meta:** convertir el workload básico en un servicio tolerante a fallos, escalable y accesible mediante un punto de entrada de OCI.

# 1. Propósito

Experimentar por qué Kubernetes es un orquestador y no únicamente otro lugar donde ejecutar Docker. Se incorporan probes, varias réplicas, recursos, escalamiento, rolling updates y exposición mediante un Service `LoadBalancer`.





# 2. Objetivo

```text
Internet
   │
   ▼
OCI Load Balancer
   │
   ▼
Kubernetes Service
   │
   ├── Pod EcoRed 1
   ├── Pod EcoRed 2
   └── Pod EcoRed 3
```

# 3. Conceptos nuevos

- **readiness probe:** determina cuándo un pod puede recibir tráfico.
- **liveness probe:** ayuda a detectar un contenedor que debe reiniciarse.
- **requests/limits:** cantidad de CPU/memoria solicitada y límite permitido.
- **ReplicaSet:** mantiene el número de réplicas definido por el Deployment.
- **HPA:** ajusta réplicas según métricas compatibles.
- **rolling update:** reemplaza gradualmente pods de una versión por otra.
- **rollback:** vuelve a una revisión anterior del Deployment.
- **LoadBalancer Service:** solicita a OCI un balanceador para exponer un Service Kubernetes.

# Fase 1. Incorporar health checks y recursos

## Paso 1.1. Confirmar el endpoint de salud

Desde el `port-forward` del Taller 3 valide:

```text
/api/health/
```

Debe responder HTTP 200 antes de usarlo como probe.

## Paso 1.2. Agregar readiness y liveness probes

Edite `k8s/ecored-deployment.yaml` dentro del contenedor:

```yaml
readinessProbe:
  httpGet:
    path: /api/health/
    port: 10000
  initialDelaySeconds: 10
  periodSeconds: 10

livenessProbe:
  httpGet:
    path: /api/health/
    port: 10000
  initialDelaySeconds: 30
  periodSeconds: 20
```

Aplique:

```bash
kubectl apply -f k8s/ecored-deployment.yaml
```

### Verificación

```bash
kubectl describe pod -n ecored <POD>
```

Las probes aparecen configuradas y el pod llega a `Ready`.

## Paso 1.3. Definir requests y limits

Agregue:

```yaml
resources:
  requests:
    cpu: "100m"
    memory: "256Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

Ajuste si EcoRed requiere más memoria según observación real.

### Verificación

`kubectl describe pod` muestra los recursos.

# Fase 2. Escalar y comprobar self-healing

## Paso 2.1. Escalar a tres réplicas

```bash
kubectl scale deployment ecored --replicas=3 -n ecored
kubectl get pods -n ecored -o wide
```

### Verificación

Existen tres pods `Running/Ready`.

## Paso 2.2. Eliminar un pod

```bash
kubectl delete pod -n ecored <POD>
kubectl get pods -n ecored -w
```

### Verificación

El número de réplicas vuelve a tres.

## Paso 2.3. Probar indisponibilidad controlada de una instancia

Observe que el Service mantiene un endpoint estable aunque los pods cambien. No acceda directamente a las IP de los pods.

```bash
kubectl get endpoints -n ecored ecored-service
```

### Verificación

El Service referencia múltiples endpoints saludables.

# Fase 3. Exponer EcoRed mediante un Load Balancer OCI

## Paso 3.1. Cambiar el Service a `LoadBalancer`

Edite `k8s/ecored-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ecored-service
  namespace: ecored
spec:
  type: LoadBalancer
  selector:
    app: ecored
  ports:
    - port: 80
      targetPort: 10000
```

Aplique:

```bash
kubectl apply -f k8s/ecored-service.yaml
kubectl get svc -n ecored -w
```

### Verificación

OCI asigna una dirección externa cuando el balanceador está listo.

## Paso 3.2. Probar acceso público

```text
http://<EXTERNAL_IP>/api/health/
http://<EXTERNAL_IP>/
```

### Verificación

EcoRed responde a través del balanceador y no de una IP de pod.

## Paso 3.3. Verificar el recurso OCI creado

En OCI Console abra **Networking → Load Balancers** y localice el recurso creado por Kubernetes.

Registre:

```text
LOAD_BALANCER_IP=<ip>
```

# Fase 4. Actualizaciones y escalamiento

## Paso 4.1. Publicar una versión de prueba `v1.1`

Realice un cambio visual o de versión **que no altere el contrato de API**. Construya y publique:

```bash
docker build -t <OCIR>/ecored/ecored-circular:v1.1 .
docker push <OCIR>/ecored/ecored-circular:v1.1
```

## Paso 4.2. Ejecutar rolling update

```bash
kubectl set image deployment/ecored   ecored=<OCIR>/ecored/ecored-circular:v1.1   -n ecored

kubectl rollout status deployment/ecored -n ecored
kubectl rollout history deployment/ecored -n ecored
```

### Verificación

La aplicación permanece accesible durante la sustitución gradual.

## Paso 4.3. Ejecutar rollback

```bash
kubectl rollout undo deployment/ecored -n ecored
kubectl rollout status deployment/ecored -n ecored
```

### Verificación

La revisión anterior vuelve a ejecutarse.

## Paso 4.4. Configurar HPA si Metrics Server/telemetría requerida está disponible

Ejemplo:

```bash
kubectl autoscale deployment ecored   --cpu-percent=60   --min=2   --max=5   -n ecored

kubectl get hpa -n ecored
```

Si el cluster no dispone de métricas compatibles, documente el prerrequisito y no fuerce el paso.

# Entregables

- [ ] Readiness y liveness probes funcionales.
- [ ] Requests y limits definidos.
- [ ] Tres réplicas de EcoRed.
- [ ] Prueba de self-healing.
- [ ] Service tipo `LoadBalancer`.
- [ ] EcoRed accesible por IP del Load Balancer.
- [ ] Versión `v1.1` publicada en OCIR.
- [ ] Rolling update demostrado.
- [ ] Rollback demostrado.
- [ ] HPA configurado o prerrequisito documentado.

# Contrato de entrada para el Taller 5

El cluster OKE ya es la plataforma estable. El siguiente taller **no vuelve a estudiar Kubernetes básico**: utilizará OKE para ejecutar servicios independientes.

# Referencias oficiales

- OKE: https://docs.oracle.com/en-us/iaas/Content/ContEng/home.htm
- Kubernetes Service type LoadBalancer on OCI: https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengcreatingloadbalancer.htm
- OCI Load Balancer: https://docs.oracle.com/en-us/iaas/Content/Balance/home.htm
- Kubernetes concepts: https://kubernetes.io/docs/concepts/
- Horizontal Pod Autoscaling: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/


---

[← Taller 3](03-EcoRed-en-OKE-Kubernetes.md) | [Índice de la ruta](README.md) | [Taller 5 →](05-Descomposicion-EcoRed-en-Microservicios.md)
