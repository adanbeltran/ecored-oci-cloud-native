# Taller 7. Arquitectura dirigida por eventos de EcoRed con Oracle Cloud Infrastructure Streaming

[← Taller 6](06-API-Gateway-Autenticacion-Comunicacion-Sincrona.md) | [Índice de la ruta](README.md) | [Taller 8 →](08-Persistencia-Distribuida-y-Servicios-Administrados.md)

## Siglas utilizadas en este taller

La primera aparición de cada sigla se define aquí; a partir de este punto se utiliza directamente.

- **OCI — Oracle Cloud Infrastructure:** Infraestructura de Nube de Oracle.
- **API — Application Programming Interface:** Interfaz de Programación de Aplicaciones.
- **REST — Representational State Transfer:** Transferencia de Estado Representacional.
- **SDK — Software Development Kit:** Kit de Desarrollo de Software.
- **VCN — Virtual Cloud Network:** Red Virtual en la Nube.
- **JSON — JavaScript Object Notation:** Notación de Objetos de JavaScript.

## Relación con la arquitectura destino

[Ver arquitectura destino de EcoRed](assets/arquitectura-destino-ecored.png)

Este taller construye la capa de **integración asíncrona** de la arquitectura destino. Los microservicios publican eventos de dominio en OCI Streaming y otros servicios los consumen sin acoplar el productor a una llamada síncrona directa.

**Bloques de la arquitectura destino trabajados en este taller:**

- Event Bus
- Productores de eventos
- Consumidores de eventos
- Eventos de dominio de EcoRed
- Procesamiento asíncrono desacoplado

**Proyecto:** EcoRed Circular  
**Cambio:** complementar REST síncrono con integración asíncrona y desacoplada.

# 1. Propósito

Implementar un **Event Bus** para eventos de dominio de EcoRed utilizando OCI Streaming. El primer flujo obligatorio será `MaterialPublicado`; después se incorporan otros eventos de la arquitectura objetivo.





# 2. Objetivo

```text
materiales-service
      │
      │ MaterialPublicado
      ▼
 OCI Streaming
      │
      ├──► catalogo-service
      ├──► notificaciones-service
      └──► impacto-service
```

# 3. Conceptos nuevos

- **event:** hecho ocurrido en el dominio, expresado en pasado.
- **producer:** publica eventos.
- **consumer:** procesa eventos.
- **stream:** log particionado y append-only de mensajes.
- **partition:** división que permite escalabilidad y orden por partición.
- **consumer group:** consumidores que coordinan lectura.
- **publish/subscribe:** productores y consumidores están desacoplados temporalmente.
- **idempotencia:** procesar el mismo evento más de una vez no debe producir efectos duplicados incorrectos.

# Fase 1. Diseñar el contrato de eventos

## Paso 1.1. Definir `MaterialPublicado`

Cree `docs/events/MaterialPublicado-v1.json` como ejemplo **sin datos sensibles**:

```json
{
  "eventId": "uuid",
  "eventType": "MaterialPublicado",
  "eventVersion": 1,
  "occurredAt": "2026-08-19T12:00:00Z",
  "materialId": "mat-123",
  "empresaId": "emp-456"
}
```

## Paso 1.2. Definir reglas de evolución

Documente:

- `eventId` único;
- `eventType` estable;
- `eventVersion` explícita;
- no incluir contraseñas/tokens;
- nuevos campos preferiblemente opcionales para compatibilidad.

## Paso 1.3. Definir eventos siguientes

```text
EmpresaRegistrada
SolicitudCreada
MatchGenerado
NotificacionEnviada
MaterialAprovechado
```

No es obligatorio implementarlos todos en la primera iteración.

# Fase 2. Crear OCI Streaming

## Paso 2.1. Crear Stream Pool

Abra:

```text
Analytics & AI / Messaging → Streaming
```

Cree:

```text
Stream Pool: ecored-events-pool
Compartment: ecored-dev
```

Use opciones de red/seguridad compatibles con la VCN y el alcance del laboratorio.

## Paso 2.2. Crear el stream

Cree:

```text
Name: ecored-domain-events
Partitions: 1 para el laboratorio inicial
Retention: valor mínimo/adecuado permitido y documentado
```

### Verificación

El stream aparece `Active`.

## Paso 2.3. Registrar endpoint e identificadores

Guarde en `oci-lab-params.example`:

```text
STREAM_OCID=<ocid>
STREAM_MESSAGES_ENDPOINT=<endpoint>
```

No registre Auth Tokens.

# Fase 3. Implementar productor y consumidor

## Paso 3.1. Agregar OCI SDK al servicio Materiales

En `services/materiales/requirements.txt` agregue el SDK OCI compatible:

```text
oci
```

Implemente un módulo `events.py` que publique el JSON `MaterialPublicado` después de una creación exitosa.

Para laboratorio puede utilizar una credencial autorizada inyectada como Secret. En el Taller 9 se migrará a identidad de workload cuando sea posible.

## Paso 3.2. Publicar evento después del commit de negocio

La secuencia correcta debe ser conceptualmente:

```text
POST material
→ persistir material
→ confirmar operación
→ publicar MaterialPublicado
```

No publique un evento de éxito si la operación de negocio falló.

## Paso 3.3. Crear consumidor Catálogo

Cree o habilite `catalogo-service` para leer el stream y registrar/indexar el material recibido.

Debe almacenar `eventId` procesados o implementar una estrategia equivalente de idempotencia.

## Paso 3.4. Crear consumidor Notificaciones

Cree `notificaciones-service` para que consuma el mismo evento y registre:

```text
MaterialPublicado recibido: <eventId>
```

No es obligatorio enviar correo real todavía.

# Fase 4. Validar desacoplamiento y fallos

## Paso 4.1. Publicar un material

Use API Gateway:

```text
POST /api/v1/materiales
```

### Verificación

- Materiales responde al cliente.
- El evento aparece en el stream.
- Catálogo lo procesa.
- Notificaciones lo procesa.

## Paso 4.2. Detener un consumidor

Escálelo temporalmente a cero:

```bash
kubectl scale deployment notificaciones --replicas=0 -n ecored
```

Publique otro material.

### Verificación

El productor continúa funcionando aunque Notificaciones esté detenido.

## Paso 4.3. Reactivar consumidor

```bash
kubectl scale deployment notificaciones --replicas=1 -n ecored
```

Compruebe que retoma eventos disponibles según la estrategia de consumo/retención.

## Paso 4.4. Comparar síncrono y asíncrono

Documente en una tabla:

| Caso | REST síncrono | Evento asíncrono |
|---|---|---|
| Consulta de empresa | Sí | No |
| Publicación de material | comando síncrono | notificación posterior |
| Actualizar catálogo | puede desacoplarse | Sí |
| Enviar alerta | no bloquear al usuario | Sí |

# Entregables

- [ ] Stream Pool `ecored-events-pool`.
- [ ] Stream `ecored-domain-events`.
- [ ] Contrato `MaterialPublicado-v1`.
- [ ] Productor en Materiales.
- [ ] Dos consumidores independientes.
- [ ] Evidencia de idempotencia o control de duplicados.
- [ ] Prueba con consumidor detenido y reactivado.
- [ ] Diagrama REST + Event Bus.

# Contrato de entrada para el Taller 8

Los microservicios ya intercambian información mediante APIs y eventos. El siguiente problema es impedir que compartan una misma persistencia y agregar servicios especializados de datos.

# Referencias oficiales

- OCI Streaming overview: https://docs.oracle.com/en-us/iaas/Content/Streaming/Concepts/streamingoverview.htm
- Streaming home: https://docs.oracle.com/en-us/iaas/Content/Streaming/home.htm
- Managing Streams: https://docs.oracle.com/en-us/iaas/Content/Streaming/Tasks/managingstreams.htm
- Developer Guide: https://docs.oracle.com/en-us/iaas/Content/Streaming/Tasks/developing.htm
- Streaming security: https://docs.oracle.com/en-us/iaas/Content/Streaming/Concepts/streamsecurity.htm


---

[← Taller 6](06-API-Gateway-Autenticacion-Comunicacion-Sincrona.md) | [Índice de la ruta](README.md) | [Taller 8 →](08-Persistencia-Distribuida-y-Servicios-Administrados.md)
