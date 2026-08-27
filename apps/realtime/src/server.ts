import "dotenv/config";

import { Pool } from "pg";

import { SensorNotificationListener } from "./notification-listener.js";
import { loadSensorSnapshot } from "./snapshot-repository.js";
import { createRealtimeApplication } from "./socket-app.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const port = Number.parseInt(process.env.PORT ?? "3001", 10);
const allowedOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const pool = new Pool({ connectionString: databaseUrl });
const realtime = createRealtimeApplication(allowedOrigins);
const listener = new SensorNotificationListener(
  databaseUrl,
  async (sensorId) => {
    try {
      const snapshot = await loadSensorSnapshot(pool, sensorId);
      if (snapshot) realtime.emitSnapshot(snapshot);
    } catch (error) {
      console.error(`Unable to broadcast sensor ${sensorId}.`, error);
    }
  },
);

let shuttingDown = false;
async function shutdown(): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  await listener.stop();
  await pool.end();
  await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

realtime.httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Realtime service listening on 0.0.0.0:${port}`);
});
listener.start();
