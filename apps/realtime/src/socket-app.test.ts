import assert from "node:assert/strict";
import test from "node:test";

import {
  type ClientToServerEvents,
  type SensorSnapshot,
  type ServerToClientEvents,
  sensorRoomName,
} from "@ana-contest-demo/contract";
import { createAdapter } from "@socket.io/redis-adapter";
import { Emitter } from "@socket.io/redis-emitter";
import { Redis } from "ioredis";
import {
  type Socket as ClientSocket,
  io as createClient,
} from "socket.io-client";

import { createLogger } from "./logger.js";
import { createRealtimeApplication } from "./socket-app.js";

const SENSOR_A = "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761";
const SENSOR_B = "e6d01d9f-019e-4cc4-918b-cdfd18bd9027";
const allowedOrigins = ["http://localhost:3000"];
const logger = createLogger("silent");

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

async function listen(isRedisReady = () => true) {
  const realtime = createRealtimeApplication({
    allowedOrigins,
    isRedisReady,
    logger,
  });
  const server = realtime.app.listen(0, "127.0.0.1");
  realtime.io.attach(server);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  return { realtime, url: `http://127.0.0.1:${address.port}` };
}

function connect(url: string, sensorId: string) {
  return createClient(url, {
    auth: { sensorId },
    forceNew: true,
    reconnection: false,
  }) as ClientSocket<ServerToClientEvents, ClientToServerEvents>;
}

function waitForConnection(client: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    client.once("connect", resolve);
    client.once("connect_error", reject);
  });
}

test("serves health and isolates sensor rooms", async () => {
  const { realtime, url } = await listen();
  const clients = [SENSOR_A, SENSOR_A, SENSOR_B].map((id) => connect(url, id));
  try {
    const health = await fetch(`${url}/health`, {
      headers: { Origin: allowedOrigins[0] },
    });
    assert.equal(health.status, 200);
    assert.equal(
      health.headers.get("access-control-allow-origin"),
      allowedOrigins[0],
    );
    assert.equal(health.headers.has("x-powered-by"), false);
    assert.equal(health.headers.has("x-content-type-options"), true);

    await Promise.all(clients.map(waitForConnection));
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
    realtime.io
      .to(sensorRoomName(SENSOR_A))
      .emit("sensor:snapshot", snapshot());
    assert.equal((await Promise.all(received)).length, 2);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(unrelatedReceived, false);
  } finally {
    for (const client of clients) client.disconnect();
    await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
  }
});

test("reports unavailable when Redis is not ready", async () => {
  const { realtime, url } = await listen(() => false);
  try {
    const health = await fetch(`${url}/health`);
    assert.equal(health.status, 503);
    assert.deepEqual(await health.json(), {
      status: "unavailable",
      redis: "unavailable",
      connections: 0,
    });
  } finally {
    await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
  }
});

test("rejects an invalid sensor UUID", async () => {
  const { realtime, url } = await listen();
  const client = connect(url, "invalid");
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

test(
  "accepts snapshots from an external Redis emitter",
  { skip: process.env.RUN_REDIS_TESTS !== "1" || !process.env.REDIS_URL },
  async () => {
    const redisUrl = process.env.REDIS_URL as string;
    const prefix = `ana-contest-demo:test:${Date.now()}`;
    const publisher = new Redis(redisUrl);
    const subscriber = publisher.duplicate();
    const emitterClient = publisher.duplicate();
    const realtime = createRealtimeApplication({
      allowedOrigins,
      isRedisReady: () =>
        publisher.status === "ready" && subscriber.status === "ready",
      logger,
    });
    realtime.io.adapter(createAdapter(publisher, subscriber, { key: prefix }));
    const server = realtime.app.listen(0, "127.0.0.1");
    realtime.io.attach(server);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert(address && typeof address !== "string");
    const client = connect(`http://127.0.0.1:${address.port}`, SENSOR_A);
    try {
      await waitForConnection(client);
      const received = new Promise<SensorSnapshot>((resolve) => {
        client.once("sensor:snapshot", resolve);
      });
      new Emitter<ServerToClientEvents>(emitterClient, { key: prefix })
        .to(sensorRoomName(SENSOR_A))
        .emit("sensor:snapshot", snapshot());
      assert.deepEqual(await received, snapshot());
    } finally {
      client.disconnect();
      await new Promise<void>((resolve) => realtime.io.close(() => resolve()));
      await Promise.allSettled([
        subscriber.quit(),
        emitterClient.quit(),
        publisher.quit(),
      ]);
    }
  },
);
