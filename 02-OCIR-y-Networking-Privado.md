# Taller 2. Preparar EcoRed para Kubernetes: OCIR y networking privado

[← Taller 1](./01-De-Render-a-OCI-Container-Instances.md) | [Índice de la ruta](./README.md) | [Taller 3 →](./03-EcoRed-en-OKE-Kubernetes.md)

## Agenda

1. [Fase 1. Publicar la misma imagen EcoRed en OCIR](#fase-1-publicar-la-misma-imagen-ecored-en-ocir)
2. [Fase 2. Ampliar la VCN con networking privado](#fase-2-ampliar-la-vcn-con-networking-privado)
3. [Fase 3. Experimentar y validar la nueva topología](#fase-3-experimentar-y-validar-la-nueva-topología)
4. [Fase 4. Preparar el contrato de entrada para OKE](#fase-4-preparar-el-contrato-de-entrada-para-oke)
5. [Entregables](#entregables)
6. [Preguntas de análisis](#preguntas-de-análisis)
7. [Anexo didáctico y relación con la ruta](#anexo-didáctico-y-relación-con-la-ruta)
8. [Referencias oficiales](#referencias-oficiales)

---

## Punto de partida

El Taller 1 dejó EcoRed funcionando correctamente en **OCI Container Instances** utilizando la misma imagen que ya estaba publicada en Docker Hub. Esa solución **no se reemplaza ni se vuelve a desplegar en este taller**.

El propósito ahora es preparar dos capacidades que serán utilizadas por Kubernetes en el Taller 3:

```text
1. Artefacto
Docker Hub
    ↓
misma imagen EcoRed
    ↓
OCIR

2. Networking
MISMA VCN: ecored-vcn
    ├── subnet pública existente
    └── nueva subnet privada para workloads
```

> **Importante:** Kubernetes no administrará la `Container Instance` creada en el Taller 1. En el Taller 3, OKE creará nuevos Pods y contenedores a partir de la misma imagen almacenada en OCIR.

📘 [Ampliar: por qué existe este Taller 2 si EcoRed ya funciona](#anexo-vision-general)

---

# Fase 1. Publicar la misma imagen EcoRed en OCIR

## Introducción

La imagen de EcoRed ya existe y funciona. En esta fase **no se ejecuta `docker build`**. Solamente se agrega una nueva referencia a la misma imagen y se publica en **OCI Container Registry (OCIR)**.

## Objetivo de la fase

Dejar disponible en OCI la imagen que posteriormente utilizará OKE.

## Proceso de la fase

```text
Imagen local ya construida
TU_USUARIO/ecored-circular:v1.0
          │
          │ docker tag
          ▼
Referencia OCIR
          │
          │ docker push
          ▼
OCIR privado
          │
          ▼
ecored/ecored-circular:v1.0
```

📘 [Ampliar: Docker Hub vs. OCIR y por qué Kubernetes no exige OCIR](#anexo-fase-1)

---

## Paso 1.1. Identificar namespace y endpoint de OCIR

En OCI Console:

1. Mantenga la misma región del Taller 1.
2. Abra **Tenancy** y registre el **Object Storage Namespace / Tenancy Namespace**.
3. Abra **Developer Services → Containers & Artifacts → Container Registry** y registre el endpoint mostrado para la región.

Registre:

```text
TENANCY_NAMESPACE=<namespace>
OCIR_ENDPOINT=<endpoint-regional>
```

### Verificación

El namespace debe ser el valor técnico de la tenancy, no solamente su nombre visible.

📘 [Ampliar: namespace, registry domain y ruta completa de una imagen](#anexo-paso-1-1)

---

## Paso 1.2. Crear el repository privado

Abra:

```text
Developer Services
→ Containers & Artifacts
→ Container Registry
→ Create repository
```

Configure:

```text
Name: ecored/ecored-circular
Compartment: ecored-dev
Access: Private
```

### Verificación

Debe existir:

```text
ecored/ecored-circular
```

📘 [Ampliar: repository, image, tag y digest](#anexo-paso-1-2)

---

## Paso 1.3. Crear un Auth Token para Docker CLI

En su perfil de OCI abra:

```text
User settings
→ Tokens and keys
→ Auth tokens
→ Generate token
```

Descripción sugerida:

```text
Docker CLI EcoRed
```

Copie el token y guárdelo de forma segura.

> No agregue el Auth Token al repositorio, capturas, videos ni entregables.

📘 [Ampliar: por qué se usa Auth Token y no la contraseña de OCI](#anexo-paso-1-3)

---

## Paso 1.4. Autenticar Docker contra OCIR

Desde el equipo donde ya tiene la imagen EcoRed:

```bash
docker login <OCIR_ENDPOINT>
```

Use el formato de usuario indicado por OCI para su tenancy e Identity Domain. La contraseña será el **Auth Token**.

### Verificación

```text
Login Succeeded
```

📘 [Ampliar: formato de usuario y autenticación de Docker contra OCIR](#anexo-paso-1-4)

---

## Paso 1.5. Etiquetar la imagen existente

Compruebe primero:

```bash
docker images
```

Agregue una nueva referencia:

```bash
docker tag TU_USUARIO/ecored-circular:v1.0 <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Compruebe nuevamente:

```bash
docker images
```

### Verificación

Deben aparecer dos referencias a la imagen:

```text
Docker Hub → TU_USUARIO/ecored-circular:v1.0
OCIR       → <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

No ejecute `docker build`.

📘 [Ampliar: diferencia entre `docker build` y `docker tag`](#anexo-paso-1-5)

---

## Paso 1.6. Publicar y validar la imagen en OCIR

Publique:

```bash
docker push <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

En OCI Console verifique que el repository muestre el tag:

```text
v1.0
```

Opcionalmente valide la recuperación de la imagen:

```bash
docker pull <OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

### Verificación

La imagen está almacenada en OCIR y puede recuperarse sin reconstruirla.

📘 [Ampliar: qué se transfiere realmente durante `push` y `pull`](#anexo-paso-1-6)

---

# Fase 2. Ampliar la VCN con networking privado

## Introducción

En el Taller 1 se creó una red mínima orientada a publicar directamente una aplicación en Internet:

```text
ecored-vcn 10.20.0.0/16
    │
    └── ecored-public-subnet 10.20.10.0/24
             │
             └── 0.0.0.0/0 → Internet Gateway
```

En este taller **no se crea otra VCN**. Se amplía `ecored-vcn` agregando una zona privada para workloads posteriores:

```text
ecored-vcn 10.20.0.0/16
│
├── ecored-public-subnet
│   10.20.10.0/24
│        └── Internet Gateway
│
└── ecored-workloads-private
    10.20.20.0/24
         ├── NAT Gateway
         └── Service Gateway
```

## Objetivo de la fase

Preparar una subnet sin IPv4 pública directa para workloads que posteriormente serán administrados por OKE.

📘 [Ampliar: por qué Kubernetes cambia el modelo de red del Taller 1](#anexo-fase-2)

---

## Paso 2.1. Crear el NAT Gateway `ecored-nat`

Dentro de `ecored-vcn` abra:

```text
NAT Gateways
→ Create NAT Gateway
```

Configure:

```text
Name: ecored-nat
Compartment: ecored-dev
```

### Verificación

```text
ecored-nat → Available
```

📘 [Ampliar: Internet Gateway vs. NAT Gateway](#anexo-paso-2-1)

---

## Paso 2.2. Crear el Service Gateway `ecored-sgw`

Dentro de `ecored-vcn` abra:

```text
Service Gateways
→ Create Service Gateway
```

Configure:

```text
Name: ecored-sgw
Service: All <region> Services in Oracle Services Network
```

### Verificación

```text
ecored-sgw → Available
```

📘 [Ampliar: Service Gateway y Oracle Services Network](#anexo-paso-2-2)

---

## Paso 2.3. Crear la Route Table privada

Dentro de `ecored-vcn` cree:

```text
Name: ecored-private-rt
Compartment: ecored-dev
```

Agregue las rutas:

```text
0.0.0.0/0
    → NAT Gateway
    → ecored-nat

All <region> Services in Oracle Services Network
    → Service Gateway
    → ecored-sgw
```

### Verificación

La tabla privada **no utiliza `ecored-igw` como ruta por defecto**.

📘 [Ampliar: cómo decide una Route Table y qué significa `0.0.0.0/0`](#anexo-paso-2-3)

---

## Paso 2.4. Crear la subnet privada `ecored-workloads-private`

Dentro de `ecored-vcn` seleccione **Create Subnet**.

Configure:

```text
Name: ecored-workloads-private
Compartment: ecored-dev
Subnet Type: Regional
IPv4 CIDR Block: 10.20.20.0/24
Route Table: ecored-private-rt
Public IPv4 addresses on VNICs: Prohibited
DNS Resolution: Enabled
```

### Verificación

```text
Subnet: ecored-workloads-private
CIDR: 10.20.20.0/24
Access: Private
Route Table: ecored-private-rt
```

📘 [Ampliar: subnet pública vs. subnet privada](#anexo-paso-2-4)

---

## Paso 2.5. Crear el NSG base `ecored-workloads-nsg`

Dentro de `ecored-vcn` cree:

```text
Name: ecored-workloads-nsg
Compartment: ecored-dev
```

En este taller **no abra puertos de aplicación desde `0.0.0.0/0`**.

Las reglas específicas necesarias para los componentes de OKE se definirán cuando exista el cluster y se conozca qué recurso debe comunicarse con cuál.

### Verificación

Existe el NSG y no contiene una regla pública indiscriminada hacia EcoRed.

📘 [Ampliar: Security List vs. NSG y por qué aplazamos las reglas de OKE](#anexo-paso-2-5)

---

## Paso 2.6. Verificar la topología en Network Visualizer

Abra:

```text
Networking
→ Network Visualizer
```

Compruebe visualmente:

```text
ecored-vcn
│
├── ecored-public-subnet
│      └── ecored-igw
│
└── ecored-workloads-private
       ├── ecored-nat
       └── ecored-sgw
```

Capture la topología como evidencia.

📘 [Ampliar: qué demuestra y qué no demuestra Network Visualizer](#anexo-paso-2-6)

---

# Fase 3. Experimentar y validar la nueva topología

## Introducción

Esta fase no crea una segunda Container Instance. La aplicación del Taller 1 ya demostró que la imagen funciona. Ahora la experimentación se concentra en entender **artefacto, segmentación y rutas**.

## Objetivo de la fase

Comprobar que el estudiante puede explicar la evolución desde una aplicación directamente publicada hacia una infraestructura preparada para workloads privados.

📘 [Ampliar: por qué no se vuelve a desplegar EcoRed en Container Instances](#anexo-fase-3)

---

## Paso 3.1. Comparar las dos subnets

Registre en una tabla propia:

| Elemento | Subnet pública | Subnet privada |
|---|---|---|
| Nombre | `ecored-public-subnet` | `ecored-workloads-private` |
| CIDR | `10.20.10.0/24` | `10.20.20.0/24` |
| IPv4 pública en VNIC | Permitida | Prohibida |
| Ruta por defecto | Internet Gateway | NAT Gateway |
| Acceso a servicios OCI | según diseño | Service Gateway |
| Uso | publicación inicial | workloads internos |

📘 [Ampliar: lectura arquitectónica de las dos subnets](#anexo-paso-3-1)

---

## Paso 3.2. Comparar las Route Tables

Abra la Route Table de cada subnet y confirme:

```text
PÚBLICA
0.0.0.0/0 → ecored-igw

PRIVADA
0.0.0.0/0 → ecored-nat
All <region> Services in Oracle Services Network → ecored-sgw
```

Explique por qué el mismo destino `0.0.0.0/0` puede tener un target diferente según la subnet.

📘 [Ampliar: ruta por defecto, siguiente salto y analogía del “comodín”](#anexo-paso-3-2)

---

## Paso 3.3. Confirmar que el artefacto no cambió

Compare las referencias:

```text
Docker Hub
TU_USUARIO/ecored-circular:v1.0

OCIR
<OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Explique:

```text
Código            = no cambió
Dockerfile        = no cambió
Imagen funcional  = no se reconstruyó
Registry          = sí cambió / se agregó OCIR
```

📘 [Ampliar: portabilidad del artefacto y responsabilidad del registry](#anexo-paso-3-3)

---

## Paso 3.4. Construir el diagrama final del Taller 2

El estudiante debe representar al menos:

```text
                         OCI
                          │
              ┌───────────┴───────────┐
              │                       │
             OCIR                 ecored-vcn
              │                   10.20.0.0/16
              │                       │
              │          ┌────────────┴────────────┐
              │          │                         │
              │      subnet pública           subnet privada
              │      10.20.10.0/24            10.20.20.0/24
              │          │                         │
              │         IGW                   NAT + SGW
              │
              └── ecored/ecored-circular:v1.0
```

📘 [Ampliar: relación entre el artefacto OCIR y la red que utilizará OKE](#anexo-paso-3-4)

---

# Fase 4. Preparar el contrato de entrada para OKE

## Introducción

El Taller 3 no debe volver a descubrir nombres, redes o rutas. Se deja un conjunto mínimo de parámetros reutilizables.

## Objetivo de la fase

Entregar a OKE una VCN preparada para workloads privados y una imagen disponible en OCIR.

📘 [Ampliar: qué podrá reutilizar OKE y qué tendrá que crear todavía](#anexo-fase-4)

---

## Paso 4.1. Registrar parámetros reutilizables

Cree o actualice:

```text
oci-lab-params.example
```

Contenido mínimo:

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

> No incluya Auth Tokens, contraseñas, claves privadas ni secretos de EcoRed.

📘 [Ampliar: parámetros de infraestructura vs. secretos](#anexo-paso-4-1)

---

## Paso 4.2. Revisar recursos y costos

Al finalizar:

1. Mantenga VCN, gateways, Route Tables, subnets, NSG y repository OCIR.
2. La `ecored-ci` del Taller 1 puede detenerse si ya no se utilizará durante la sesión.
3. No elimine la infraestructura que será reutilizada por el Taller 3.
4. Revise Cost Analysis o el saldo de créditos de la cuenta.

📘 [Ampliar: qué conservar, qué detener y por qué](#anexo-paso-4-2)

---

# Entregables

- [ ] Repository privado `ecored/ecored-circular` en OCIR.
- [ ] Tag `v1.0` visible en OCIR.
- [ ] Evidencia de `docker login`, `tag`, `push` y `pull`, sin mostrar el Auth Token.
- [ ] NAT Gateway `ecored-nat`.
- [ ] Service Gateway `ecored-sgw`.
- [ ] Route Table `ecored-private-rt`.
- [ ] Subnet privada `ecored-workloads-private` — `10.20.20.0/24`.
- [ ] NSG `ecored-workloads-nsg`.
- [ ] Evidencia de Network Visualizer con subnet pública y privada.
- [ ] Comparación de las Route Tables pública y privada.
- [ ] `oci-lab-params.example` actualizado y sin secretos.

> **No es entregable crear una nueva Container Instance desde OCIR.** La validación funcional de EcoRed ya fue realizada en el Taller 1.

---

# Preguntas de análisis

1. ¿Por qué OCIR es útil para la ruta si Kubernetes también podría descargar una imagen desde Docker Hub?
2. ¿Por qué `docker tag` no crea una nueva aplicación ni recompila EcoRed?
3. ¿Qué diferencia existe entre registry, repository, image y tag?
4. ¿Por qué se reutiliza `ecored-vcn` en lugar de crear una nueva VCN?
5. ¿Qué diferencia práctica existe entre `ecored-public-subnet` y `ecored-workloads-private`?
6. ¿Por qué la subnet pública usa `0.0.0.0/0 → ecored-igw` y la privada usa `0.0.0.0/0 → ecored-nat`?
7. ¿Por qué NAT Gateway permite salida a Internet sin convertir el workload en un destino público directo?
8. ¿Para qué se utiliza Service Gateway si ya existe NAT Gateway?
9. ¿Qué diferencia hay entre una Security List y un NSG?
10. ¿Por qué Kubernetes no puede “adoptar” la Container Instance `ecored-ci` del Taller 1?

---

# Contrato de entrada para el Taller 3

El Taller 3 reutilizará:

```text
ecored-dev
│
├── ecored-vcn
│   ├── ecored-public-subnet
│   └── ecored-workloads-private
│
├── ecored-nat
├── ecored-sgw
├── ecored-private-rt
├── ecored-workloads-nsg
│
└── OCIR
    └── ecored/ecored-circular:v1.0
```

> Esta infraestructura es una **base de preparación**, no toda la topología definitiva de OKE. Durante la creación del cluster, OCI puede requerir subnets o reglas adicionales para el Kubernetes API endpoint, workers, Pods o futuros Load Balancers. Esos elementos se crearán cuando exista la necesidad concreta en el Taller 3.

---

# Anexo didáctico y relación con la ruta

<a id="anexo-vision-general"></a>
## Visión general - ¿Por qué existe el Taller 2 si EcoRed ya funciona?

El Taller 1 resolvió una pregunta: **¿puede ejecutarse EcoRed en OCI usando la misma imagen de Render?** La respuesta fue sí.

El Taller 2 resuelve otra pregunta: **¿cómo preparamos el artefacto y la red para que un orquestador como Kubernetes los utilice después?**

```text
Taller 1
Container Instance
= ejecutar un contenedor

Taller 2
OCIR + networking privado
= preparar artefacto + infraestructura

Taller 3
OKE / Kubernetes
= orquestar Pods y contenedores
```

Kubernetes no adopta la Container Instance existente. OKE creará Pods nuevos a partir de la imagen de OCIR.

[↩ Volver al punto de partida](#punto-de-partida)

---

<a id="anexo-fase-1"></a>
## Fase 1 - Docker Hub vs. OCIR

Docker Hub y OCIR son registries de contenedores. Ambos pueden almacenar imágenes que Kubernetes puede descargar.

OCIR se introduce porque permite que el artefacto quede integrado en OCI y posteriormente pueda relacionarse con IAM, OKE y automatización de entrega. **No es un requisito universal de Kubernetes.**

```text
Docker Hub                         OCIR
----------                         ----
Registry externo                  Registry de OCI
Imagen pública o privada          Repository público o privado
Credenciales Docker Hub           IAM/Auth Token OCI
Puede ser usado por Kubernetes    Puede ser usado por OKE
```

[↩ Volver a Fase 1](#fase-1-publicar-la-misma-imagen-ecored-en-ocir)

---

<a id="anexo-paso-1-1"></a>
## Paso 1.1 - Namespace y registry domain

El **tenancy namespace** es un identificador técnico usado en las rutas de OCIR. No debe confundirse con el nombre visible de la tenancy.

Una referencia completa sigue la forma:

```text
<registry-domain>/<tenancy-namespace>/<repository>:<tag>
```

Ejemplo conceptual:

```text
<OCIR_ENDPOINT>/<TENANCY_NAMESPACE>/ecored/ecored-circular:v1.0
```

Oracle documenta como formato recomendado del registry domain:

```text
ocir.<region-identifier>.oci.oraclecloud.com
```

En determinadas regiones/realms también pueden encontrarse formatos `*.ocir.io`. Para el laboratorio, utilice el endpoint que muestre OCI Console.

[↩ Volver al Paso 1.1](#paso-11-identificar-namespace-y-endpoint-de-ocir)

---

<a id="anexo-paso-1-2"></a>
## Paso 1.2 - Repository, image, tag y digest

```text
Registry
└── Repository: ecored/ecored-circular
    ├── Image :v1.0
    └── Image :v1.1
```

- **Registry:** servicio que almacena artefactos.
- **Repository:** agrupación lógica de versiones relacionadas.
- **Image:** plantilla inmutable usada para crear contenedores.
- **Tag:** etiqueta legible asociada a una versión.
- **Digest:** hash que identifica exactamente el contenido de una imagen.

Un tag puede reutilizarse; un digest representa contenido específico.

[↩ Volver al Paso 1.2](#paso-12-crear-el-repository-privado)

---

<a id="anexo-paso-1-3"></a>
## Paso 1.3 - Auth Token

Docker necesita autenticarse contra un registry privado. En OCIR el Auth Token se utiliza como contraseña de Docker CLI.

```text
OCI Console password ≠ Docker registry password
                         │
                         ▼
                    Auth Token
```

El token debe tratarse como un secreto. Si se expone, debe revocarse y generar uno nuevo.

[↩ Volver al Paso 1.3](#paso-13-crear-un-auth-token-para-docker-cli)

---

<a id="anexo-paso-1-4"></a>
## Paso 1.4 - Login contra OCIR

El username depende de la configuración de identidad de la tenancy. Conceptualmente:

```text
<TENANCY_NAMESPACE>/<usuario>
```

Con Identity Domains puede incluir también el dominio. Por esta razón el procedimiento principal no fija un único formato y recomienda utilizar el valor indicado por OCI para la identidad del estudiante.

El Auth Token se usa como password.

[↩ Volver al Paso 1.4](#paso-14-autenticar-docker-contra-ocir)

---

<a id="anexo-paso-1-5"></a>
## Paso 1.5 - `docker build` vs. `docker tag`

```text
docker build
Código + Dockerfile
       ↓
crea una imagen


docker tag
Imagen existente
       ↓
agrega otra referencia
```

Por eso en este taller no se reconstruye EcoRed. La misma imagen que funcionó en Render y OCI Container Instances recibe una referencia compatible con OCIR.

[↩ Volver al Paso 1.5](#paso-15-etiquetar-la-imagen-existente)

---

<a id="anexo-paso-1-6"></a>
## Paso 1.6 - Push y pull

`docker push` transfiere al registry las capas que todavía no estén disponibles allí. `docker pull` recupera las capas necesarias para disponer localmente de la imagen.

```text
Local ── push ──► OCIR
Local ◄─ pull ─── OCIR
```

La aplicación no está ejecutándose en OCIR. **OCIR almacena el artefacto; un runtime como Container Instances u OKE es quien lo ejecuta.**

[↩ Volver al Paso 1.6](#paso-16-publicar-y-validar-la-imagen-en-ocir)

---

<a id="anexo-fase-2"></a>
## Fase 2 - Modelo mental de la red privada

El Taller 1 utilizó una subnet pública porque el objetivo era publicar directamente una Container Instance.

El Taller 2 agrega una subnet privada porque los workloads internos de una plataforma Kubernetes no necesitan necesariamente una IPv4 pública individual.

```text
PUBLICA
recurso ↔ Internet
mediante IGW + IP pública + reglas

PRIVADA
recurso → Internet
mediante NAT

recurso → servicios OCI
mediante Service Gateway
```

Oracle recomienda el uso de subnets privadas para componentes de OKE cuando el diseño requiere evitar exposición pública directa.

[↩ Volver a Fase 2](#fase-2-ampliar-la-vcn-con-networking-privado)

---

<a id="anexo-paso-2-1"></a>
## Paso 2.1 - Internet Gateway vs. NAT Gateway

| Característica | Internet Gateway | NAT Gateway |
|---|---|---|
| Uso típico | Recursos públicos | Recursos privados |
| Salida a Internet | Sí | Sí |
| Entrada iniciada desde Internet | Puede ser posible con IP pública, rutas y reglas | No habilita entrada directa al recurso privado |
| IPv4 pública en workload | Puede existir | No es necesaria |

Modelo mental:

```text
IGW = puerta pública de la VCN
NAT = salida controlada para quien no tiene puerta pública propia
```

[↩ Volver al Paso 2.1](#paso-21-crear-el-nat-gateway-ecored-nat)

---

<a id="anexo-paso-2-2"></a>
## Paso 2.2 - Service Gateway

Service Gateway permite que una subnet acceda de forma privada a servicios OCI compatibles a través de **Oracle Services Network**, sin utilizar Internet como camino lógico de acceso al servicio.

```text
Subnet privada
      │
      ▼
Service Gateway
      │
      ▼
Oracle Services Network
      │
      ▼
Servicios OCI compatibles
```

NAT y Service Gateway no son equivalentes: NAT resuelve salida general a Internet; Service Gateway crea una ruta específica hacia servicios OCI.

[↩ Volver al Paso 2.2](#paso-22-crear-el-service-gateway-ecored-sgw)

---

<a id="anexo-paso-2-3"></a>
## Paso 2.3 - Route Table y `0.0.0.0/0`

Una Route Table responde:

> **¿Cuál es el siguiente salto para llegar al destino?**

`0.0.0.0/0` representa la ruta IPv4 por defecto: cualquier destino IPv4 para el que no exista una ruta más específica.

Como analogía didáctica, puede pensarse de manera similar a un comodín como `*.*`: representa el caso general. Técnicamente no es un comodín de texto; es un prefijo CIDR `/0`.

En este proyecto:

```text
Subnet pública
0.0.0.0/0 → ecored-igw

Subnet privada
0.0.0.0/0 → ecored-nat
```

La misma dirección de destino puede tomar caminos distintos porque cada subnet utiliza su propia Route Table asociada.

[↩ Volver al Paso 2.3](#paso-23-crear-la-route-table-privada)

---

<a id="anexo-paso-2-4"></a>
## Paso 2.4 - Subnet pública vs. privada

La diferencia principal en OCI no es que una subnet privada “no tenga Internet”. La diferencia clave es que **prohíbe IPv4 públicas en las VNIC de sus recursos**.

```text
ecored-public-subnet
10.20.10.0/24
→ puede asignar IPv4 pública


ecored-workloads-private
10.20.20.0/24
→ IPv4 pública en VNIC: prohibited
```

Una subnet privada todavía puede iniciar tráfico hacia Internet mediante NAT si las rutas y reglas de seguridad lo permiten.

[↩ Volver al Paso 2.4](#paso-24-crear-la-subnet-privada-ecored-workloads-private)

---

<a id="anexo-paso-2-5"></a>
## Paso 2.5 - Security List vs. NSG

Ambos controlan tráfico, pero se asocian de manera diferente:

```text
Security List
      ↓
Subnet
      ↓
reglas aplicadas a las VNIC de la subnet

NSG
      ↓
VNIC / recurso seleccionado
      ↓
reglas por responsabilidad
```

En el Taller 1 era suficiente una Security List de subnet. En una arquitectura con múltiples responsabilidades resulta útil aplicar NSG específicos a componentes concretos.

No se agregan todavía todas las reglas de OKE porque aún no existen el cluster, sus endpoints, workers o Pods. Esas reglas deben responder a una comunicación real y no anticiparse sin contexto.

[↩ Volver al Paso 2.5](#paso-25-crear-el-nsg-base-ecored-workloads-nsg)

---

<a id="anexo-paso-2-6"></a>
## Paso 2.6 - Network Visualizer

Network Visualizer permite observar la relación entre recursos de red y facilita comprobar que la VCN contiene las subnets y gateways esperados.

No sustituye una prueba de conectividad real. Una topología visualmente correcta todavía puede contener reglas de seguridad o rutas incorrectas.

[↩ Volver al Paso 2.6](#paso-26-verificar-la-topología-en-network-visualizer)

---

<a id="anexo-fase-3"></a>
## Fase 3 - ¿Por qué no desplegamos otra Container Instance?

Crear `ecored-ci-ocir` repetiría una capacidad que el Taller 1 ya demostró: ejecutar la imagen EcoRed en Container Instances.

El objetivo del Taller 2 no es demostrar nuevamente el runtime, sino preparar:

```text
OCIR
+ subnet privada
+ NAT Gateway
+ Service Gateway
+ Route Table privada
+ NSG base
```

La prueba de OCIR se realiza con `push` y `pull`. La siguiente ejecución relevante de la imagen será en OKE, donde Kubernetes sí agrega un concepto nuevo: orquestación.

[↩ Volver a Fase 3](#fase-3-experimentar-y-validar-la-nueva-topología)

---

<a id="anexo-paso-3-1"></a>
## Paso 3.1 - Lectura arquitectónica de las subnets

Las subnets no representan dos aplicaciones distintas. Representan **dos niveles de exposición** dentro de la misma VCN.

La pública se conserva porque forma parte del recorrido previo y puede ser útil posteriormente para componentes que requieran exposición controlada. La privada se agrega para workloads que no deben recibir una IPv4 pública individual.

[↩ Volver al Paso 3.1](#paso-31-comparar-las-dos-subnets)

---

<a id="anexo-paso-3-2"></a>
## Paso 3.2 - Ruta por defecto y siguiente salto

Una ruta puede imaginarse como la instrucción de una oficina de correspondencia:

```text
Si el destino coincide con una regla específica
→ use esa salida

Si no existe una regla más específica
→ use 0.0.0.0/0
```

La Route Table pública entrega ese tráfico al Internet Gateway. La privada lo entrega al NAT Gateway.

[↩ Volver al Paso 3.2](#paso-32-comparar-las-route-tables)

---

<a id="anexo-paso-3-3"></a>
## Paso 3.3 - Portabilidad del artefacto

La misma imagen puede almacenarse en más de un registry. El registry no modifica por sí mismo el contenido de la imagen.

```text
                ┌── Docker Hub
Imagen EcoRed ──┤
                └── OCIR
```

La portabilidad conseguida en los talleres anteriores permite que el runtime cambie sin que el equipo vuelva a implementar la aplicación desde cero.

[↩ Volver al Paso 3.3](#paso-33-confirmar-que-el-artefacto-no-cambió)

---

<a id="anexo-paso-3-4"></a>
## Paso 3.4 - OCIR y networking son responsabilidades distintas

OCIR almacena la imagen. La VCN, subnets, gateways y Route Tables determinan cómo se comunicarán los recursos que ejecuten esa imagen.

```text
OCIR
= ¿de dónde obtengo el software contenerizado?

VCN / subnet / gateways
= ¿cómo se comunica el runtime que lo ejecuta?
```

[↩ Volver al Paso 3.4](#paso-34-construir-el-diagrama-final-del-taller-2)

---

<a id="anexo-fase-4"></a>
## Fase 4 - Qué reutilizará OKE

OKE podrá reutilizar la VCN y recursos de conectividad ya construidos, pero el cluster introducirá nuevas necesidades de red.

Según la configuración elegida, OKE puede requerir redes o reglas para:

```text
Kubernetes API endpoint
Worker nodes
Pods
Load Balancers
```

Por eso este taller prepara una **base**, no intenta anticipar toda la topología de Kubernetes antes de crear el cluster.

[↩ Volver a Fase 4](#fase-4-preparar-el-contrato-de-entrada-para-oke)

---

<a id="anexo-paso-4-1"></a>
## Paso 4.1 - Parámetros vs. secretos

Un OCID o nombre de subnet identifica infraestructura y normalmente puede registrarse en un archivo de parámetros de laboratorio.

Un Auth Token, contraseña, clave privada o credencial de Firebase permite autenticarse y debe permanecer fuera del repositorio.

```text
Parámetro de infraestructura → registrar
Secreto de autenticación     → proteger
```

[↩ Volver al Paso 4.1](#paso-41-registrar-parámetros-reutilizables)

---

<a id="anexo-paso-4-2"></a>
## Paso 4.2 - Conservación de recursos

El objetivo es minimizar costos sin destruir el resultado requerido por el Taller 3.

Conserve:

```text
VCN
subnets
gateways
Route Tables
NSG
OCIR repository
```

Detenga recursos de cómputo que ya no necesite durante la práctica, siempre que no sean necesarios para una evidencia pendiente.

[↩ Volver al Paso 4.2](#paso-42-revisar-recursos-y-costos)

---

# Referencias oficiales

- OCI Container Registry concepts: https://docs.oracle.com/en-us/iaas/Content/Registry/Concepts/registryconcepts.htm
- Generating an Auth Token: https://docs.oracle.com/en-us/iaas/Content/Functions/Tasks/functionsgenerateauthtokens.htm
- Logging in to OCIR: https://docs.oracle.com/en-us/iaas/Content/Functions/Tasks/functionslogintoocir.htm
- VCN Route Tables: https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/managingroutetables.htm
- Creating a NAT Gateway: https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/nat-create.htm
- Service Gateway: https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/servicegateway.htm
- OKE network resource configuration: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengnetworkconfig.htm
- OKE example network configurations: https://docs.oracle.com/en-us/iaas/Content/ContEng/Concepts/contengnetworkconfigexample.htm

---

[← Taller 1](./01-De-Render-a-OCI-Container-Instances.md) | [Índice de la ruta](./README.md) | [Taller 3 →](./03-EcoRed-en-OKE-Kubernetes.md)
