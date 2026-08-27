import assert from "node:assert/strict";
import test from "node:test";

import type {
  SensorReadingInput,
  SensorSnapshot,
} from "@ana-contest-demo/contract";

import { ingestAndPublishSensorReading } from "./ingestion";
import { RealtimeUnavailableError } from "./snapshot-publisher";

const input: SensorReadingInput = {
  sensor: {
    id: "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761",
    name: "Río Añasmayo",
    latitude: -11.38,
    longitude: -76.76,
    status: "stable",
  },
  measuredAt: "2026-08-27T18:30:00.000Z",
  measurements: [{ key: "ph", value: 7.82 }],
};

const snapshot: SensorSnapshot = {
  ...input.sensor,
  statusMeasuredAt: input.measuredAt,
  measuredAt: input.measuredAt,
  measurements: [
    { key: "ph", value: 7.82, unit: "pH", measuredAt: input.measuredAt },
  ],
};

test("publishes the snapshot after persistence", async () => {
  const published: SensorSnapshot[] = [];
  const result = await ingestAndPublishSensorReading(input, {
    persist: async () => snapshot,
    publisher: { publish: (value) => published.push(value) },
  });
  assert.equal(result, snapshot);
  assert.deepEqual(published, [snapshot]);
});

test("surfaces realtime unavailability after persistence", async () => {
  let persisted = false;
  await assert.rejects(
    () =>
      ingestAndPublishSensorReading(input, {
        persist: async () => {
          persisted = true;
          return snapshot;
        },
        publisher: {
          publish: () => {
            throw new RealtimeUnavailableError();
          },
        },
      }),
    RealtimeUnavailableError,
  );
  assert.equal(persisted, true);
});
