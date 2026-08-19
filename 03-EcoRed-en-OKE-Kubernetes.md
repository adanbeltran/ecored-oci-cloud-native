# Taller 3. EcoRed en Oracle Kubernetes Engine: despliegue declarativo en Kubernetes

[← Taller 2](02-OCIR-y-Networking-Privado.md) | [Índice de la ruta](README.md) | [Taller 4 →](04-Resiliencia-Escalabilidad-y-Entrada-OKE.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **OCIR — Oracle Cloud Infrastructure Registry / OCI Container Registry:** Registro de Contenedores de Oracle Cloud Infrastructure.
- **VCN — Virtual Cloud Network:** Red Virtual en la Nube.
- **NAT — Network Address Translation:** Traducción de Direcciones de Red.
- **NSG — Network Security Group:** Grupo de Seguridad de Red.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **CIDR — Classless Inter-Domain Routing:** Enrutamiento entre Dominios sin Clases.
- **IAM — Identity and Access Management:** Gestión de Identidad y Acceso.
- **YAML — YAML Ain’t Markup Language:** YAML no es un Lenguaje de Marcado.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller materializa la capacidad **Contenedores / Kubernetes (orquestación)** de la arquitectura destino. EcoRed se despliega primero como una sola aplicación para aprender el modelo declarativo de Kubernetes antes de separar los dominios de negocio.

**Bloques de la arquitectura destino trabajados en este taller:**

- Cluster Kubernetes administrado
- Deployment y Pod
- Service y descubrimiento interno
- ConfigMap y Secret

**Proyecto:** EcoRed Circular  
**Cambio arquitectónico del taller:** Container Instance → **OKE**  

# 1. Propósito

Desplegar la misma imagen EcoRed almacenada en OCIR dentro de un cluster OKE y comprender el modelo declarativo de Kubernetes: cluster, node, namespace, pod, deployment, service, ConfigMap y Secret.





# 2. Insumo del Taller 2

```text
OCIR → ecored/ecored-circular:v1.0
VCN → ecored-vcn
Subnet privada → ecored-workloads-private
NAT Gateway → ecored-nat
Service Gateway → ecored-sgw
NSG → ecored-workloads-nsg
```

# 3. Objetivo

```text
OCIR
 │
 ▼
OKE Cluster
 │
 └── Namespace: ecored
      ├── Deployment
      │    └── Pod
      │         └── Container EcoRed
      ├── Service
      ├── ConfigMap
      └── Secret
```

# 4. Conceptos nuevos

- **OKE:** servicio administrado de Kubernetes en OCI.
- **Cluster:** conjunto de recursos Kubernetes administrados como una unidad.
- **Node:** capacidad de cómputo donde se ejecutan pods.
- **Pod:** unidad mínima de ejecución de Kubernetes; contiene uno o más contenedores.
- **Deployment:** declara el estado deseado de una aplicación y administra sus pods.
- **Service:** proporciona un endpoint estable para acceder a pods seleccionados por labels.
- **Namespace:** separación lógica de recursos dentro del cluster.
- **ConfigMap:** configuración no sensible.
- **Secret:** datos sensibles administrados por Kubernetes; en el Taller 9 se sustituirán los secretos más críticos por integración con servicios de secretos de OCI.

# Fase 1. Crear y acceder al cluster OKE

## Paso 1.1. Verificar prerrequisitos y cuotas

1. Mantenga seleccionada la misma región de los talleres anteriores.
2. Revise límites/cuotas de OKE y Compute.
3. Confirme que puede crear clusters dentro de `ecored-dev`.
4. Conserve la VCN del Taller 2.

### Verificación

La consola permite iniciar la creación de un cluster y hay capacidad disponible.

## Paso 1.2. Crear el cluster `ecored-oke`

Abra:

```text
Developer Services → Kubernetes Clusters (OKE) → Create Cluster
```

Seleccione un método que permita **usar una VCN existente**. Configure:

```text
Name: ecored-oke
Compartment: ecored-dev
VCN: ecored-vcn
Kubernetes version: una versión soportada actualmente por OKE
Worker nodes: managed nodes
```

Para el laboratorio, ubique los workers en una subnet privada compatible con el diseño. Si OCI requiere subnets adicionales específicas para endpoint/API o load balancers, créelas siguiendo el asistente y documente sus CIDR sin solaparlos.

### Verificación

El cluster llega a estado `Active`.

## Paso 1.3. Configurar acceso con `kubectl`

En el detalle del cluster seleccione **Access Cluster** y siga el comando generado por OCI para crear/actualizar el `kubeconfig`.

Compruebe:

```bash
kubectl cluster-info
kubectl get nodes
```

### Verificación

Los nodes aparecen `Ready`.

## Paso 1.4. Crear el namespace EcoRed

```bash
kubectl create namespace ecored
kubectl get namespaces
```

### Verificación

Existe `ecored`.

# Fase 2. Preparar configuración y acceso a la imagen

## Paso 2.1. Confirmar la imagen OCIR

Registre la referencia completa:

```text
<OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Compruebe en OCI Console que el tag existe.

## Paso 2.2. Crear credenciales de pull si son necesarias

Si el cluster no dispone de un mecanismo IAM configurado para leer el repository privado, cree un `imagePullSecret` de laboratorio:

```bash
kubectl create secret docker-registry ocir-secret   --docker-server=<OCIR_ENDPOINT>   --docker-username='<USUARIO_OCIR>'   --docker-password='<AUTH_TOKEN>'   --docker-email='<EMAIL>'   -n ecored
```

No versionar el token.

### Verificación

```bash
kubectl get secret ocir-secret -n ecored
```

## Paso 2.3. Crear ConfigMap para valores no sensibles

Cree `k8s/ecored-configmap.yaml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ecored-config
  namespace: ecored
data:
  PORT: "10000"
  DJANGO_DEBUG: "False"
```

Aplique:

```bash
kubectl apply -f k8s/ecored-configmap.yaml
```

## Paso 2.4. Crear Secret de transición para la aplicación

Cree el secreto desde terminal sin escribir valores sensibles en YAML versionado:

```bash
kubectl create secret generic ecored-secrets   --from-literal=DJANGO_SECRET_KEY='<VALOR>'   --from-literal=MONGODB_URI='<VALOR>'   --from-literal=MONGODB_DB_NAME='<VALOR>'   --from-literal=FIREBASE_SERVICE_ACCOUNT_JSON='<JSON_COMPACTO>'   -n ecored
```

### Verificación

```bash
kubectl get secret ecored-secrets -n ecored
```

# Fase 3. Desplegar EcoRed declarativamente

## Paso 3.1. Crear `Deployment`

Cree `k8s/ecored-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecored
  namespace: ecored
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ecored
  template:
    metadata:
      labels:
        app: ecored
    spec:
      imagePullSecrets:
        - name: ocir-secret
      containers:
        - name: ecored
          image: <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
          ports:
            - containerPort: 10000
          envFrom:
            - configMapRef:
                name: ecored-config
            - secretRef:
                name: ecored-secrets
```

Si la imagen todavía requiere crear el archivo Firebase durante el arranque, conserve temporalmente el mismo mecanismo de startup validado en el Taller 1 o publique una versión `v1.1-oke` que lo haga de forma portable.

Aplique:

```bash
kubectl apply -f k8s/ecored-deployment.yaml
```

## Paso 3.2. Verificar el Pod

```bash
kubectl get deployments -n ecored
kubectl get pods -n ecored -o wide
kubectl describe pod -n ecored <POD>
```

### Verificación

El pod aparece `Running` y `Ready`.

## Paso 3.3. Consultar logs

```bash
kubectl logs -n ecored deployment/ecored
```

Corrija primero errores de `ImagePullBackOff`, `CrashLoopBackOff` o configuración antes de exponer la aplicación.

## Paso 3.4. Crear un Service interno

Cree `k8s/ecored-service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ecored-service
  namespace: ecored
spec:
  type: ClusterIP
  selector:
    app: ecored
  ports:
    - port: 80
      targetPort: 10000
```

Aplique:

```bash
kubectl apply -f k8s/ecored-service.yaml
kubectl get svc -n ecored
```

### Verificación

`ecored-service` existe con un `ClusterIP`.

# Fase 4. Probar el modelo declarativo y preparar resiliencia

## Paso 4.1. Probar mediante port-forward

```bash
kubectl port-forward -n ecored service/ecored-service 8080:80
```

Abra:

```text
http://localhost:8080
http://localhost:8080/api/health/
```

### Verificación

EcoRed funciona desde OKE sin requerir exposición pública permanente todavía.

## Paso 4.2. Eliminar el Pod y observar reconciliación

```bash
kubectl get pods -n ecored
kubectl delete pod -n ecored <POD>
kubectl get pods -n ecored -w
```

### Verificación

El Deployment crea un nuevo pod automáticamente.

## Paso 4.3. Versionar únicamente manifiestos sin secretos

La estructura esperada será:

```text
ecored-circular/
└── k8s/
    ├── ecored-configmap.yaml
    ├── ecored-deployment.yaml
    └── ecored-service.yaml
```

No agregue archivos que contengan valores reales de secretos.

# Entregables

- [ ] Cluster `ecored-oke` activo.
- [ ] `kubectl get nodes` con nodes `Ready`.
- [ ] Namespace `ecored`.
- [ ] Imagen de OCIR utilizada por el Deployment.
- [ ] `ConfigMap` y `Secret` creados.
- [ ] Deployment `ecored` con 1 réplica.
- [ ] Pod `Running`.
- [ ] Service `ecored-service` tipo `ClusterIP`.
- [ ] Prueba `port-forward` y `/api/health/`.
- [ ] Evidencia de recreación automática de un pod eliminado.
- [ ] Manifiestos Kubernetes versionados sin secretos.

# Contrato de entrada para el Taller 4

El siguiente taller reutiliza el cluster, namespace, imagen, Deployment y Service creados aquí.

# Referencias oficiales

- OKE overview: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengoverview.htm
- OKE concepts: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengclustersnodes.htm
- Preparing for OKE: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengprerequisites.htm
- Pulling images from OCIR: https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengpullingimagesfromocir.htm
- Supported Kubernetes versions: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengaboutk8sversions.htm


---

[← Taller 2](02-OCIR-y-Networking-Privado.md) | [Índice de la ruta](README.md) | [Taller 4 →](04-Resiliencia-Escalabilidad-y-Entrada-OKE.md)
