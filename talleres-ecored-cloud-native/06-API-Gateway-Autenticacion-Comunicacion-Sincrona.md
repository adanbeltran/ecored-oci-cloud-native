# Taller 6. Puerta de enlace, autenticación y comunicación síncrona de EcoRed

[← Taller 5](05-Descomposicion-EcoRed-en-Microservicios.md) | [Índice de la ruta](README.md) | [Taller 7 →](07-Arquitectura-Event-Driven-OCI-Streaming.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **OKE — Oracle Kubernetes Engine:** Motor Kubernetes de Oracle.
- **JWT — JSON Web Token:** Token Web JSON.
- **CORS — Cross-Origin Resource Sharing:** Intercambio de Recursos entre Orígenes.
- **IAM — Identity and Access Management:** Gestión de Identidad y Acceso.
- **VCN — Virtual Cloud Network:** Red Virtual en la Nube.
- **HTTP — Hypertext Transfer Protocol:** Protocolo de Transferencia de Hipertexto.
- **HTTPS — Hypertext Transfer Protocol Secure:** Protocolo Seguro de Transferencia de Hipertexto.
- **URL — Uniform Resource Locator:** Localizador Uniforme de Recursos.
- **JWKS — JSON Web Key Set:** Conjunto de Claves Web JSON.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye la **capa de acceso** de la arquitectura destino. Los clientes dejan de depender de endpoints individuales y acceden a los microservicios a través de un gateway con rutas, autenticación y políticas de tráfico.

**Bloques de la arquitectura destino trabajados en este taller:**

- API Gateway
- Enrutamiento hacia microservicios
- Validación JWT
- CORS y rate limiting
- Comunicación síncrona request-response

**Proyecto:** EcoRed Circular  
**Problema:** múltiples microservicios ya existen, pero los clientes no deben conocer sus IP, puertos ni topología interna.

# 1. Propósito

Crear un punto único y gobernado para el tráfico HTTP/S de EcoRed mediante **OCI API Gateway**, mantener Firebase como proveedor de identidad de usuarios finales en esta etapa y enrutar solicitudes hacia los servicios desplegados en OKE.





# 2. Objetivo

```text
Web React / App móvil / Portal
            │
            │ JWT
            ▼
      OCI API Gateway
            │
     ┌──────┼─────────┐
     ▼      ▼         ▼
 Empresas Materiales Actores ...
            │
            ▼
           OKE
```

# 3. Conceptos nuevos

- **API Gateway:** front door de APIs con routing, políticas y controles comunes.
- **deployment de API:** especificación de rutas/backend publicada en un gateway.
- **JWT:** token firmado usado para transportar claims de identidad/autorización.
- **IdP — Identity Provider:** proveedor de identidad; EcoRed conserva Firebase Authentication para usuarios finales.
- **CORS:** política del navegador sobre solicitudes entre orígenes.
- **rate limiting:** restricción de solicitudes para proteger APIs.
- **backend privado:** endpoint no expuesto directamente a Internet al que el gateway puede acceder desde la red configurada.

# Fase 1. Preparar un backend único de entrada a OKE

## Paso 1.1. Confirmar microservicios internos

```bash
kubectl get svc -n ecored
```

Los servicios de dominio deben ser `ClusterIP`.

## Paso 1.2. Crear un Ingress o Service privado para las rutas internas

Utilice el mecanismo de entrada compatible con OKE definido por el docente (por ejemplo, OCI Native Ingress Controller o un Load Balancer privado) para obtener **un backend privado** dentro de la VCN.

Rutas mínimas:

```text
/empresas   → empresas-service
/materiales → materiales-service
/actores    → actores-service
```

### Verificación

Desde la VCN o una herramienta autorizada, el backend privado enruta correctamente.

## Paso 1.3. Registrar endpoint privado

```text
OKE_PRIVATE_BACKEND=<IP-o-hostname-privado>
```

No publique directamente este endpoint a usuarios finales.

# Fase 2. Crear OCI API Gateway

## Paso 2.1. Crear el gateway

Abra:

```text
Developer Services → API Management → Gateways → Create Gateway
```

Configure:

```text
Name: ecored-api-gateway
Compartment: ecored-dev
VCN: ecored-vcn
Subnet: una subnet apropiada del diseño
Endpoint type: Public para el acceso de clientes de laboratorio
```

### Verificación

Gateway en estado `Active`.

## Paso 2.2. Crear el deployment de rutas

Cree un API Deployment:

```text
Name: ecored-api-v1
Path prefix: /api/v1
```

Defina rutas:

```text
/empresas
/materiales
/actores
```

Cada ruta debe usar como backend el endpoint privado/entrada de OKE correspondiente.

### Verificación

```text
GET https://<GATEWAY>/api/v1/empresas
```

alcanza el microservicio correcto.

## Paso 2.3. Configurar CORS

Permita únicamente los orígenes de frontend requeridos para el laboratorio/producción. Evite `*` cuando se envían credenciales o cuando la política de seguridad exige orígenes específicos.

### Verificación

El frontend puede invocar la API sin errores CORS.

# Fase 3. Integrar autenticación JWT

## Paso 3.1. Confirmar Firebase Authentication

Mantenga el proyecto Firebase del EcoRed original. El frontend debe obtener un token de identidad válido al autenticarse.

### Verificación

El navegador puede obtener un token y enviarlo como:

```text
Authorization: Bearer <JWT>
```

## Paso 3.2. Configurar validación/autorización en API Gateway

Configure el mecanismo JWT soportado por API Gateway con el emisor y claves públicas/JWKS correspondientes al proveedor de identidad usado por EcoRed.

No almacene claves privadas de Firebase en el gateway.

### Verificación

- solicitud sin token → rechazada;
- token inválido → rechazada;
- token válido → enrutada.

## Paso 3.3. Diferenciar IAM de autenticación de usuarios

Documente:

```text
OCI IAM
→ quién administra recursos OCI

Firebase Authentication
→ quién es el usuario final de EcoRed
```

No combine ambos modelos en una única lista de roles.

# Fase 4. Aplicar políticas y validar comunicación síncrona

## Paso 4.1. Configurar rate limiting básico

Agregue una política de limitación apropiada para laboratorio. Documente el umbral utilizado.

## Paso 4.2. Probar las tres rutas

Ejecute pruebas con token válido:

```text
GET /api/v1/empresas
GET /api/v1/materiales
GET /api/v1/actores
```

### Verificación

Cada ruta responde desde el microservicio esperado.

## Paso 4.3. Actualizar el frontend

Configure EcoRed para consumir **una sola URL base**:

```text
VITE_API_BASE_URL=https://<API_GATEWAY>/api/v1
```

Reconstruya la imagen frontend cuando corresponda, ya que variables `VITE_*` se resuelven durante el build.

## Paso 4.4. Diagramar el recorrido de una petición

```text
Usuario
→ React
→ JWT
→ API Gateway
→ backend privado OKE
→ Kubernetes Service
→ Pod del microservicio
```

# Entregables

- [ ] `ecored-api-gateway` activo.
- [ ] Deployment `/api/v1`.
- [ ] Rutas Empresas, Materiales y Actores.
- [ ] Backend OKE no expuesto directamente como API pública de usuarios.
- [ ] CORS configurado.
- [ ] JWT validado.
- [ ] Pruebas con token ausente, inválido y válido.
- [ ] Rate limiting documentado.
- [ ] Frontend consumiendo una única URL base.
- [ ] Diagrama request-response completo.

# Contrato de entrada para el Taller 7

El sistema ya resuelve comunicación **síncrona**. El siguiente taller agrega procesos que no requieren que el emisor espere una respuesta directa.

# Referencias oficiales

- API Gateway overview: https://docs.oracle.com/en-us/iaas/Content/APIGateway/Concepts/apigatewayoverview.htm
- Create API Gateway: https://docs.oracle.com/en-us/iaas/Content/APIGateway/Tasks/apigatewaycreatinggateway.htm
- API Gateway home: https://docs.oracle.com/en-us/iaas/Content/APIGateway/home.htm
- Firebase Google sign-in: https://firebase.google.com/docs/auth/web/google-signin


---

[← Taller 5](05-Descomposicion-EcoRed-en-Microservicios.md) | [Índice de la ruta](README.md) | [Taller 7 →](07-Arquitectura-Event-Driven-OCI-Streaming.md)
