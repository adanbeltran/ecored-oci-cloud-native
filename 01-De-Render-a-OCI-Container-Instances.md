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
```

Seleccione **Create VCN**.

### Paso a paso
<img width="675" height="489" alt="image" src="https://github.com/user-attachments/assets/b0c5f474-e896-4c85-877f-9f9ace278518" />
<img width="711" height="410" alt="image" src="https://github.com/user-attachments/assets/666b9cd0-1117-4eed-b920-857bd67fe22f" />
<img width="611" height="762" alt="image" src="https://github.com/user-attachments/assets/288095ff-79db-4572-967c-97e70b1b4b16" />
<img width="858" height="507" alt="image" src="https://github.com/user-attachments/assets/75a582c6-822e-4547-b5bb-045617bfe21e" />
<img width="1569" height="282" alt="image" src="https://github.com/user-attachments/assets/f9df3747-3b38-4430-8345-e91aafc37515" />


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

La subnet debe aparecer dentro de `ecored-vcn` con CIDR `10.20.10.0/24` y capacidad de asignar IPv4 pública.

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

### Verificación

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

### Verificación

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

### Verificación

La Security List permite tráfico TCP hacia el puerto `10000`.

---

# Fase 3. Crear la Container Instance

## Paso 3.1. Abrir Container Instances

En OCI Console abra:

```text
Developer Services
→ Containers & Artifacts
→ Container Instances
```

Seleccione el compartment `ecored-dev` y después **Create container instance**.

## Paso 3.2. Configurar datos básicos y placement

Configure:

```text
Name: ecored-ci
Create in Compartment: ecored-dev
Availability Domain: <disponible en la región>
Fault Domain: Automatic
```

## Paso 3.3. Seleccionar una shape compatible

La imagen existente es `linux/amd64`. Seleccione una shape x86 compatible disponible para Container Instances.

Como punto inicial de laboratorio, configure recursos suficientes para ejecutar EcoRed; por ejemplo:

```text
OCPU: 1
Memory: 2 GB
```

Registre la shape finalmente utilizada.

## Paso 3.4. Configurar networking

En **Networking** seleccione:

```text
Virtual Cloud Network: ecored-vcn
Subnet: ecored-public-subnet
Public IPv4 address: Assign a public IPv4 address
```

Use la Security List configurada en la subnet para el acceso al puerto `10000`.

## Paso 3.5. Configurar la política de reinicio

En las opciones avanzadas del Container Instance configure:

```text
Container restart policy: Always
```

### Verificación de la fase

Antes de continuar confirme:

```text
Container Instance: ecored-ci
Compartment: ecored-dev
VCN: ecored-vcn
Subnet: ecored-public-subnet
Public IPv4: Yes
Restart policy: Always
```

---

# Fase 4. Configurar y crear el contenedor EcoRed

## Paso 4.1. Definir nombre e imagen

En **Configure containers** configure:

```text
Name: ecored
Image source: External registry
Image: docker.io/TU_USUARIO/ecored-circular:v1.0
```

### Verificación

La imagen seleccionada coincide exactamente con la publicada y probada en Docker Hub.

## Paso 4.2. Configurar variables de entorno

Agregue las variables requeridas por el backend, utilizando los mismos valores funcionales del despliegue anterior:

```text
PORT=10000
DJANGO_DEBUG=False
DJANGO_SECRET_KEY=<valor real>
MONGODB_URI=<valor real>
MONGODB_DB_NAME=<valor real>
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-service-account.json
```

Agregue cualquier otra variable del backend requerida por EcoRed.

## Paso 4.3. Preparar la credencial Firebase como variable

Desde PowerShell, en el proyecto EcoRed, convierta el archivo a una sola línea:

```powershell
(Get-Content .\backend\firebase-service-account.json -Raw |
  ConvertFrom-Json |
  ConvertTo-Json -Compress)
```

Copie el resultado y configure en Container Instances:

```text
FIREBASE_SERVICE_ACCOUNT_JSON=<json-completo-en-una-linea>
```

Mantenga:

```text
FIREBASE_CREDENTIALS_PATH=/etc/secrets/firebase-service-account.json
```

No publique el contenido del JSON en Git, capturas o entregables.

## Paso 4.4. Configurar Startup options

Configure:

```text
Command:
/bin/sh
```

Argumento inicial:

```text
-c
```

Comando:

```text
mkdir -p /etc/secrets &&
printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" > /etc/secrets/firebase-service-account.json &&
chmod 600 /etc/secrets/firebase-service-account.json &&
exec /start.sh
```

El flujo de arranque será:

```text
FIREBASE_SERVICE_ACCOUNT_JSON
            │
            ▼
archivo efímero
/etc/secrets/firebase-service-account.json
            │
            ▼
/start.sh
            │
            ▼
Nginx + Gunicorn + Django + React
```

## Paso 4.5. Crear la Container Instance

Revise:

```text
Container Instance: ecored-ci
Container: ecored
Image: docker.io/TU_USUARIO/ecored-circular:v1.0
Network: ecored-vcn
Subnet: ecored-public-subnet
Public IPv4: Yes
Restart policy: Always
```

Seleccione **Create**.

## Paso 4.6. Esperar el estado `Active`

OCI descargará la imagen, creará el contenedor y ejecutará el comando de inicio. Espere hasta que la Container Instance muestre:

```text
State: Active
```

## Paso 4.7. Registrar la IPv4 pública

Abra:

```text
ecored-ci
→ Details
```

Localice la VNIC y registre:

```text
PUBLIC_IP=<IPv4 pública asignada>
```

### Verificación de la fase

La Container Instance está `Active`, tiene IPv4 pública y el contenedor `ecored` aparece ejecutándose.

---

# Fase 5. Validar y operar EcoRed en OCI

## Paso 5.1. Probar el health endpoint

Abra:

```text
http://<PUBLIC_IP>:10000/api/health/
```

Resultado esperado:

```json
{"status":"ok"}
```

## Paso 5.2. Probar el frontend

Abra:

```text
http://<PUBLIC_IP>:10000
```

Debe cargar la interfaz de EcoRed.

## Paso 5.3. Consultar logs desde OCI

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

## Paso 5.4. Ejecutar diagnóstico mínimo

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

## Paso 5.5. Probar independencia del computador local

1. Compruebe que EcoRed responde desde OCI.
2. Detenga Docker Desktop o apague el computador utilizado para construir la imagen.
3. Desde otro dispositivo acceda nuevamente a:

```text
http://<PUBLIC_IP>:10000
```

EcoRed debe continuar ejecutándose en OCI.

## Paso 5.6. Probar Restart

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

## Paso 5.7. Probar Stop y Start

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
