import assert from "node:assert/strict";
import test from "node:test";

import type { WaterQualityParameterKey } from "@ana-contest-demo/water-quality-contract";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sensors } from "@/db/schema";
import {
  getSensorSnapshot,
  ingestSensorReading,
} from "@/features/water-quality/data-access";

const enabled = process.env.RUN_DATABASE_TESTS === "1";
const SENSOR_ID = "00000000-0000-4000-8000-000000000042";
const ROLLBACK_ID = "00000000-0000-4000-8000-000000000043";

test(
  "persists partial batches idempotently and protects newer status",
  { skip: !enabled },
  async () => {
    await db.delete(sensors).where(eq(sensors.uuid, SENSOR_ID));
    const sensor = {
      id: SENSOR_ID,
      name: "Integration sensor",
      latitude: -11.3,
      longitude: -76.8,
      status: "attention" as const,
    };
    try {
      await ingestSensorReading({
        sensor,
        measuredAt: "2026-08-27T18:00:00.000Z",
        measurements: [{ key: "ph", value: 7.1 }],
      });
      await ingestSensorReading({
        sensor,
        measuredAt: "2026-08-27T18:00:00.000Z",
        measurements: [{ key: "ph", value: 7.2 }],
      });
      await ingestSensorReading({
        sensor: { ...sensor, status: "stable" },
        measuredAt: "2026-08-27T19:00:00.000Z",
        measurements: [{ key: "temperature", value: null }],
      });
      await ingestSensorReading({
        sensor,
        measuredAt: "2026-08-27T17:00:00.000Z",
        measurements: [{ key: "conductivity", value: 400 }],
      });
      const snapshot = await getSensorSnapshot(SENSOR_ID);
      assert(snapshot);
      assert.equal(snapshot.status, "stable");
      assert.equal(
        snapshot.measurements.find(({ key }) => key === "ph")?.value,
        7.2,
      );
      assert.equal(snapshot.measuredAt, "2026-08-27T19:00:00.000Z");
    } finally {
      await db.delete(sensors).where(eq(sensors.uuid, SENSOR_ID));
    }
  },
);

test(
  "rolls back the sensor upsert when a parameter is missing",
  { skip: !enabled },
  async () => {
    await db.delete(sensors).where(eq(sensors.uuid, ROLLBACK_ID));
    await assert.rejects(() =>
      ingestSensorReading({
        sensor: {
          id: ROLLBACK_ID,
          name: "Rollback sensor",
          latitude: -11.3,
          longitude: -76.8,
          status: "stable",
        },
        measuredAt: "2026-08-27T18:00:00.000Z",
        measurements: [
          {
            key: "missing_parameter" as WaterQualityParameterKey,
            value: 1,
          },
        ],
      }),
    );
    const [row] = await db
      .select({ id: sensors.id })
      .from(sensors)
      .where(eq(sensors.uuid, ROLLBACK_ID));
    assert.equal(row, undefined);
  },
);
