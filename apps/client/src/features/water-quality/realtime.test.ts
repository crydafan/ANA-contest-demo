import assert from "node:assert/strict";
import test from "node:test";

import type { SensorSnapshot } from "@ana-contest-demo/water-quality-contract";

import { mergeSensorSnapshots } from "@/features/water-quality/realtime";

function snapshot(overrides: Partial<SensorSnapshot> = {}): SensorSnapshot {
  return {
    id: "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761",
    name: "Río Añasmayo",
    latitude: -11.388661,
    longitude: -76.769007,
    status: "stable",
    statusMeasuredAt: "2026-08-27T18:30:00.000Z",
    measuredAt: "2026-08-27T18:30:00.000Z",
    measurements: [
      {
        key: "ph",
        unit: "pH",
        value: 7.8,
        measuredAt: "2026-08-27T18:30:00.000Z",
      },
      {
        key: "temperature",
        unit: "°C",
        value: 19,
        measuredAt: "2026-08-27T18:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

test("merges readings independently and rejects stale status", () => {
  const merged = mergeSensorSnapshots(
    snapshot(),
    snapshot({
      status: "attention",
      statusMeasuredAt: "2026-08-27T17:00:00.000Z",
      measurements: [
        {
          key: "ph",
          unit: "pH",
          value: 6.5,
          measuredAt: "2026-08-27T17:30:00.000Z",
        },
        {
          key: "temperature",
          unit: "°C",
          value: 20,
          measuredAt: "2026-08-27T19:00:00.000Z",
        },
      ],
    }),
  );
  assert.equal(merged.status, "stable");
  assert.equal(merged.measurements[0]?.value, 7.8);
  assert.equal(merged.measurements[1]?.value, 20);
  assert.equal(merged.measuredAt, "2026-08-27T19:00:00.000Z");
});

test("ignores snapshots from another sensor", () => {
  const current = snapshot();
  assert.equal(
    mergeSensorSnapshots(
      current,
      snapshot({ id: "e6d01d9f-019e-4cc4-918b-cdfd18bd9027" }),
    ),
    current,
  );
});
