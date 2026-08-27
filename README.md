# Monitoreo de calidad del agua

Aplicación de demostración para el monitoreo en tiempo real de la calidad del
agua. Los sensores reportan lotes parciales de mediciones, se consolidan en una
base de datos PostgreSQL y los navegadores conectados reciben las actualizaciones
al instante a través de Redis y Socket.IO.

Este repositorio es un monorepo de **pnpm** que contiene el cliente Next.js, un
servicio de tiempo real independiente y los paquetes compartidos de contratos y
acceso a datos.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Arquitectura](#arquitectura)
  - [Estructura del monorepo](#estructura-del-monorepo)
  - [Componentes y responsabilidades](#componentes-y-responsabilidades)
  - [Flujo de datos](#flujo-de-datos)
  - [Modelo de datos](#modelo-de-datos)
  - [Contratos y eventos](#contratos-y-eventos)
- [Requisitos previos](#requisitos-previos)
- [Primeros pasos](#primeros-pasos)
- [Comandos](#comandos)
- [Variables de entorno](#variables-de-entorno)
- [API REST](#api-rest)
- [Tiempo real (Socket.IO)](#tiempo-real-socketio)
- [Base de datos](#base-de-datos)
- [Pruebas](#pruebas)
- [Calidad de código](#calidad-de-código)
- [Decisiones de diseño y trade-offs](#decisiones-de-diseño-y-trade-offs)
- [Trabajo futuro para producción](#trabajo-futuro-para-producción)

---

## Descripción general

AquaSense recibe lecturas de sensores de agua, las valida, las persiste de forma
idempotente y las difunde en tiempo real únicamente a los clientes suscritos al
sensor afectado. La interfaz muestra un mapa con las estaciones de monitoreo y
un detalle con los parámetros fisicoquímicos y microbiológicos medidos.

## Arquitectura

### Estructura del monorepo

```text
apps/
  client/       Aplicación Next.js (UI, API de ingesta y consulta de sensores)
  realtime/     Servicio de tiempo real (Express + Socket.IO)
packages/
  contract/     Contratos y esquemas Zod compartidos
  db/           Esquema Drizzle, migraciones, datos semilla y repositorios
```

### Componentes y responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| `apps/client` | UI (mapa y detalle de sensores), API REST de ingesta (`POST /api/sensors/readings`) y consulta (`GET /api/sensors/:sensorId`). Tras persistir, publica la instantánea en Redis. |
| `apps/realtime` | Servicio Express con Socket.IO. Escucha Redis (adapter) y reenvía `sensor:snapshot` a las salas de sensores. Expone `/health`. |
| `packages/contract` | Esquemas Zod (`sensorSnapshot`, `sensorReadingInput`, autenticación de socket), tipos de eventos y utilidades (`sensorRoomName`, `isSensorUuid`). |
| `packages/db` | Único dueño de Drizzle, la conexión PostgreSQL, el esquema, las migraciones, el seed y los repositorios (`getAllSensorSnapshots`, `getSensorSnapshot`, `ingestSensorReading`). |

El paquete `@ana-contest-demo/db` es el único punto de acceso a la base de datos:
ni el cliente ni el servicio de tiempo real contienen SQL ni configuran Drizzle
por su cuenta.

### Flujo de datos

```text
                          ┌─────────────┐
                          │   Sensor    │
                          └──────┬──────┘
                                 │ POST /api/sensors/readings
                                 ▼
                    ┌──────────────────────────┐
                    │  Next.js (apps/client)    │
                    │  1. valida (Zod)          │
                    │  2. persiste (db pkg)     │
                    │  3. publica (redis-emitter│
                    └─────────┬────────────────┘
                              │ Redis Pub/Sub (canal con prefijo compartido)
                              ▼
                    ┌──────────────────────────┐
                    │  Realtime (apps/realtime) │
                    │  Socket.IO + redis-adapter│
                    │  sala sensor:<uuid>       │
                    └─────────┬────────────────┘
                              │ socket.io (sensor:snapshot)
                              ▼
                         Navegador
```

1. El sensor envía un lote **parcial** de mediciones a `POST /api/sensors/readings`.
2. El cliente valida el payload con `sensorReadingInputSchema` (Zod) y lo persiste
   en una transacción mediante `ingestSensorReading`.
3. Si la publicación a Redis falla (Redis no listo), se responde `503
   realtime_unavailable`; como la ingesta es idempotente, reintentar es seguro.
4. El servicio de tiempo real, suscrito al mismo canal de Redis, reenvía el
   evento `sensor:snapshot` a la sala `sensor:<uuid>`.
5. El navegador fusiona la instantánea entrante con el estado actual y conserva
   la lectura más reciente por parámetro.

### Modelo de datos

Tres tablas en PostgreSQL:

- `sensors`: estación de monitoreo (UUID, nombre, latitud/longitud, estado y la
  fecha del estado).
- `parameters`: catálogo de parámetros medidos (clave y unidad).
- `measurements`: mediciones por sensor, parámetro e instante, con unicidad en
  `(sensor_id, parameter_id, measured_at)` para permitir ingestas idempotentes.

La instantánea completa de un sensor se construye con `selectDistinctOn`, que
devuelve la medición más reciente de cada parámetro.

### Contratos y eventos

- Evento servidor → cliente: `sensor:snapshot` con un `SensorSnapshot` completo.
- Salas: `sensor:<uuid>` (definido por `sensorRoomName`).
- Autenticación de socket: `handshake.auth.sensorId` (UUID válido).
- Los tipos de eventos (`ServerToClientEvents`, etc.) viven en el paquete
  `contract` y se comparten entre cliente, realtime y publicador.

## Requisitos previos

- Node.js 20 o superior.
- pnpm 11 (`corepack enable` suele bastar).
- PostgreSQL (para la app y las pruebas de integración).
- Redis (para el tiempo real y las pruebas de integración opcionales).

## Primeros pasos

Instala las dependencias desde la raíz:

```bash
pnpm install
```

Prepara la base de datos:

```bash
pnpm db:migrate
pnpm db:seed
```

Arranca el cliente:

```bash
pnpm dev
```

En otra terminal, arranca el servicio de tiempo real:

```bash
pnpm dev:realtime
```

Abre [http://localhost:3000](http://localhost:3000).

## Comandos

Desde la raíz:

```bash
pnpm dev            # cliente en modo desarrollo
pnpm build          # build de producción del cliente
pnpm start          # cliente en producción
pnpm dev:realtime   # servicio de tiempo real en desarrollo
pnpm start:realtime # servicio de tiempo real
pnpm test           # pruebas unitarias de todos los paquetes
pnpm lint           # Biome (lint)
pnpm format         # Biome (formato)
pnpm db:generate    # genera migraciones (paquete db)
pnpm db:migrate     # aplica migraciones (paquete db)
pnpm db:seed        # carga datos semilla (paquete db)
```

Para ejecutar un comando de un paquete concreto:

```bash
pnpm --filter @ana-contest-demo/client <comando>
pnpm --filter @ana-contest-demo/realtime <comando>
pnpm --filter @ana-contest-demo/db <comando>
```

## Variables de entorno

| Variable | Servicio | Requerida | Descripción |
| --- | --- | --- | --- |
| `DATABASE_URL` | client, db | Sí | Cadena de conexión PostgreSQL. |
| `REDIS_URL` | client, realtime | Sí | Endpoint Redis compartido para Pub/Sub. |
| `REDIS_CHANNEL_PREFIX` | client, realtime | No | Prefijo del canal Redis. Debe coincidir en ambos. Por defecto `ana-contest-demo:socket.io`. |
| `NEXT_PUBLIC_REALTIME_URL` | client | No | URL pública del servicio de tiempo real. Por defecto `http://localhost:3001`. |
| `PORT` | realtime | No | Puerto del servicio. Por defecto `3001`. |
| `CLIENT_ORIGIN` | realtime | No | Orígenes permitidos (CORS), separados por coma. Por defecto `http://localhost:3000`. |
| `LOG_LEVEL` | realtime | No | Nivel de log de Pino. Por defecto `info`. |

> Redis es best-effort para la entrega en tiempo real: si no está listo al
> publicar, la ingesta responde `503 realtime_unavailable` y puede reintentarse
> de forma segura porque es idempotente.

## API REST

### `POST /api/sensors/readings`

Recibe un lote parcial de mediciones de un sensor:

```json
{
  "sensor": {
    "id": "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761",
    "name": "Río Añasmayo",
    "latitude": -11.388661,
    "longitude": -76.769007,
    "status": "stable"
  },
  "measuredAt": "2026-08-27T18:30:00.000Z",
  "measurements": [
    { "key": "ph", "value": 7.82 },
    { "key": "temperature", "value": 19.4 }
  ]
}
```

Respuestas de error:

| Código | `code` | Significado |
| --- | --- | --- |
| `400` | `invalid_json` | El cuerpo no es JSON válido. |
| `400` | `invalid_payload` | El payload no cumple el contrato (Zod). |
| `503` | `realtime_unavailable` | Se persistió pero no se pudo publicar en tiempo real. Reintentar es seguro. |
| `500` | `ingestion_failed` | La lectura no pudo persistirse. |

### `GET /api/sensors/:sensorId`

Devuelve la instantánea completa más reciente del sensor:

- `200` con `{ "data": <SensorSnapshot> }`
- `400 invalid_sensor_id` si el id no es un UUID válido.
- `404 sensor_not_found` si el sensor no existe.
- `500 sensor_load_failed` ante un error de carga.

## Tiempo real (Socket.IO)

- Evento: `sensor:snapshot` (payload `SensorSnapshot`).
- Sala: `sensor:<uuid>`.
- Autenticación: `io(url, { auth: { sensorId: "<uuid>" } })`.

El navegador conecta con el `sensorId` del detalle abierto y fusiona las
instantáneas entrantes con `mergeSensorSnapshots`, que conserva la lectura más
reciente por parámetro y descarta estados obsoletos.

## Base de datos

El paquete `@ana-contest-demo/db` es el dueño exclusivo de Drizzle, las
migraciones y el seed. Las migraciones existentes se conservan sin cambios en
`packages/db/drizzle/`.

```bash
pnpm db:generate   # drizzle-kit generate
pnpm db:migrate    # drizzle-kit migrate
pnpm db:seed       # tsx src/seed.ts
```

El seed carga tres estaciones de ejemplo y el catálogo completo de parámetros.

## Pruebas

Pruebas unitarias (sin servicios externos):

```bash
pnpm test
```

- Cliente: validación de payload, fusión de instantáneas e ingesta con publicador
  inyectado.
- Realtime: configuración (Zod), health, CORS, autenticación de socket y
  aislamiento de salas.

Pruebas de integración opcionales (requieren servicios):

```bash
# Base de datos (idempotencia, protección de estado obsoleto, rollback)
RUN_DATABASE_TESTS=1 DATABASE_URL=... pnpm test:db

# Redis (un emisor externo llega a los clientes a través del adapter)
RUN_REDIS_TESTS=1 REDIS_URL=... pnpm --filter @ana-contest-demo/realtime test
```

Builds de verificación:

```bash
pnpm build
pnpm --filter @ana-contest-demo/db build
pnpm --filter @ana-contest-demo/realtime build
```

## Calidad de código

Biome se encarga del lint y el formateo:

```bash
pnpm lint
pnpm format
```

## Decisiones de diseño y trade-offs

- **Redis Pub/Sub best-effort.** El `503` indica que Redis no estaba listo al
  publicar, no que un cliente confirmó la entrega. Se acepta a cambio de
  simplificar la ingesta: la idempotencia garantiza que reintentar no duplica
  datos.
- **Un único endpoint de Redis con prefijo compartido.** Cliente y realtime
  deben apuntar al mismo Redis y usar el mismo `REDIS_CHANNEL_PREFIX`. Esto
  exige proteger Redis con red privada, autenticación/TLS y ACLs.
- **`ioredis` sobre otros clientes.** Se eligió porque el adapter de Socket.IO lo
  recomienda cuando es importante restaurar suscripciones de forma fiable.
- **Sin `node:http`.** El HTTP se sirve exclusivamente con `app.listen()` de
  Express; Socket.IO y Terminus se adjuntan al servidor devuelto.
- **Transporte de Socket.IO.** Se conserva el comportamiento actual (websocket +
  polling). Con varias réplicas del realtime, los clientes que usan polling
  requerirán sesiones pegajosas (sticky sessions), como documenta el
  [adapter de Redis de Socket.IO](https://socket.io/docs/v4/redis-adapter/).
- **Paquete `db` como única fuente de la verdad.** Evita lógica duplicada de
  ensamblado de instantáneas y SQL crudo repartido entre apps.
- **Esquema y contrato estables.** Se mantienen sin cambios los nombres de
  eventos, el payload de autenticación, la nomenclatura de salas, las respuestas
  REST y el esquema PostgreSQL.

## Trabajo futuro para producción

- **Red y seguridad de Redis:** red privada, TLS, autenticación y ACLs; rotación
  de credenciales.
- **Sesiones pegajosas:** configurar el balanceador para clientes que usen
  polling, o restringir a transporte websocket.
- **Autenticación robusta:** el handshake actual solo valida un UUID; añadir
  tokens firmados o claves por sensor.
- **Rate limiting y límites de tamaño** en el endpoint de ingesta.
- **Entrega garantizada:** cola con reintentos y dead-letter para la publicación
  a Redis (hoy es best-effort sin reintentos automáticos).
- **Observabilidad:** métricas (Prometheus), tracing distribuido y agregación de
  logs estructurados de Pino.
- **CI/CD:** automatizar `pnpm test`, los builds y `biome check`; ejecutar las
  pruebas de integración con servicios efímeros.
- **Base de datos:** pool de conexiones ajustado, respaldo/alta disponibilidad y
  migraciones automatizadas en el despliegue; particionado o retención para la
  tabla `measurements` a medida que crezca.
- **Salud y despliegue:** usar `GET /health` como readiness check (devuelve `200`
  solo con Redis listo) y aprovechar el ciclo de vida gestionado por Terminus.
- **Consultas históricas:** hoy solo se expone la instantánea más reciente;
  añadir series temporales por parámetro con rangos y agregaciones.
- **Cache de instantáneas** para reducir la carga de lecturas repetidas.
