import assert from "node:assert/strict";
import test from "node:test";

import type {
  ClientToServerEvents,
  SensorSnapshot,
  ServerToClientEvents,
} from "@ana-contest-demo/water-quality-contract";
import {
  type Socket as ClientSocket,
  io as createClient,
} from "socket.io-client";

import { createRealtimeApplication } from "./socket-app.js";

const SENSOR_A = "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761";
const SENSOR_B = "e6d01d9f-019e-4cc4-918b-cdfd18bd9027";

function snapshot(): SensorSnapshot {
  return {
    id: SENSOR_A,
    name: "Río Añasmayo",
    latitude: -11.38,
    longitude: -76.76,
    status: "stable",
    statusMeasuredAt: "2026-08-27T18:30:00.000Z",
    measuredAt: "2026-08-27T18:30:00.000Z",
    measurements: [
      {
        key: "ph",
        unit: "pH",
        value: 7.82,
        measuredAt: "2026-08-27T18:30:00.000Z",
      },
    ],
  };
}

test("serves health and isolates sensor rooms", async () => {
  const realtime = createRealtimeApplication(["http://localhost:3000"]);
  await new Promise<void>((resolve) =>
    realtime.httpServer.listen(0, "127.0.0.1", resolve),
  );
  const address = realtime.httpServer.address();
  assert(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const clients = [SENSOR_A, SENSOR_A, SENSOR_B].map(
    (sensorId) =>
      createClient(url, {
        auth: { sensorId },
        forceNew: true,
        reconnection: false,
      }) as ClientSocket<ServerToClientEvents, ClientToServerEvents>,
  );
  try {
    const health = await fetch(`${url}/health`, {
      headers: { Origin: "http://localhost:3000" },
    });
    assert.equal(health.status, 200);
    assert.equal(
      health.headers.get("access-control-allow-origin"),
      "http://localhost:3000",
    );

    await Promise.all(
      clients.map(
        (client) =>
          new Promise<void>((resolve, reject) => {
            client.once("connect", resolve);
            client.once("connect_error", reject);
          }),
      ),
    );
    const received = clients.slice(0, 2).map(
      (client) =>
        new Promise<SensorSnapshot>((resolve) => {
          client.once("sensor:snapshot", resolve);
        }),
    );
    let unrelatedReceived = false;
    clients[2]?.once("sensor:snapshot", () => {
      unrelatedReceived = true;
    });
    realtime.emitSnapshot(snapshot());
    assert.equal((await Promise.all(received)).length, 2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(unrelatedReceived, false);
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
  }
});

test("rejects an invalid sensor UUID", async () => {
  const realtime = createRealtimeApplication(["http://localhost:3000"]);
  await new Promise<void>((resolve) =>
    realtime.httpServer.listen(0, "127.0.0.1", resolve),
  );
  const address = realtime.httpServer.address();
  assert(address && typeof address !== "string");
  const client = createClient(`http://127.0.0.1:${address.port}`, {
    auth: { sensorId: "invalid" },
    reconnection: false,
  });
  try {
    const error = await new Promise<Error>((resolve) => {
      client.once("connect_error", resolve);
    });
    assert.match(error.message, /valid sensorId/);
  } finally {
    client.disconnect();
    await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
  }
});
