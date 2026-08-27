import assert from "node:assert/strict";
import { after, test } from "node:test";

import {
  WATER_QUALITY_PARAMETERS,
  type WaterQualityParameterKey,
} from "@ana-contest-demo/contract";
import { eq } from "drizzle-orm";

import { createDatabase } from "./database";
import { getSensorSnapshot, ingestSensorReading } from "./repository";
import { sensors } from "./schema";

const enabled = process.env.RUN_DATABASE_TESTS === "1";
const connection =
  enabled && process.env.DATABASE_URL
    ? createDatabase(process.env.DATABASE_URL)
    : null;
const SENSOR_ID = "00000000-0000-4000-8000-000000000042";
const ROLLBACK_ID = "00000000-0000-4000-8000-000000000043";

after(async () => {
  await connection?.close();
});

test(
  "persists partial batches idempotently and returns a complete snapshot",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const database = connection.database;
    await database.delete(sensors).where(eq(sensors.uuid, SENSOR_ID));
    const sensor = {
      id: SENSOR_ID,
      name: "Integration sensor",
      latitude: -11.3,
      longitude: -76.8,
      status: "attention" as const,
    };
    try {
      await ingestSensorReading(database, {
        sensor,
        measuredAt: "2026-08-27T18:00:00.000Z",
        measurements: [{ key: "ph", value: 7.1 }],
      });
      await ingestSensorReading(database, {
        sensor,
        measuredAt: "2026-08-27T18:00:00.000Z",
        measurements: [{ key: "ph", value: 7.2 }],
      });
      await ingestSensorReading(database, {
        sensor: { ...sensor, status: "stable" },
        measuredAt: "2026-08-27T19:00:00.000Z",
        measurements: [{ key: "temperature", value: null }],
      });
      await ingestSensorReading(database, {
        sensor,
        measuredAt: "2026-08-27T17:00:00.000Z",
        measurements: [{ key: "conductivity", value: 400 }],
      });

      const snapshot = await getSensorSnapshot(database, SENSOR_ID);
      assert(snapshot);
      assert.equal(snapshot.status, "stable");
      assert.equal(
        snapshot.measurements.length,
        WATER_QUALITY_PARAMETERS.length,
      );
      assert.equal(
        snapshot.measurements.find(({ key }) => key === "ph")?.value,
        7.2,
      );
      assert.equal(snapshot.measuredAt, "2026-08-27T19:00:00.000Z");
    } finally {
      await database.delete(sensors).where(eq(sensors.uuid, SENSOR_ID));
    }
  },
);

test(
  "rolls back the sensor upsert when a parameter is missing",
  { skip: !connection },
  async () => {
    if (!connection) return;
    const database = connection.database;
    await database.delete(sensors).where(eq(sensors.uuid, ROLLBACK_ID));
    await assert.rejects(() =>
      ingestSensorReading(database, {
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
    const [row] = await database
      .select({ id: sensors.id })
      .from(sensors)
      .where(eq(sensors.uuid, ROLLBACK_ID));
    assert.equal(row, undefined);
  },
);
