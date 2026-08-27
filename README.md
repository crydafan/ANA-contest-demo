# ANA Contest Demo

This repository is a pnpm monorepo containing the AquaSense Next.js client and
its standalone realtime service.

## Workspace layout

```text
apps/
  client/       Next.js application and Drizzle database resources
  realtime/     Express.js and Socket.IO realtime service
packages/
  water-quality-contract/  Shared sensor and event contracts
```

The client owns the database schema and ingestion API. The realtime service
listens for committed PostgreSQL notifications and broadcasts snapshots only
to clients subscribed to the affected sensor.

## Getting started

Install dependencies from the repository root:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Start the realtime service in a second terminal:

```bash
pnpm dev:realtime
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

Run the common commands from the repository root:

```bash
pnpm dev
pnpm build
pnpm start
pnpm dev:realtime
pnpm start:realtime
pnpm test
pnpm lint
pnpm format
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

To run a client command directly, filter by its workspace package name:

```bash
pnpm --filter @ana-contest-demo/client <command>
```

## Environment variables

The client requires `DATABASE_URL` and uses `NEXT_PUBLIC_REALTIME_URL` to reach
the public realtime service. The realtime service requires `DATABASE_URL`,
reads Railway's `PORT`, and accepts a comma-separated `CLIENT_ORIGIN` allowlist.
Local defaults are `http://localhost:3001` for the realtime URL and
`http://localhost:3000` for the allowed client origin.

## Sensor ingestion

Sensors send partial batches to `POST /api/sensors/readings` on the Next.js
service. For example:

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

`GET /api/sensors/:sensorId` returns the current complete snapshot. Configure
the realtime Railway service health check to use `GET /health`.
