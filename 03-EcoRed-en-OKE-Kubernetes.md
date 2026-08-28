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

<img width="1024" height="559" alt="MapaConceptual" src="https://github.com/user-attachments/assets/bacd6bf6-2c6a-4dc2-953c-547ac55f9109" />

<img width="1024" height="559" alt="FlujoConceptual" src="https://github.com/user-attachments/assets/d328d5a1-9a05-4e61-be27-b2bf8df3f455" />

<img width="1024" height="559" alt="FlujoSimplificadoKubernet" src="https://github.com/user-attachments/assets/e5b16a3f-3c32-4f1e-8a8b-1eb5c6901d18" />

<img width="1024" height="559" alt="FlujoDespliegur" src="https://github.com/user-attachments/assets/f5204d6e-8e70-4eea-a4dd-52c268c65c72" />

<img width="1024" height="559" alt="DiagramaResilencia" src="https://github.com/user-attachments/assets/4ffc53ed-4a9d-48ee-8b94-161ee6eca57b" />






# Fase 1. Crear y acceder al cluster OKE

## Paso 1.1. Verificar prerrequisitos y cuotas

1. Verifique que OCI Console muestra la región **Brazil East (São Paulo)** (`sa-saopaulo-1`, código regional `GRU`).
2. Abra **Developer Services → Containers & Artifacts → Kubernetes Clusters (OKE)**.
3. Seleccione el compartimento `ecored-dev`.
4. Revise límites/cuotas de OKE y Compute.
5. Confirme que puede crear clusters dentro de `ecored-dev`.
6. Conserve la VCN `ecored-vcn` y los recursos de networking privado ya preparados.

![Listado de Kubernetes Clusters en el compartimento ecored-dev](assets/taller-3/01-listado-clusters-oke.png)

### Verificación

La consola permite iniciar la creación de un cluster y hay capacidad disponible.

## Paso 1.2. Preparar los NSG para OKE

Antes de abrir el asistente de creación del cluster, configure los NSG del endpoint de Kubernetes y de los workers. De esta manera, ambos recursos estarán disponibles cuando OCI solicite asociarlos y no será necesario interrumpir el asistente.

En OCI Console abra:

```text
Networking
→ Virtual Cloud Networks
→ ecored-vcn
→ Security
→ Network Security Groups
→ Create Network Security Group
```

![Ubicación de Network Security Groups dentro de la VCN](assets/taller-3/10-navegar-security-nsg.png)

Configure:

```text
Name: ecored-oke-api-nsg
Compartment: ecored-dev
Tags: ninguna
Security Rules: ninguna inicialmente
```

Si OCI presenta un bloque de regla vacío, elimínelo mediante la `X`. No cree una regla con origen indiscriminado `0.0.0.0/0`.

![Creación del NSG del endpoint sin reglas iniciales](assets/taller-3/11-crear-nsg-api-sin-reglas.png)

Cree el NSG. Después se agregarán reglas explícitas para el puerto `6443`, la comunicación del plano de control y los workers.

![NSG del endpoint disponible y sin reglas](assets/taller-3/12-nsg-api-available-sin-reglas.png)

### Reglas de entrada del NSG del endpoint

En la pestaña **Security Rules**, seleccione **Add Rules**. Mantenga las reglas como **stateful** y agregue inicialmente solo los flujos internos indicados. El acceso administrativo desde OCI Cloud Shell se autorizará con una regla `/32` después de crear el cluster y abrir la sesión; así se utilizará la dirección pública real de esa sesión.

| Dirección | Origen | Protocolo | Puerto destino | Descripción |
|---|---|---|---:|---|
| Ingress | `10.20.20.0/24` | TCP | `6443` | Workers hacia Kubernetes API |
| Ingress | `10.20.20.0/24` | TCP | `12250` | Workers hacia el plano de control |
| Ingress | `10.20.20.0/24` | ICMP tipo 3, código 4 | — | Path Discovery desde workers |

Agregue también las reglas de salida requeridas por el endpoint:

| Dirección | Destino | Protocolo | Puerto destino | Descripción |
|---|---|---|---:|---|
| Egress | `10.20.20.0/24` | TCP | Todos | Plano de control hacia workers |
| Egress | `10.20.20.0/24` | ICMP tipo 3, código 4 | — | Path Discovery hacia workers |
| Egress | **All GRU Services in Oracle Services Network** | TCP | Todos | Endpoint hacia servicios OKE |
| Egress | **All GRU Services in Oracle Services Network** | ICMP tipo 3, código 4 | — | Path Discovery hacia servicios OCI |

### Reglas del NSG de los workers

Abra `ecored-workloads-nsg` y agregue reglas stateful para la comunicación interna, el plano de control, OKE y la salida por NAT. Las referencias entre NSG restringen los flujos a los recursos asociados, en lugar de autorizar toda la subnet.

| Dirección | Origen o destino | Protocolo | Puerto destino | Descripción |
|---|---|---|---:|---|
| Ingress | NSG `ecored-workloads-nsg` | Todos | Todos | Comunicación interna entre workers y Pods |
| Ingress | NSG `ecored-oke-api-nsg` | TCP | Todos | Plano de control hacia workers |
| Ingress | `0.0.0.0/0` | ICMP tipo 3, código 4 | — | Path Discovery hacia workers |
| Egress | NSG `ecored-workloads-nsg` | Todos | Todos | Comunicación interna entre workers y Pods |
| Egress | NSG `ecored-oke-api-nsg` | TCP | `6443` | Workers hacia Kubernetes API |
| Egress | NSG `ecored-oke-api-nsg` | TCP | `12250` | Workers hacia el plano de control |
| Egress | **All GRU Services in Oracle Services Network** | TCP | Todos | Workers hacia servicios OKE |
| Egress | `0.0.0.0/0` | TCP | Todos | Salida a Internet mediante NAT |
| Egress | `0.0.0.0/0` | ICMP tipo 3, código 4 | — | Path Discovery hacia Internet |

![Reglas completas del NSG de los workers](assets/taller-3/16-reglas-workloads-completas.png)

### Verificación de reglas

Compruebe que ambos NSG estén en estado `Available`, que sus reglas permanezcan **stateful** y que se hayan registrado:

- siete reglas iniciales en `ecored-oke-api-nsg`;
- nueve reglas en `ecored-workloads-nsg`.

La octava regla del NSG del endpoint se agregará en el **Paso 1.4**, después de conocer la IPv4 pública de OCI Cloud Shell.

Con los dos NSG preparados, continúe con la creación de OKE.

## Paso 1.3. Crear el cluster `ecored-oke`

Abra:

```text
Developer Services → Kubernetes Clusters (OKE) → Create Cluster
```

1. Seleccione **Create cluster**.
2. Elija **Custom create** y continúe con **Proceed**. Este flujo permite reutilizar la VCN, las subnets y los gateways existentes. No utilice **Quick create**, porque generaría una VCN y recursos de red adicionales que duplicarían la infraestructura del laboratorio.

![Selección del flujo Custom create para reutilizar la red existente](assets/taller-3/02-seleccionar-custom-create.png)

Configure:

```text
Name: ecored-oke
Compartment: ecored-dev
VCN: ecored-vcn
Kubernetes version: versión estable más reciente disponible
Worker nodes: managed nodes
```

En la ejecución documentada se seleccionó `v1.36`. Como las versiones compatibles cambian con el tiempo, utilice la versión estable más reciente que ofrezca la consola y verifique la [matriz oficial de versiones compatibles](https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengaboutk8sversions.htm). Mantenga **Show patch versions** desactivado y no modifique **Advanced options**.

![Información básica del cluster ecored-oke](assets/taller-3/03-datos-basicos-cluster-oke.png)

### Configuración de red

Seleccione **Flannel overlay** como tipo de red de Pods. Esta opción permite utilizar la subnet privada existente para los workers y mantiene las direcciones de los Pods en un bloque lógico independiente de la VCN.

Configure el endpoint de la API de Kubernetes:

```text
VCN compartment: ecored-dev
VCN: ecored-vcn
Kubernetes API endpoint subnet compartment: ecored-dev
Kubernetes API endpoint subnet: ecored-public-subnet (Regional) - IPv4
Use security rules in Network Security Group (NSG): Enabled
NSG compartment: ecored-dev
NSG: ecored-oke-api-nsg
Automatically assign public IPv4 address: Enabled
Automatically assign IPv6 address: Disabled
Load balancer subnets: Disabled
```

![Selección de Flannel, la VCN, la subnet pública y el NSG del endpoint](assets/taller-3/04-red-endpoint-api.png)

El endpoint público se utiliza en este taller para administrar el cluster con `kubectl` desde OCI Cloud Shell. La regla `/32` que se agregará en el Paso 1.4 restringirá ese acceso a la dirección IPv4 pública de la sesión activa de Cloud Shell.

![Asignación de IPv4 pública, IPv6 desactivado y sin subnet para Load Balancer](assets/taller-3/04b-direccionamiento-endpoint-api.png)

En **Advanced options**, conserve los siguientes bloques, que no se solapan con la VCN `10.20.0.0/16`:

```text
Kubernetes service CIDR block: 10.96.0.0/16
Pods CIDR block: 10.244.0.0/16
```

![Bloques CIDR para Services y Pods con Flannel](assets/taller-3/05-cidr-servicios-pods.png)

No seleccione subnets para Load Balancers. En este taller la aplicación se validará mediante un Service `ClusterIP`, `kubectl port-forward` y `curl` ejecutados en la misma sesión de Cloud Shell; la exposición mediante Load Balancer se realizará posteriormente.

### Compatibilidad de arquitectura de la imagen

Antes de elegir la forma de los workers, confirme la arquitectura de la imagen publicada en OCIR:

```powershell
docker image inspect <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0 --format '{{.Architecture}}/{{.Os}}'
```

Resultado esperado:

```text
amd64/linux
```

Por esta razón, seleccione una forma AMD/x86. No utilice una forma ARM, como `VM.Standard.A1.Flex`, porque una imagen `amd64` no puede ejecutarse directamente en un worker `arm64`.

### Configuración del node pool

Configure:

```text
Node pool name: ecored-pool
Compartment: ecored-dev
Kubernetes version: v1.36 (current cluster version)
Show patch versions: Disabled
```

![Datos generales del node pool ecored-pool](assets/taller-3/06-datos-node-pool.png)

En **Node placement configuration**:

```text
Availability domain: PmCo:SA-SAOPAULO-1-AD-1
Worker node subnet compartment: ecored-dev
Worker node subnet: ecored-workloads-private (Regional) - IPv4
Fault domains: sin selección
Capacity type: valor predeterminado, On-demand
```

No agregue otra fila. Al dejar **Fault domains** sin selección, OCI decide la distribución entre los dominios de fallo disponibles. Mantenga **Network Launch Type** con su valor predeterminado `PARAVIRTUALIZED` y **Configure Primary VNIC for nodes** desactivado.

![Ubicación del worker en la subnet privada regional](assets/taller-3/07-ubicacion-nodo-subnet-privada.png)

![Tipo de lanzamiento paravirtualizado y VNIC primaria sin configuración adicional](assets/taller-3/07b-network-launch-vnic.png)

En **Shape and image** seleccione:

```text
Node shape: VM.Standard.E4.Flex
OCPUs: 1
Memory: 16 GB
Operating system: Oracle Linux 8
Image: imagen OKE compatible con la versión del cluster
```

![Forma AMD64 asignada al worker](assets/taller-3/08-shape-amd64.png)

Finalmente configure:

```text
Node count: 1
Use security rules in Network Security Group (NSG): Enabled
NSG compartment: ecored-dev
NSG: ecored-workloads-nsg
```

![Imagen del worker, cantidad de nodos y NSG de workloads](assets/taller-3/09-imagen-node-count-nsg.png)

> **Advertencia:** un único worker reduce costos y es suficiente para el laboratorio, pero no proporciona alta disponibilidad. Las reglas para futuros Load Balancers se agregarán en el taller donde se exponga la aplicación.

### Revisar y crear el cluster

En **Review and create**, revise primero que la red, los bloques CIDR, el node pool y los NSG correspondan con la configuración del taller:

```text
Cluster: ecored-oke
VCN: ecored-vcn
Kubernetes API endpoint subnet: ecored-public-subnet
Kubernetes API endpoint NSG: ecored-oke-api-nsg
Worker node subnet: ecored-workloads-private
Worker NSG: ecored-workloads-nsg
Node pool: ecored-pool
Node count: 1
```

![Revisión de la red y del direccionamiento del cluster](assets/taller-3/09a-review-red-cluster.png)

Seleccione **Create cluster**. La consola mostrará entonces la ventana **Basic Cluster Confirmation**; esta opción no aparece como parte del resumen anterior. Marque expresamente **Create a Basic cluster** y seleccione **Continue**.

![Confirmación para crear el cluster como Basic](assets/taller-3/09b-confirmar-cluster-basic.png)

> **Advertencia:** si selecciona **Continue** sin marcar **Create a Basic cluster**, OCI creará un cluster **Enhanced**, que incorpora características adicionales y un cargo por hora para el plano de control. La opción Basic solo se presenta cuando no se han seleccionado funciones exclusivas de Enhanced, como virtual nodes o configuraciones personalizadas de add-ons. Consulte [Creating a Basic Cluster](https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengcreatingbasicclusters.htm).

Espere hasta que el estado cambie a `Active` y verifique en los detalles del recurso que `Cluster type` sea `Basic`.

### Verificación del cluster

El cluster `ecored-oke` aparece en estado `Active`, muestra `Cluster type: Basic`, utiliza `FLANNEL_OVERLAY` y conserva los bloques `10.244.0.0/16` para Pods y `10.96.0.0/16` para Services. El node pool `ecored-pool` contiene un worker.

![Cluster Basic activo y configuración de red verificada](assets/taller-3/17-cluster-basic-active-redactado.png)

### Verificación del node pool

Abra la pestaña **Node pools** y confirme que `ecored-pool` se encuentre en estado `Active` y que su versión de Kubernetes aparezca actualizada.

![Node pool ecored-pool activo](assets/taller-3/18-node-pool-active.png)

Abra `ecored-pool` y compruebe los siguientes valores:

```text
Node type: Managed
Network security group: ecored-workloads-nsg
OCPUs: 1
Memory: 16 GB
Shape: VM.Standard.E4.Flex
Total worker nodes: 1
Network type: FLANNEL_OVERLAY
Availability domain: PmCo:SA-SAOPAULO-1-AD-1
Worker node subnet: ecored-workloads-private
Capacity type: On-demand capacity
```

![Detalles verificados del node pool ecored-pool](assets/taller-3/19-node-pool-details-redactado.png)

> **Nota:** el aviso sobre el acceso a nodos privados es esperado. Los workers no poseen dirección IP pública y no se necesita acceso SSH para desplegar la aplicación con Kubernetes.

## Paso 1.4. Configurar acceso con `kubectl`

Este taller utiliza **OCI Cloud Shell**, que se abre en el navegador e incluye OCI CLI y `kubectl`. Los estudiantes no necesitan instalar software en sus equipos.

1. En el detalle del cluster `ecored-oke`, abra **Actions → Access cluster**.
2. Seleccione **Cloud Shell Access** y pulse **Launch cloud shell**.

![Acceso al cluster mediante OCI Cloud Shell con el OCID protegido](assets/taller-3/20-acceso-cloud-shell-redactado.png)

En la terminal de Cloud Shell consulte la dirección IPv4 pública de la sesión:

```bash
curl -s https://api.ipify.org; echo
```

Regrese temporalmente a `ecored-vcn → Security → Network Security Groups → ecored-oke-api-nsg → Security rules` y agregue una regla **stateful** con estos valores:

| Campo | Valor |
|---|---|
| Dirección | Ingress |
| Source Type | CIDR |
| Source CIDR | `<IP_CLOUD_SHELL>/32` |
| IP Protocol | TCP |
| Destination Port Range | `6443` |
| Descripción | `kubectl desde OCI Cloud Shell` |

![Regla restringida para kubectl desde OCI Cloud Shell](assets/taller-3/21-regla-cloud-shell-redactada.png)

> **Advertencia de seguridad:** no sustituya `/32` por `0.0.0.0/0`. La dirección pública de Cloud Shell puede cambiar al iniciar otra sesión; si eso ocurre, consulte la nueva dirección y actualice esta regla. Después de agregarla, `ecored-oke-api-nsg` debe contener ocho reglas.

Vuelva a **Access cluster** y pulse **Copy** junto al comando generado por OCI. Péguelo completo en Cloud Shell y ejecútelo para crear o actualizar `$HOME/.kube/config`.

> **Advertencia:** no escriba `...` ni recorte el OCID. Los puntos suspensivos usados en explicaciones no son argumentos válidos; debe copiar el comando completo generado para su cluster, incluidos `--cluster-id`, `--file`, `--region`, `--token-version` y `--kube-endpoint PUBLIC_ENDPOINT`.

El resultado esperado incluye un mensaje similar a:

```text
New config written to the Kubeconfig file /home/<usuario>/.kube/config
```

Compruebe la conexión:

```bash
kubectl cluster-info
kubectl get nodes
```

![Worker del cluster en estado Ready](assets/taller-3/22-kubectl-node-ready-redactado.png)

### Verificación

El worker `10.20.20.115` aparece en estado `Ready` y con la versión `v1.36.1`.

## Paso 1.5. Crear el namespace EcoRed

```bash
kubectl create namespace ecored
kubectl get namespace ecored
```

![Namespace ecored creado y en estado Active](assets/taller-3/23-namespace-ecored-active-redactado.png)

### Verificación

El namespace `ecored` existe y aparece en estado `Active`.

# Fase 2. Preparar configuración y acceso a la imagen

## Paso 2.1. Confirmar la imagen OCIR

Registre la referencia completa:

```text
gru.ocir.io/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Compruebe en OCI Console que el tag `v1.0` existe en **Developer Services → Container Registry → ecored/ecored-circular → Image versions**.

![Imagen ecored-circular v1.0 disponible en OCIR con los identificadores protegidos](assets/taller-3/24-ocir-imagen-v1-redactada.png)

## Paso 2.2. Crear credenciales de pull si son necesarias

Como el repository de este taller es privado, Kubernetes necesita credenciales válidas para descargar la imagen. El nombre de usuario de OCIR tiene esta forma:

```text
<TENANCY_NAMESPACE>/<USUARIO_OCI>
```

Utilice el mismo usuario que funcionó en `docker login`. La contraseña debe ser un **Auth Token de OCI vigente**; no utilice la contraseña de la cuenta, una API key ni un token que haya sido eliminado.

Registre ambas variables en Cloud Shell. La opción `-s` impide que el token se muestre en la terminal:

```bash
read -r -p "Usuario utilizado en docker login: " OCIR_USERNAME
read -r -s -p "Auth Token vigente de OCIR: " OCIR_AUTH_TOKEN; echo
```

Antes de crear el Secret, valide las credenciales contra el manifiesto de la imagen privada:

```bash
curl -sS -o /dev/null \
  -w 'Respuesta de OCIR: HTTP %{http_code}\n' \
  -u "$OCIR_USERNAME:$OCIR_AUTH_TOKEN" \
  -H 'Accept: application/vnd.oci.image.manifest.v1+json' \
  "https://gru.ocir.io/v2/<TENANCY_NAMESPACE>/ecored/ecored-circular/manifests/v1.0"
```

El resultado requerido es:

```text
Respuesta de OCIR: HTTP 200
```

Si obtiene `HTTP 401`, no continúe: el usuario o el Auth Token no son válidos. Genere un nuevo **Auth Token** en **Profile → Tokens and keys → Auth tokens**, cópielo completo y repita la validación.

Después de obtener `HTTP 200`, cree o actualice el `imagePullSecret`:

```bash
kubectl create secret docker-registry ocir-secret \
  --docker-server=gru.ocir.io \
  --docker-username="$OCIR_USERNAME" \
  --docker-password="$OCIR_AUTH_TOKEN" \
  --namespace=ecored \
  --dry-run=client -o yaml | kubectl apply -f -

unset OCIR_USERNAME OCIR_AUTH_TOKEN
```

El uso de `--dry-run=client -o yaml | kubectl apply -f -` permite ejecutar el mismo procedimiento tanto para crear el Secret por primera vez como para actualizarlo si el Auth Token cambia.

> **Advertencia:** el Auth Token debe permanecer vigente mientras el cluster necesite descargar imágenes privadas. Si se elimina o revoca, actualice `ocir-secret` con un nuevo token y reinicie el Deployment. No escriba el token directamente en archivos YAML, no lo incluya en pantallazos y no lo versione.

### Verificación

```bash
kubectl get secret ocir-secret -n ecored
```

El Secret debe existir con tipo `kubernetes.io/dockerconfigjson`.

## Paso 2.3. Crear ConfigMap para valores no sensibles

En Cloud Shell cree el directorio de manifiestos:

```bash
mkdir -p "$HOME/k8s"
```

Cree `$HOME/k8s/ecored-configmap.yaml`:

```bash
cat > "$HOME/k8s/ecored-configmap.yaml" <<'EOF'
apiVersion: v1
kind: ConfigMap
metadata:
  name: ecored-config
  namespace: ecored
data:
  PORT: "10000"
  DJANGO_DEBUG: "False"
EOF
```

Aplique y verifique:

```bash
kubectl apply -f "$HOME/k8s/ecored-configmap.yaml"
kubectl get configmap ecored-config -n ecored
```

## Paso 2.4. Crear los Secrets de la aplicación

EcoRed utiliza dos fuentes sensibles diferentes:

- las variables del backend almacenadas en el archivo local `.env`;
- el archivo JSON de la cuenta de servicio de Firebase.

No copie sus valores en el taller ni los escriba en un manifiesto versionado. En el menú de OCI Cloud Shell seleccione **Upload** y cargue temporalmente los dos archivos en el directorio personal de la sesión:

```text
.env
firebase-service-account.json
```

Compruebe que ambos archivos existen sin imprimir sus contenidos:

```bash
test -f "$HOME/.env" && echo "Archivo .env cargado correctamente"
test -f "$HOME/firebase-service-account.json" && echo "Archivo Firebase cargado correctamente"
```

Para verificar únicamente los nombres de las variables del `.env`, sin revelar valores, ejecute:

```bash
awk -F= '/^[A-Za-z_][A-Za-z0-9_]*=/{print $1}' "$HOME/.env"
```

Cree o actualice el Secret de variables del backend:

```bash
kubectl create secret generic ecored-secrets \
  --from-env-file="$HOME/.env" \
  --namespace=ecored \
  --dry-run=client -o yaml | kubectl apply -f -
```

Cree o actualice un Secret independiente para conservar el nombre de archivo esperado por la aplicación:

```bash
kubectl create secret generic firebase-credentials \
  --from-file=firebase-service-account.json="$HOME/firebase-service-account.json" \
  --namespace=ecored \
  --dry-run=client -o yaml | kubectl apply -f -
```

Elimine de Cloud Shell los archivos temporales después de crear los Secrets:

```bash
rm -f "$HOME/.env" "$HOME/firebase-service-account.json"
```

### Verificación

```bash
kubectl get secrets ecored-secrets firebase-credentials -n ecored
```

Los dos recursos deben aparecer con tipo `Opaque`. No utilice `kubectl get secret ... -o yaml`, porque esa salida expone datos codificados que no deben formar parte de las evidencias.

# Fase 3. Desplegar EcoRed declarativamente

## Paso 3.1. Crear `Deployment`

Cree `$HOME/k8s/ecored-deployment.yaml`. Sustituya `<TENANCY_NAMESPACE>` por el namespace de Object Storage utilizado en OCIR:

```bash
cat > "$HOME/k8s/ecored-deployment.yaml" <<'EOF'
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
          image: gru.ocir.io/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
          imagePullPolicy: IfNotPresent
          ports:
            - name: http
              containerPort: 10000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: ecored-config
            - secretRef:
                name: ecored-secrets
          env:
            - name: FIREBASE_CREDENTIALS_PATH
              value: /run/secrets/firebase/firebase-service-account.json
          volumeMounts:
            - name: firebase-credentials
              mountPath: /run/secrets/firebase
              readOnly: true
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 1Gi
      volumes:
        - name: firebase-credentials
          secret:
            secretName: firebase-credentials
EOF
```

Valide primero la sintaxis local del manifiesto:

```bash
kubectl apply --dry-run=client -f "$HOME/k8s/ecored-deployment.yaml"
```

Si la validación no muestra errores, aplique el Deployment:

```bash
kubectl apply -f "$HOME/k8s/ecored-deployment.yaml"
```

> **Advertencia:** si el Pod queda en `ImagePullBackOff`, no publique esa salida como evidencia. Confirme que la referencia de la imagen coincide exactamente con OCIR y vuelva a ejecutar la validación `curl` del Paso 2.2. Un `HTTP 401` indica que debe renovar y actualizar `ocir-secret`; después ejecute `kubectl rollout restart deployment/ecored -n ecored`.

## Paso 3.2. Verificar el Pod

Observe la creación del Pod:

```bash
kubectl get pods -n ecored -w
```

Espere hasta obtener `1/1` en la columna `READY` y `Running` en `STATUS`. Presione `Ctrl+C` para salir del seguimiento y consulte el estado completo:

```bash
kubectl get deployments -n ecored
kubectl get pods -n ecored -o wide
```

Si el Pod no llega a `Running`, identifique la causa sin exponer valores de Secrets:

```bash
kubectl describe pod -n ecored <POD>
```

### Verificación

El Deployment muestra una réplica disponible y el Pod aparece `1/1 Running`.

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

Ejecute la redirección en segundo plano dentro de Cloud Shell, consulte el endpoint de salud desde la misma sesión y cierre el proceso al terminar:

```bash
kubectl port-forward -n ecored service/ecored-service 8080:80 >/tmp/ecored-port-forward.log 2>&1 &
PORT_FORWARD_PID=$!
sleep 3
curl -fsS http://127.0.0.1:8080/api/health/
kill "$PORT_FORWARD_PID"
```

### Verificación

El endpoint `/api/health/` responde correctamente desde OKE sin exposición pública permanente. El `127.0.0.1` de Cloud Shell pertenece a esa sesión remota y no al navegador del estudiante; por eso la comprobación se realiza con `curl` en la misma terminal. La publicación mediante Load Balancer se realizará en el Taller 4.

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
- [ ] Prueba con `curl` de `/api/health/` mediante `port-forward` en Cloud Shell.
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
- Setting up OKE cluster access: https://docs.oracle.com/en-us/iaas/Content/ContEng/Tasks/contengdownloadkubeconfigfile.htm
- OCI Cloud Shell networking: https://docs.oracle.com/en-us/iaas/Content/API/Concepts/cloudshellintro_topic-Cloud_Shell_Networking.htm


---

[← Taller 2](02-OCIR-y-Networking-Privado.md) | [Índice de la ruta](README.md) | [Taller 4 →](04-Resiliencia-Escalabilidad-y-Entrada-OKE.md)
