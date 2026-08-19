# Taller 2. Registro de contenedores y networking privado para EcoRed

[← Taller 1](01-De-Render-a-OCI-Container-Instances.md) | [Índice de la ruta](README.md) | [Taller 3 →](03-EcoRed-en-OKE-Kubernetes.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **OCIR — Oracle Cloud Infrastructure Registry / OCI Container Registry:** Registro de Contenedores de Oracle Cloud Infrastructure.
- **VCN — Virtual Cloud Network:** Red Virtual en la Nube.
- **CIDR — Classless Inter-Domain Routing:** Enrutamiento entre Dominios sin Clases.
- **NAT — Network Address Translation:** Traducción de Direcciones de Red.
- **NSG — Network Security Group:** Grupo de Seguridad de Red.
- **VNIC — Virtual Network Interface Card:** Tarjeta de Interfaz de Red Virtual.
- **CLI — Command-Line Interface:** Interfaz de Línea de Comandos.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **IGW — Internet Gateway:** Pasarela de Internet.
- **SGW — Service Gateway:** Pasarela de Servicios.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye la base de **registro de imágenes y networking privado** que alimentará la capa de plataforma de la arquitectura destino. La imagen de EcoRed queda administrada dentro de OCI y la VCN incorpora una zona privada para los workloads que posteriormente se ejecutarán en Kubernetes.

**Bloques de la arquitectura destino trabajados en este taller:**

- Registro de imágenes de contenedores
- Red privada para workloads
- NAT y acceso privado a servicios OCI
- Seguridad de red mediante NSG

**Proyecto:** EcoRed Circular  
**Nivel:** Ingeniería de Software / Cloud Computing

# 1. Propósito

Evolucionar el despliegue mínimo del Taller 1 hacia una base de infraestructura reutilizable por Kubernetes. Se realizan dos cambios controlados:

1. La imagen deja de depender de Docker Hub y se almacena en **OCIR**.
2. Se agrega una **subnet privada** para workloads posteriores, con salida controlada mediante **NAT Gateway** y acceso privado a servicios OCI mediante **Service Gateway**.

El Taller 1 ya dejó EcoRed ejecutándose en OCI Container Instances desde Docker Hub. La funcionalidad de EcoRed se conserva mientras el taller cambia el almacenamiento de la imagen y la estructura de red que soportará los siguientes despliegues.





# 2. Insumo obligatorio del Taller 1

Debe existir:

```text
ecored-dev
ecored-vcn                   10.20.0.0/16
ecored-public-subnet         10.20.10.0/24
ecored-igw
Default Route Table          0.0.0.0/0 → ecored-igw
Container Instance           ecored-ci
Imagen                       TU_USUARIO/ecored-circular:v1.0
```

Verifique además que `http://<PUBLIC_IP>:10000/api/health/` responda antes de continuar.

# 3. Objetivo

Al finalizar, el estudiante deberá demostrar:

```text
Docker local
   │
   │ docker tag / docker push
   ▼
OCIR
   │
   ▼
Imagen ecored/ecored-circular:v1.0

VCN ecored-vcn
├── subnet pública  → Internet Gateway
└── subnet privada  → NAT Gateway + Service Gateway
```

# 4. Conceptos nuevos

## 4.1. OCIR

Registro administrado por Oracle para almacenar, compartir y gestionar imágenes de contenedores. El registry **almacena el artefacto**; no ejecuta la aplicación.

## 4.2. Repository, image y tag

```text
Registry
└── Repository: ecored/ecored-circular
    ├── v1.0
    └── v1.1
```

El **tag** identifica una versión o variante de una imagen. No utilice `latest` como única referencia evaluable.

## 4.3. Subnet privada

Una subnet privada no permite asignar IPv4 públicas a las VNIC de sus recursos. Los workloads internos pueden salir a Internet a través de NAT sin quedar expuestos como destinos públicos.

## 4.4. NAT Gateway

Permite conexiones **iniciadas desde recursos privados** hacia Internet. No habilita conexiones iniciadas desde Internet hacia esos recursos.

## 4.5. Service Gateway

Permite acceso privado desde la VCN hacia servicios OCI compatibles mediante Oracle Services Network.

## 4.6. NSG

Firewall virtual asociado a recursos/VNIC específicos. En los talleres posteriores se utilizará para aplicar reglas por responsabilidad en lugar de abrir puertos globalmente.

# 5. Arquitectura al finalizar

```text
                                    OCI
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                        OCIR                ecored-vcn
                          │                10.20.0.0/16
                          │                     │
                          │        ┌────────────┴────────────┐
                          │        │                         │
                          │  subnet pública           subnet privada
                          │  10.20.10.0/24            10.20.20.0/24
                          │        │                         │
                          │       IGW                  NAT + SGW
                          │
                          └──── imagen EcoRed
```

# Fase 1. Publicar la imagen EcoRed en OCIR

## Paso 1.1. Identificar el namespace de la tenancy

1. En OCI Console abra su perfil.
2. Consulte **Tenancy details**.
3. Localice **Object Storage Namespace / Tenancy Namespace** según lo muestre la consola.
4. Registre:

```text
TENANCY_NAMESPACE=<namespace>
```

### Verificación

El valor registrado es el **namespace**, no el nombre visible de la tenancy.

## Paso 1.2. Identificar el endpoint regional de Container Registry

1. Abra **Developer Services → Containers & Artifacts → Container Registry**.
2. Mantenga la misma región utilizada en el Taller 1.
3. Consulte el endpoint indicado por OCI para esa región.
4. Registre:

```text
OCIR_ENDPOINT=<endpoint-regional>
```

### Verificación

El endpoint corresponde a la región seleccionada.

## Paso 1.3. Crear el repository privado

1. En **Container Registry**, seleccione **Create repository**.
2. Configure:

```text
Name: ecored/ecored-circular
Compartment: ecored-dev
Access: Private
```

3. Cree el repository.

### Verificación

Debe existir un repository privado llamado `ecored/ecored-circular`.

## Paso 1.4. Crear un Auth Token para Docker CLI

1. Abra su perfil de usuario en OCI.
2. Abra **Tokens and keys / Auth Tokens**.
3. Cree un token con descripción `Docker CLI EcoRed`.
4. Copie el token inmediatamente y guárdelo en un gestor seguro.
5. **No lo agregue al repositorio ni a capturas.**

### Verificación

Dispone del token fuera del proyecto y puede diferenciarlo de la contraseña de OCI Console.

## Paso 1.5. Autenticar Docker contra OCIR

En el equipo local ejecute:

```bash
docker login <OCIR_ENDPOINT>
```

Use como usuario la forma indicada por OCI para su tenancy/identity domain y como contraseña el Auth Token.

### Verificación

Docker debe informar `Login Succeeded`.

## Paso 1.6. Etiquetar la imagen sin reconstruirla

Compruebe la imagen actual:

```bash
docker images
```

Etiquete:

```bash
docker tag   TU_USUARIO/ecored-circular:v1.0   <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Compruebe:

```bash
docker images --digests
```

### Verificación

La referencia de Docker Hub y la de OCIR deben apuntar al mismo contenido/imagen local. **No se ejecutó `docker build`.**

## Paso 1.7. Publicar y validar en OCIR

Ejecute:

```bash
docker push   <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

En OCI Console abra el repository y compruebe el tag `v1.0`.

Como prueba adicional elimine únicamente la referencia local OCIR y vuelva a descargarla:

```bash
docker pull   <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

### Verificación

La imagen puede recuperarse desde OCIR.

# Fase 2. Ampliar la VCN con una subnet privada

## Paso 2.1. Crear el NAT Gateway

Dentro de `ecored-vcn`:

```text
Networking → Virtual Cloud Networks → ecored-vcn → NAT Gateways
```

Cree:

```text
Name: ecored-nat
Compartment: ecored-dev
```

### Verificación

`ecored-nat` aparece disponible.

## Paso 2.2. Crear el Service Gateway

Dentro de `ecored-vcn` cree:

```text
Name: ecored-sgw
Service: All <region> Services in Oracle Services Network
```

### Verificación

`ecored-sgw` aparece disponible y asociado a `ecored-vcn`.

## Paso 2.3. Crear la route table privada

Cree:

```text
Name: ecored-private-rt
Compartment: ecored-dev
```

Agregue:

```text
0.0.0.0/0 → NAT Gateway → ecored-nat
Oracle Services Network → Service Gateway → ecored-sgw
```

### Verificación

La tabla contiene las dos rutas y no usa Internet Gateway como salida de la subnet privada.

## Paso 2.4. Crear la subnet privada de workloads

Cree:

```text
Name: ecored-workloads-private
Subnet Type: Regional
CIDR: 10.20.20.0/24
Route Table: ecored-private-rt
Public IPv4 addresses on VNICs: Prohibited
```

### Verificación

La subnet aparece como privada y utiliza `ecored-private-rt`.

## Paso 2.5. Crear NSG base para workloads

Dentro de `ecored-vcn` cree:

```text
Name: ecored-workloads-nsg
```

No abra todavía puertos públicos. Mantenga reglas mínimas y documentadas.

### Verificación

El NSG existe y no contiene una regla de entrada indiscriminada hacia puertos de aplicación.

# Fase 3. Validar el nuevo artefacto y la topología

## Paso 3.1. Crear una Container Instance de validación desde OCIR

Para comprobar que OCIR puede ser el origen del artefacto, cree temporalmente una nueva Container Instance usando la **subnet pública existente** del Taller 1 y seleccione la imagen desde OCI Container Registry:

```text
Name: ecored-ci-ocir
VCN: ecored-vcn
Subnet: ecored-public-subnet
Image: <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Reutilice las variables de entorno del Taller 1.

### Verificación

`/api/health/` responde desde la nueva instancia.

## Paso 3.2. Confirmar que Docker Hub ya no es obligatorio

1. Detenga `ecored-ci` del Taller 1.
2. Mantenga activa `ecored-ci-ocir` durante la prueba.
3. Verifique nuevamente EcoRed.

### Verificación

El runtime consume la imagen almacenada en OCIR.

## Paso 3.3. Verificar con Network Visualizer

Abra **Networking → Network Visualizer** y compruebe:

```text
ecored-public-subnet → ecored-igw

ecored-workloads-private → ecored-nat
                           → ecored-sgw
```

Capture la topología.

# Fase 4. Preparar el contrato de entrada para OKE

## Paso 4.1. Registrar parámetros reutilizables

Actualice `oci-lab-params.example`:

```text
OCI_REGION=<region>
COMPARTMENT_OCID=<ocid>
VCN_OCID=<ocid>
PUBLIC_SUBNET_OCID=<ocid>
PRIVATE_WORKLOADS_SUBNET_OCID=<ocid>
WORKLOADS_NSG_OCID=<ocid>
OCIR_ENDPOINT=<endpoint>
TENANCY_NAMESPACE=<namespace>
OCIR_REPOSITORY=ecored/ecored-circular
IMAGE_TAG=v1.0
```

No incluya Auth Tokens.

## Paso 4.2. Revisar costos y detener recursos no usados

1. Detenga las Container Instances cuando termine la práctica.
2. Conserve VCN, gateways, route tables, subnets, NSG y repository OCIR.
3. Revise Cost Analysis si está disponible.

# Entregables

- [ ] Repository privado `ecored/ecored-circular` en OCIR.
- [ ] Tag `v1.0` visible en OCI.
- [ ] Evidencia de `docker login`, `tag`, `push` y `pull` sin mostrar el Auth Token.
- [ ] NAT Gateway `ecored-nat`.
- [ ] Service Gateway `ecored-sgw`.
- [ ] Route table `ecored-private-rt`.
- [ ] Subnet `ecored-workloads-private` — `10.20.20.0/24`.
- [ ] NSG `ecored-workloads-nsg`.
- [ ] EcoRed ejecutándose al menos una vez desde la imagen almacenada en OCIR.
- [ ] Network Visualizer con subnet pública y privada.
- [ ] `oci-lab-params.example` actualizado y sin secretos.

# Contrato de entrada para el Taller 3

El Taller 3 reutiliza:

```text
ecored-dev
ecored-vcn
ecored-public-subnet
ecored-workloads-private
ecored-nat
ecored-sgw
ecored-workloads-nsg
OCIR → ecored/ecored-circular:v1.0
```

# Referencias oficiales

- OCI Container Registry: https://docs.oracle.com/en-us/iaas/Content/Registry/Concepts/registryoverview.htm
- Container Registry concepts: https://docs.oracle.com/en-us/iaas/Content/Registry/Concepts/registryconcepts.htm
- Preparing for Container Registry: https://docs.oracle.com/en-us/iaas/Content/Registry/Concepts/registryprerequisites.htm
- NAT Gateway: https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/NATgateway.htm
- Service Gateway: https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/servicegateway.htm
- Network Security Groups: https://docs.oracle.com/en-us/iaas/Content/Network/Concepts/networksecuritygroups.htm


---

[← Taller 1](01-De-Render-a-OCI-Container-Instances.md) | [Índice de la ruta](README.md) | [Taller 3 →](03-EcoRed-en-OKE-Kubernetes.md)
