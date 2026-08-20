# Taller 1. De Render a Oracle Cloud Infrastructure Container Instances: despliegue inicial de EcoRed

[← Taller base: Docker Hub + Render](https://github.com/adanbeltran/Taller12factors/blob/main/docs/F-Contenizacion-Despliegue-web-en-Render.md) | [Índice de la ruta](README.md) | [Taller 2 →](02-OCIR-y-Networking-Privado.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **IAM — Identity and Access Management:** Gestión de Identidad y Acceso.
- **VCN — Virtual Cloud Network:** Red Virtual en la Nube.
- **CIDR — Classless Inter-Domain Routing:** Enrutamiento entre Dominios sin Clases.
- **IP — Internet Protocol:** Protocolo de Internet.
- **IPv4 — Internet Protocol version 4:** Protocolo de Internet versión 4.
- **DNS — Domain Name System:** Sistema de Nombres de Dominio.
- **HTTP — Hypertext Transfer Protocol:** Protocolo de Transferencia de Hipertexto.
- **TCP — Transmission Control Protocol:** Protocolo de Control de Transmisión.
- **URL — Uniform Resource Locator:** Localizador Uniforme de Recursos.
- **JSON — JavaScript Object Notation:** Notación de Objetos de JavaScript.
- **OCPU — Oracle Compute Unit:** Unidad de Cómputo de Oracle.
- **VNIC — Virtual Network Interface Card:** Tarjeta de Interfaz de Red Virtual.
- **IGW — Internet Gateway:** Pasarela de Internet.
- **GB — Gigabyte:** Gigabyte.

## 1. Introducción

EcoRed ya se encuentra contenerizado, publicado en Docker Hub y ejecutándose en Render. En este taller se utiliza **la misma imagen de EcoRed** para ejecutarla en OCI Container Instances. El objetivo es que el estudiante compruebe que el artefacto contenerizado puede trasladarse a otra plataforma de ejecución sin reconstruir la aplicación.

El recorrido será:

```text
Docker Hub
    │
    ▼
OCI Container Instances
    │
    ▼
Contenedor EcoRed
    │
    ├── Nginx :10000
    ├── React compilado
    └── Django / Gunicorn
           │
           ├── MongoDB Atlas
           └── Firebase
```

<img width="1536" height="1024" alt="flujotaller1" src="https://github.com/user-attachments/assets/fde1e830-68d9-453d-aa42-9bfb76d37136" />



## 2. Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye la **base de ejecución e infraestructura cloud** sobre la que se apoyarán los bloques posteriores de la arquitectura destino. Al finalizar, EcoRed seguirá siendo una sola aplicación contenerizada, pero estará ejecutándose dentro de OCI y conectada a una VCN propia.

Los componentes de la arquitectura destino que comienzan a materializarse son:

```text
Capacidades de plataforma
├── ejecución de contenedores
└── red OCI

Base de acceso
└── exposición HTTP inicial para validar el servicio
```

## 3. Objetivo

Desplegar en OCI la imagen Docker existente de EcoRed mediante Container Instances, construyendo la red pública mínima necesaria para acceder a la aplicación desde Internet y validar su operación independiente del computador del estudiante.

## 4. Arquitectura de salida del taller

```text
                         Internet
                            │
                     HTTP TCP :10000
                            │
                            ▼
                     IPv4 pública OCI
                            │
                            ▼
                   ecored-public-subnet
                            │
                  ┌─────────┴─────────┐
                  │                   │
          Default Route Table    Security List
                  │                   │
           0.0.0.0/0 → IGW       TCP :10000
                  │
                  ▼
              ecored-igw

                            │
                            ▼
                    Container Instance
                       `ecored-ci`
                            │
                            ▼
                    Contenedor `ecored`
                            │
                            ▼
              Docker Hub: ecored-circular:v1.0
```

## 5. Punto de partida

Debe existir la imagen pública del taller de Docker/Render:

```text
docker.io/TU_USUARIO/ecored-circular:v1.0
```

La imagen utiliza arquitectura `linux/amd64`, expone `10000/tcp` y conserva externamente la configuración sensible utilizada por Django, MongoDB Atlas y Firebase.

---

# Fase 1. Preparar el entorno OCI

## Paso 1.1. Identificar la tenancy

1. Inicie sesión en OCI Console.
2. Abra el menú de perfil.
3. Consulte **Tenancy**.


```text
TENANCY_NAME=<nombre-de-la-tenancy>
```
### Paso a paso
<img width="508" height="393" alt="image" src="https://github.com/user-attachments/assets/41adfb35-084f-4e08-bce4-68a82f309099" />

<img width="1249" height="456" alt="image" src="https://github.com/user-attachments/assets/a0d40c82-943e-46e6-b95d-499ad2c66095" />


## Paso 1.2. Seleccionar la región de trabajo

1. En la barra superior de OCI Console abra el selector **Region**.
2. Seleccione una región disponible para la cuenta.
3. Mantenga la misma región durante la práctica.
4. Registre:

```text
OCI_REGION=<region>
```
### Paso a paso

<img width="490" height="361" alt="image" src="https://github.com/user-attachments/assets/3b054641-4deb-4309-9274-34eee8489cd0" />



## Paso 1.3. Crear el compartment `ecored-dev`

Abra:

```text
Identity & Security
→ Compartments
→ Create Compartment
```

Configure:

```text
Name: ecored-dev
Description: Recursos del laboratorio EcoRed en OCI
Parent Compartment: <Root Compartment>
```

Seleccione **Create Compartment** y espere hasta observar:

```text
State: Active
```

### Paso a paso

<img width="1810" height="804" alt="image" src="https://github.com/user-attachments/assets/69d6f155-9ce9-4887-809a-10f2159b4291" />

<img width="600" height="430" alt="image" src="https://github.com/user-attachments/assets/a74118e3-6267-47d3-bf07-a34819935e77" />

<img width="1456" height="326" alt="image" src="https://github.com/user-attachments/assets/e33fe589-3167-45e3-825b-4c5a53254de2" />

<img width="1866" height="726" alt="image" src="https://github.com/user-attachments/assets/ab5bf2b7-e36f-4d0c-8d21-0ddce83c6c1f" />

<img width="1151" height="360" alt="image" src="https://github.com/user-attachments/assets/5b9b95ea-6df6-44b1-92cc-a506802aaae3" />



Todos los recursos del taller deben crearse en `ecored-dev`.

## Paso 1.4. Registrar el estado de créditos y costos

1. Abra **Billing & Cost Management** o el indicador de créditos visible para la cuenta.
2. Registre en la bitácora el valor mostrado:

```text
CREDITO_INICIAL=<valor mostrado por OCI>
```


### Paso a paso

<img width="318" height="644" alt="image" src="https://github.com/user-attachments/assets/8e781089-6bf4-4038-8f84-466f1be7daf0" />
<img width="419" height="315" alt="image" src="https://github.com/user-attachments/assets/cc096d5f-4b97-4eef-b292-ba828c753e44" />
<img width="1035" height="709" alt="image" src="https://github.com/user-attachments/assets/cfc8a8ca-06bc-47a8-a4e1-e78d622afb40" />



La bitácora contiene región, tenancy, compartment y estado inicial de crédito/costo.

---

# Fase 2. Crear la red pública de EcoRed

## Paso 2.1. Crear la VCN

Abra:

```text
Networking
→ Virtual Cloud Networks
→ Create VCN
```

Configure:

```text
Name: ecored-vcn
IPv4 CIDR Block: 10.20.0.0/16
Use DNS hostnames: Enabled
Compartment: ecored-dev
DNS Resolver:ecored-vcn
```

Seleccione **Create VCN**.

### Paso a paso
<img width="675" height="489" alt="image" src="https://github.com/user-attachments/assets/b0c5f474-e896-4c85-877f-9f9ace278518" />
<img width="711" height="410" alt="image" src="https://github.com/user-attachments/assets/666b9cd0-1117-4eed-b920-857bd67fe22f" />
<img width="611" height="762" alt="image" src="https://github.com/user-attachments/assets/288095ff-79db-4572-967c-97e70b1b4b16" />


<img width="850" height="503" alt="image" src="https://github.com/user-attachments/assets/05548495-a683-4e4b-baee-9e3296e13d8b" />
<img width="1554" height="285" alt="image" src="https://github.com/user-attachments/assets/6e3296fd-84e0-4a5f-af2e-e8a606a2fb9a" />

## Apoyo didáctico: configuración inicial de la VCN

Para EcoRed se crea la **VCN (Virtual Cloud Network — Red Virtual en la Nube)** como espacio de red privado donde posteriormente se desplegarán los recursos de la aplicación.

### IPv4 CIDR: `10.20.0.0/16`

`10.20.0.0/16` define el rango de direcciones IPv4 privadas disponible para la VCN.

* `10.20.0.0` identifica el inicio del rango.
* `/16` indica que los primeros **16 bits** identifican la red.
* Quedan 16 bits para direccionamiento interno.
* El rango permite aproximadamente **65.536 direcciones IPv4 teóricas**.

La elección de `/16` permite dividir posteriormente la VCN en subredes más pequeñas:

```text
VCN EcoRed: 10.20.0.0/16
│
├── 10.20.10.0/24 → aplicación
├── 10.20.20.0/24 → balanceadores
├── 10.20.30.0/24 → workers de Kubernetes
├── 10.20.40.0/24 → servicios/API
└── 10.20.50.0/24 → pods
```

**Analogía:** `10.20.0.0/16` puede verse como toda una ciudad y cada subnet `/24` como un barrio reservado para una función determinada.

### IPv6

OCI permite crear redes con IPv4 e IPv6. Sin embargo, **IPv6 no es necesario en este taller**, porque EcoRed puede funcionar completamente utilizando IPv4.

IPv6 sería conveniente posteriormente si existieran requisitos como:

* clientes o sistemas externos que utilicen IPv6;
* infraestructura empresarial dual-stack IPv4/IPv6;
* integración con redes que requieran IPv6.

Por ahora se deja deshabilitado para no introducir complejidad innecesaria.

### DNS Resolution

Se recomienda mantener **DNS Resolution habilitado**.

**DNS (Domain Name System — Sistema de Nombres de Dominio)** permite resolver nombres de recursos en direcciones IP.

```text
Nombre del recurso
      │
      ▼
     DNS
      │
      ▼
Dirección IP
```

Ejemplo conceptual:

```text
empresas
   ↓ DNS
10.20.30.25
```

Esto permite que los componentes de EcoRed puedan localizarse mediante nombres en lugar de depender directamente de direcciones IP, algo especialmente importante cuando posteriormente se utilicen Kubernetes y microservicios.

### Configuración recomendada para el taller

```text
Name:                ecored-vcn
Compartment:         ecored-dev
IPv4 CIDR Block:     10.20.0.0/16
IPv6:                No habilitar por ahora
DNS Resolution:      Enabled
DNS Label:           ecoredvcn
```
**Idea clave:** CIDR define el espacio de direcciones de la red; `/16` determina su tamaño; IPv6 agrega un esquema adicional de direccionamiento que todavía no necesitamos; y DNS Resolution facilita que los recursos se encuentren mediante nombres en lugar de depender únicamente de direcciones IP.


## Paso 2.2. Crear la subnet pública

Dentro de `ecored-vcn`, seleccione **Create Subnet** y configure:

```text
Name: ecored-public-subnet
Subnet Type: Regional
IPv4 CIDR Block: 10.20.10.0/24
Route Table: Default Route Table
Subnet Access: Public Subnet
Security List: Default Security List
```

Seleccione **Create Subnet**.

### Verificación
<img width="665" height="365" alt="image" src="https://github.com/user-attachments/assets/f8463787-bbc8-4d66-9049-7ae5cd06c885" />

<img width="828" height="706" alt="image" src="https://github.com/user-attachments/assets/6bbcf5f9-9806-4f39-9df4-b823707236ac" />
<img width="649" height="338" alt="image" src="https://github.com/user-attachments/assets/56878a88-85ab-43f2-912d-f3035a34576a" />




La subnet debe aparecer dentro de `ecored-vcn` con CIDR `10.20.10.0/24` y capacidad de asignar IPv4 pública.

# Apoyo didáctico — Creación de la Subnet de EcoRed

## ¿Qué se está creando?

La **Subnet (subred)** es una subdivisión de la **VCN (Virtual Cloud Network — Red Virtual en la Nube)** donde se conectará la **OCI Container Instance** que ejecutará EcoRed.

```text
ecored-vcn
10.20.0.0/16
│
└── ecored-public-subnet
    10.20.10.0/24
        │
        ▼
OCI Container Instance
        │
        ▼
EcoRed
```

La VCN representa la red completa de EcoRed y la subnet reserva una parte de esa red para una función determinada.

---

## Configuración utilizada

```text
Name:
ecored-public-subnet

Compartment:
ecored-dev

Subnet Type:
Regional

IPv4 CIDR:
10.20.10.0/24

Subnet Access:
Public Subnet

DNS Resolution:
Enabled

Route Table:
Default Route Table for ecored-vcn

Security List:
Default Security List for ecored-vcn

DHCP Options:
Default DHCP Options for ecored-vcn
```

---

## Subnet Type: Regional

Se selecciona:

```text
Regional
```

Esto permite que la subnet pueda ser utilizada por recursos de la región sin limitarla innecesariamente a un único **AD (Availability Domain — Dominio de Disponibilidad)**.

Para EcoRed proporciona una red más flexible para la evolución posterior de la arquitectura.

---

## IPv4 CIDR: `10.20.10.0/24`

La VCN completa utiliza:

```text
10.20.0.0/16
```

y esta subnet utiliza una parte de ese rango:

```text
10.20.10.0/24
```

```text
VCN 10.20.0.0/16
│
├── 10.20.10.0/24  ← EcoRed inicialmente
├── 10.20.20.0/24  ← uso futuro
├── 10.20.30.0/24  ← uso futuro
└── ...
```

El `/24` proporciona un segmento suficientemente pequeño para los recursos de esta función y permite reservar otros rangos para componentes posteriores.

**Analogía:** la VCN es una ciudad y cada subnet es un barrio destinado a una función específica.

---

## ¿Por qué Public Subnet?

En el Taller 1, EcoRed debe ser accesible directamente desde Internet para comprobar que el contenedor funciona correctamente en OCI.

```text
Internet
   │
   ▼
IPv4 pública
   │
   ▼
ecored-public-subnet
   │
   ▼
Container Instance
   │
   ▼
EcoRed
```

Una subnet pública **no significa que todo el tráfico esté permitido**. Para que EcoRed pueda ser accedido deben existir conjuntamente:

```text
Subnet pública
      +
IPv4 pública
      +
Route Table
      +
Internet Gateway
      +
regla TCP :10000
```

---

## Route Table

La **Route Table (tabla de rutas)** determina por dónde debe viajar el tráfico.

Para acceder a Internet se utilizará:

```text
0.0.0.0/0
      ↓
Internet Gateway
```

Por tanto:

```text
Route Table = POR DÓNDE viaja el tráfico.
```

---

## Security List

La **Security List (lista de seguridad)** determina qué tráfico puede entrar o salir de la subnet.

EcoRed escucha en:

```text
TCP 10000
```

por lo que posteriormente se configurará una regla que permita acceder a ese puerto.

```text
Internet
   │
 TCP :10000
   ▼
Security List
   │
   ▼
EcoRed
```

Por tanto:

```text
Route Table   → por dónde viaja.
Security List → qué tráfico está permitido.
```

---

## DNS Resolution

Se mantiene:

```text
DNS Resolution: Enabled
```

**DNS (Domain Name System — Sistema de Nombres de Dominio)** permite resolver nombres de recursos en direcciones IP.

Esto será especialmente útil cuando EcoRed evolucione hacia múltiples servicios y Kubernetes, evitando depender directamente de direcciones IP.

---

## Relación con la arquitectura destino

En el Taller 1 se utiliza una subnet pública para simplificar el primer despliegue:

```text
Internet
   ↓
Subnet pública
   ↓
Container Instance
   ↓
EcoRed
```

Más adelante la arquitectura evolucionará hacia:

```text
Internet
   ↓
API Gateway / Load Balancer
   ↓
Subnets privadas
   ↓
OKE / Kubernetes
   ↓
Microservicios EcoRed
```

> **Idea clave:** la subnet permite dividir la red de EcoRed según la responsabilidad de cada componente. En este primer taller se utiliza una subnet pública para ejecutar y probar EcoRed; posteriormente la misma VCN será segmentada para soportar componentes públicos y privados de la arquitectura Cloud Native.



## Paso 2.3. Crear el Internet Gateway

Dentro de `ecored-vcn` abra:

```text
Internet Gateways
→ Create Internet Gateway
```

Configure:

```text
Name: ecored-igw
Compartment: ecored-dev
```

Seleccione **Create Internet Gateway**.

### paso a paso

<img width="679" height="679" alt="image" src="https://github.com/user-attachments/assets/3043b81c-18ea-4b56-8d86-06b80b141a1a" />

<img width="712" height="364" alt="image" src="https://github.com/user-attachments/assets/80efcf13-03f8-4adb-a8bf-8dc0515abe44" />
<img width="835" height="682" alt="image" src="https://github.com/user-attachments/assets/5e6371d6-7029-4c7b-a3c5-7248facb9c66" />


`ecored-igw` aparece asociado a `ecored-vcn`.

## Paso 2.4. Agregar la ruta hacia Internet

Abra:

```text
ecored-vcn
→ Route Tables
→ Default Route Table
→ Add Route Rules
```

Configure:

```text
Target Type: Internet Gateway
Destination Type: CIDR Block
Destination CIDR: 0.0.0.0/0
Target: ecored-igw
```

Guarde la regla.

### Paso a paso

<img width="938" height="496" alt="image" src="https://github.com/user-attachments/assets/10f53124-36ef-43d4-9705-c4a94d9227fd" />
<img width="1883" height="691" alt="image" src="https://github.com/user-attachments/assets/540eb1f6-aeb9-4a77-9493-57ea2f952096" />
<img width="1160" height="524" alt="image" src="https://github.com/user-attachments/assets/b65f66d2-61a7-4048-8902-254a228203e2" />




Debe existir:

```text
0.0.0.0/0 → ecored-igw
```

## Paso 2.5. Permitir el puerto de EcoRed

Abra:

```text
ecored-vcn
→ Security Lists
→ Default Security List
→ Add Ingress Rules
```

Configure:

```text
Stateless: No
Source Type: CIDR
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Source Port Range: All
Destination Port Range: 10000
Description: EcoRed HTTP laboratorio
```

Guarde la regla.

### Paso a Paso

<img width="1572" height="604" alt="image" src="https://github.com/user-attachments/assets/735bdca7-0284-466c-aecf-53b7300f515f" />
<img width="1660" height="567" alt="image" src="https://github.com/user-attachments/assets/39a93de8-3ce1-4692-89f9-4454728e4ece" />
<img width="1050" height="505" alt="image" src="https://github.com/user-attachments/assets/95ec7b7c-31fe-4dc2-a460-f766ec90f27a" />
<img width="1714" height="672" alt="image" src="https://github.com/user-attachments/assets/0d82dc98-89a3-47ff-afdc-729ce2b73db4" />



La Security List permite tráfico TCP hacia el puerto `10000`.

---

# Fase 3. Crear y publicar EcoRed con el asistente de OCI Container Instances

En esta fase se completa **todo el asistente de creación de OCI Container Instances**. No se debe abandonar el asistente después de configurar la red: la configuración de la imagen, variables de entorno, credencial Firebase, opciones de inicio y publicación del contenedor forman parte de la misma operación.

Oracle organiza actualmente el asistente en este orden:

```text
1. Basic information
       ↓
2. Networking
       ↓
3. Storage
       ↓
4. Containers
       ↓
5. Review Details
       ↓
Create
       ↓
Container Instance + contenedor EcoRed
```

La lógica es equivalente al despliegue anterior en Render:

| Render | OCI Container Instances |
|---|---|
| Web Service | Container Instance |
| Existing Image | External registry |
| Docker Hub image | Registry hostname + Repository + Tag |
| Environment Variables | Environmental variables |
| Secret File de Firebase | Variable temporal + creación del archivo al iniciar |
| Docker Command vacío porque la imagen ya tiene `CMD` | Startup options para reconstruir temporalmente el archivo Firebase y luego ejecutar `/start.sh` |
| Deploy Web Service | Review Details → Create |

En Render se utilizaron `PORT`, `DJANGO_DEBUG`, `DJANGO_SECRET_KEY`, `MONGODB_URI`, `MONGODB_DB_NAME` y `FIREBASE_CREDENTIALS_PATH`; las variables `VITE_*` no se agregaron porque ya quedaron incorporadas durante el build del frontend.

---

## Paso 3.1. Abrir el asistente

En OCI Console abra:

```text
Developer Services
→ Containers & Artifacts
→ Container Instances
```

Seleccione:

```text
Compartment: ecored-dev
```

y después:

```text
Create container instance
```

A partir de este punto complete el asistente hasta llegar a **Create**.

---

## Paso 3.2. Basic information — datos básicos de la Container Instance

En la sección **Basic information** configure:

```text
Name: ecored-ci
Create in compartment: ecored-dev
```

### Availability domain

Seleccione el dominio disponible en su región, por ejemplo:

```text
AD 1
```

Para esta práctica deje:

```text
Specify fault domain: Off
```

### Shape

Utilice una shape x86 compatible con la imagen `linux/amd64`. En la consola puede aparecer, por ejemplo:

```text
CI.Standard.E4.Flex
```

La shape determina la CPU y memoria disponibles para la Container Instance. Para esta primera práctica puede conservar la configuración propuesta por OCI si es compatible con la imagen.

### Containers Behavior

En:

```text
Container restart policy
```

seleccione:

```text
Always
```

Esta política es adecuada para EcoRed porque se trata de una aplicación web que debe permanecer ejecutándose.

No es necesario agregar Tags para completar esta práctica.

### Paso a paso

![Basic information](assets/fase3/01-basic-information.png)

---

## Paso 3.3. Networking — conectar la Container Instance a la red creada

Expanda la sección:

```text
Networking
```

### Virtual Network and Subnet

Seleccione:

```text
Primary network:
Select existing virtual cloud network
```

Configure:

```text
Virtual cloud network compartment: ecored-dev
Virtual cloud network: ecored-vcn
```

En **Subnet** seleccione:

```text
Select existing subnet

Subnet compartment: ecored-dev
Subnet: ecored-public-subnet (regional)
```

### Private IPv4 address

Deje el campo vacío. OCI asignará automáticamente una dirección IPv4 privada disponible dentro del CIDR:

```text
10.20.10.0/24
```

### Public IPv4 address

Seleccione:

```text
Assign a public IPv4 address
```

La IPv4 pública permitirá realizar posteriormente la prueba:

```text
http://<PUBLIC_IP>:10000
```

### Network Security

En la pantalla aparece:

```text
Use network security groups to control traffic
```

Déjelo:

```text
Off
```

Esta opción corresponde a **NSG (Network Security Group)**, no a la Security List. La regla TCP `10000` ya fue configurada en la fase anterior en la **Default Security List** asociada a `ecored-public-subnet`.

Por tanto:

```text
ecored-ci
   ↓
VNIC
   ↓
ecored-public-subnet
   ↓
Default Security List
   ↓
TCP :10000
```

### DNS Settings

Puede conservar:

```text
Assign a private DNS record
```

y permitir que OCI asigne el hostname correspondiente.

### Paso a paso

![Networking](assets/fase3/02-networking.png)

Antes de continuar confirme:

```text
VCN:          ecored-vcn
Subnet:       ecored-public-subnet (regional)
Public IPv4:  Assign a public IPv4 address
NSG:          Off
```

---

## Paso 3.4. Storage — continuar sin agregar almacenamiento adicional

La siguiente sección del asistente es:

```text
Storage
```

EcoRed no requiere agregar un volumen persistente para esta práctica. Los datos de negocio continúan almacenándose en MongoDB Atlas y la credencial Firebase será reconstruida al iniciar el contenedor.

Por tanto, deje:

```text
No items to display
```

y continúe con:

```text
Next
```

### Paso a paso

![Storage](assets/fase3/03-storage.png)

---

## Paso 3.5. Containers — agregar el contenedor EcoRed

En la sección:

```text
Containers
```

seleccione:

```text
Add container
```

Se abrirá el formulario **Add container**.

Configure:

```text
Name: ecored
```

### Paso a paso

![Add container](assets/fase3/04-add-container.png)

---

## Paso 3.6. Image — utilizar exactamente la imagen publicada en Docker Hub

En:

```text
Image
```

seleccione:

```text
Select image
```

Después seleccione:

```text
External registry
```

La consola actual solicita la imagen en tres campos separados. Configure:

```text
Registry hostname:
docker.io

Repository:
TU_USUARIO/ecored-circular

Tag:
v1.0
```

Como el repositorio utilizado en esta práctica es público:

```text
Registry credentials type:
None
```

La combinación representa exactamente:

```text
docker.io/TU_USUARIO/ecored-circular:v1.0
```

### Relación con Render

En Render se escribió una única referencia:

```text
docker.io/TU_USUARIO/ecored-circular:v1.0
```

OCI separa esa misma referencia:

```text
docker.io                     → Registry hostname
TU_USUARIO/ecored-circular    → Repository
v1.0                          → Tag
```

No se está construyendo una nueva imagen. OCI descargará el mismo artefacto ya validado en Docker Hub y Render.

Seleccione:

```text
Select image
```

para regresar al formulario **Add container**.

### Paso a paso

![External registry](assets/fase3/05-external-registry.png)

---

## Paso 3.7. Environmental variables — trasladar la configuración utilizada en Render

En Render se utilizó:

```text
Environment Variables
→ Add from .env
```

a partir de:

```text
backend/.env
```

En OCI Container Instances agregue las variables mediante:

```text
Environmental variables
→ + Another variable
```

Configure como mínimo:

| Variable | Valor |
|---|---|
| `PORT` | `10000` |
| `DJANGO_DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | `<mismo valor funcional usado en Render>` |
| `MONGODB_URI` | `<mismo valor funcional usado en Render>` |
| `MONGODB_DB_NAME` | `<mismo valor funcional usado en Render>` |
| `FIREBASE_CREDENTIALS_PATH` | `/etc/secrets/firebase-service-account.json` |

Si `backend/.env` contiene otras variables requeridas por EcoRed, agréguelas también.

### No agregar las variables `VITE_*`

Las variables:

```text
VITE_*
```

no deben volver a configurarse porque fueron procesadas durante:

```text
npm run build
```

y quedaron integradas en el frontend React compilado dentro de la imagen.

---

## Paso 3.8. Preparar la credencial Firebase utilizada anteriormente como Secret File

En Render se creó:

```text
Advanced
→ Secret Files
→ Add Secret File
```

con:

```text
firebase-service-account.json
```

y Render lo expuso en:

```text
/etc/secrets/firebase-service-account.json
```

Para conservar la misma ruta sin introducir otro servicio OCI en este primer taller, el JSON se entregará como variable y se reconstruirá como archivo cuando arranque el contenedor.

### Convertir el JSON a una sola línea

Desde PowerShell, en el proyecto EcoRed:

```powershell
(Get-Content .\backend\firebase-service-account.json -Raw |
  ConvertFrom-Json |
  ConvertTo-Json -Compress)
```

Copie el resultado completo.

En **Environmental variables** agregue:

```text
Name:
FIREBASE_SERVICE_ACCOUNT_JSON

Value:
<JSON completo en una sola línea>
```

Mantenga además:

```text
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-service-account.json
```

### Seguridad de la evidencia

No publique ni incluya en capturas los valores reales de:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
DJANGO_SECRET_KEY
MONGODB_URI
```

Esta adaptación se utiliza para mantener el laboratorio enfocado en Container Instances. La gestión de secretos con servicios especializados de OCI se abordará posteriormente.

---

## Paso 3.9. Startup options — reconstruir el archivo Firebase y ejecutar la imagen

La imagen de EcoRed ya contiene:

```text
CMD ["/start.sh"]
```

En Render se dejó **Docker Command** vacío para utilizar ese comando definido por la imagen.

En OCI se realizará una acción previa: reconstruir temporalmente:

```text
/etc/secrets/firebase-service-account.json
```

y después ejecutar el mismo:

```text
/start.sh
```

En **Startup options** configure:

```text
Command:
/bin/sh
```

Como argumentos configure:

```text
-c
```

y:

```text
mkdir -p /etc/secrets &&
printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > /etc/secrets/firebase-service-account.json &&
chmod 600 /etc/secrets/firebase-service-account.json &&
exec /start.sh
```

Conceptualmente:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
            │
            ▼
        /bin/sh -c
            │
            ▼
crea /etc/secrets/firebase-service-account.json
            │
            ▼
       exec /start.sh
            │
            ▼
      Nginx :10000
        │       │
      React   Gunicorn → Django
```

La imagen `docker.io/TU_USUARIO/ecored-circular:v1.0` no se modifica ni se reconstruye.

---

## Paso 3.10. Security — conservar la configuración compatible con la imagen actual

En la sección **Security** del contenedor conserve la configuración predeterminada para esta práctica.

Deje desactivados:

```text
Enable read-only root filesystem
Run as non-root user
```

El comando de inicio necesita crear:

```text
/etc/secrets/firebase-service-account.json
```

antes de ejecutar `/start.sh`.

Mantenga sin cambios las capacidades Linux predeterminadas.

### Paso a paso

![Container security](assets/fase3/06-container-security.png)

---

## Paso 3.11. Guardar el contenedor dentro del asistente

Después de comprobar:

```text
Name: ecored

Image:
docker.io/TU_USUARIO/ecored-circular:v1.0

Environmental variables:
PORT
DJANGO_DEBUG
DJANGO_SECRET_KEY
MONGODB_URI
MONGODB_DB_NAME
FIREBASE_CREDENTIALS_PATH
FIREBASE_SERVICE_ACCOUNT_JSON

Startup options:
creación del archivo Firebase
+
exec /start.sh
```

seleccione el botón que guarda/agrega el contenedor al asistente.

Debe regresar a **Containers** y observar el contenedor:

```text
ecored
```

---

## Paso 3.12. Review Details — revisar antes de publicar

Seleccione:

```text
Next
```

hasta llegar a:

```text
Review Details
```

Revise la configuración completa.

### Container Instance

```text
Name: ecored-ci
Compartment: ecored-dev
Restart policy: Always
```

### Networking

```text
VCN: ecored-vcn
Subnet: ecored-public-subnet
Public IPv4 address: Yes
```

### Container

```text
Name: ecored
Registry hostname: docker.io
Repository: TU_USUARIO/ecored-circular
Tag: v1.0
```

### Aplicación

Confirme:

```text
PORT=10000
DJANGO_DEBUG=False
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-service-account.json
```

y compruebe que existen, sin exponer sus valores reales:

```text
DJANGO_SECRET_KEY
MONGODB_URI
MONGODB_DB_NAME
FIREBASE_SERVICE_ACCOUNT_JSON
```

---

## Paso 3.13. Create — publicar EcoRed

Seleccione:

```text
Create
```

Este botón completa el asistente.

OCI realizará automáticamente:

```text
Docker Hub
    │ pull
    ▼
docker.io/TU_USUARIO/ecored-circular:v1.0
    │
    ▼
OCI Container Instance: ecored-ci
    │
    ▼
Container: ecored
    │
    ▼
Startup options
    │
    ▼
/start.sh
    │
    ▼
EcoRed
```

No se ejecutan manualmente `docker pull` ni `docker run`: OCI Container Instances descarga y despliega la imagen como parte de la creación del recurso.

---

## Paso 3.14. Esperar a que la publicación finalice

Espere hasta observar:

```text
Container Instance: ecored-ci
State: Active
```

Abra:

```text
ecored-ci
→ Containers
```

y compruebe que existe:

```text
ecored
```

Después, en los detalles de la VNIC, registre:

```text
PUBLIC_IP=<IPv4 pública asignada por OCI>
```

### Verificación final de la Fase 3

La fase termina cuando se cumplen:

```text
1. ecored-ci está Active
2. el contenedor ecored fue creado
3. la imagen procede de Docker Hub
4. existe una IPv4 pública asignada
```

En este momento la **publicación del contenedor en OCI ha finalizado**. La siguiente fase se dedica únicamente a validar el funcionamiento de EcoRed.

---

# Fase 4. Validar y operar EcoRed en OCI

Esta fase comienza después de terminar el asistente y publicar `ecored-ci`. Utilice la `PUBLIC_IP` registrada al final de la Fase 3.


## Paso 4.1. Probar el health endpoint

Abra:

```text
http://<PUBLIC_IP>:10000/api/health/
```

Resultado esperado:

```json
{"status":"ok"}
```

## Paso 4.2. Probar el frontend

Abra:

```text
http://<PUBLIC_IP>:10000
```

Debe cargar la interfaz de EcoRed.

## Paso 4.3. Consultar logs desde OCI

Abra:

```text
Container Instances
→ ecored-ci
→ Containers
→ ecored
→ Actions
→ View logs
```

Use los logs para verificar el arranque de Nginx, Gunicorn y Django y para diagnosticar errores de configuración.

## Paso 4.4. Ejecutar diagnóstico mínimo

Si la Container Instance está `Active` pero la aplicación no responde, revise en este orden:

```text
1. IPv4 pública asignada
2. ecored-public-subnet
3. 0.0.0.0/0 → ecored-igw
4. Security List TCP 10000
5. logs del contenedor
6. variables de entorno
7. conexión con MongoDB Atlas y Firebase
```

## Paso 4.5. Probar independencia del computador local

1. Compruebe que EcoRed responde desde OCI.
2. Detenga Docker Desktop o apague el computador utilizado para construir la imagen.
3. Desde otro dispositivo acceda nuevamente a:

```text
http://<PUBLIC_IP>:10000
```

EcoRed debe continuar ejecutándose en OCI.

## Paso 4.6. Probar Restart

Abra:

```text
Container Instances
→ ecored-ci
→ Actions
→ Restart
```

Espere nuevamente `State: Active` y pruebe:

```text
http://<PUBLIC_IP>:10000/api/health/
```

## Paso 4.7. Probar Stop y Start

Detenga la instancia:

```text
Container Instances
→ ecored-ci
→ Actions
→ Stop
```

Espere:

```text
State: Inactive
```

Iníciela nuevamente:

```text
Actions
→ Start
```

Espere:

```text
State: Active
```

Vuelva a probar el endpoint de salud.

---

# Entregables

- [ ] Nombre de la tenancy identificado.
- [ ] Región de trabajo registrada.
- [ ] Compartment `ecored-dev` en estado `Active`.
- [ ] Evidencia de revisión inicial de costos/créditos.
- [ ] VCN `ecored-vcn` con CIDR `10.20.0.0/16`.
- [ ] Subnet pública `ecored-public-subnet` con CIDR `10.20.10.0/24`.
- [ ] Internet Gateway `ecored-igw`.
- [ ] Route Table con `0.0.0.0/0 → ecored-igw`.
- [ ] Security List permitiendo TCP `10000`.
- [ ] Container Instance `ecored-ci`.
- [ ] Contenedor `ecored` creado desde `docker.io/TU_USUARIO/ecored-circular:v1.0`.
- [ ] Variables de entorno configuradas.
- [ ] Evidencia de `State: Active`.
- [ ] Evidencia de `http://<PUBLIC_IP>:10000/api/health/`.
- [ ] Evidencia del frontend cargando.
- [ ] Evidencia de consulta de logs.
- [ ] Evidencia de Restart exitoso.
- [ ] Evidencia de Stop → Start → Active.
- [ ] Evidencia de acceso con el computador local fuera de ejecución.
- [ ] Diagrama del resultado del taller señalando su posición dentro de la arquitectura destino.

# Contrato de entrada para el Taller 2

Conserve:

```text
ecored-dev
├── ecored-vcn
│   ├── ecored-public-subnet
│   ├── ecored-igw
│   ├── Default Route Table
│   └── Default Security List
└── ecored-ci

Docker Hub
└── TU_USUARIO/ecored-circular:v1.0
```

El Taller 2 utilizará estos recursos para incorporar el registro de contenedores de OCI y construir la conectividad privada que utilizarán los workloads posteriores.

# Referencias oficiales

- OCI Account and Access Concepts: https://docs.oracle.com/en-us/iaas/Content/GSG/Concepts/concepts-account.htm
- Creating and Managing Compartments: https://docs.oracle.com/en-us/iaas/Content/Identity/Tasks/managingcompartments.htm
- Overview of Container Instances: https://docs.oracle.com/en-us/iaas/Content/container-instances/overview-of-container-instances.htm
- Creating a Container Instance: https://docs.oracle.com/en-us/iaas/Content/container-instances/creating-a-container-instance.htm
- Starting a Container Instance: https://docs.oracle.com/en-us/iaas/Content/container-instances/starting-a-container-instance.htm
- Stopping a Container Instance: https://docs.oracle.com/en-us/iaas/Content/container-instances/stopping-a-container-instance.htm
- Restarting a Container Instance: https://docs.oracle.com/en-us/iaas/Content/container-instances/restarting-a-container-instance.htm
- Retrieving Logs for a Container Instance: https://docs.oracle.com/en-us/iaas/Content/container-instances/retrieve-logs.htm
- Public Subnet Scenario: https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/scenarioa.htm

---

[← Taller base: Docker Hub + Render](https://github.com/adanbeltran/Taller12factors/blob/main/docs/F-Contenizacion-Despliegue-web-en-Render.md) | [Índice de la ruta](README.md) | [Taller 2 →](02-OCIR-y-Networking-Privado.md)
