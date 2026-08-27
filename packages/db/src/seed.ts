import "dotenv/config";

import { WATER_QUALITY_PARAMETERS } from "@ana-contest-demo/contract";
import { sql } from "drizzle-orm";

import { createDatabase } from "./database";
import { measurements, parameters, sensors } from "./schema";
import { WATER_QUALITY_SENSORS } from "./seed-data";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const connection = createDatabase(databaseUrl);

async function seed(): Promise<void> {
  await connection.database.transaction(async (transaction) => {
    const sensorRows = await transaction
      .insert(sensors)
      .values(
        WATER_QUALITY_SENSORS.map((sensor) => ({
          uuid: sensor.id,
          name: sensor.name,
          latitude: sensor.latitude,
          longitude: sensor.longitude,
          status: sensor.status,
          statusMeasuredAt: new Date(sensor.statusMeasuredAt),
        })),
      )
      .onConflictDoUpdate({
        target: sensors.uuid,
        set: {
          name: sql`excluded.name`,
          latitude: sql`excluded.latitude`,
          longitude: sql`excluded.longitude`,
          status: sql`excluded.status`,
          statusMeasuredAt: sql`excluded.status_measured_at`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: sensors.id, uuid: sensors.uuid });

    const parameterRows = await transaction
      .insert(parameters)
      .values(WATER_QUALITY_PARAMETERS.map(({ key, unit }) => ({ key, unit })))
      .onConflictDoUpdate({
        target: parameters.key,
        set: { unit: sql`excluded.unit`, updatedAt: sql`now()` },
      })
      .returning({ id: parameters.id, key: parameters.key });

    const sensorIds = new Map(
      sensorRows.map((sensor) => [sensor.uuid, sensor.id]),
    );
    const parameterIds = new Map(
      parameterRows.map((parameter) => [parameter.key, parameter.id]),
    );
    const measurementRows = WATER_QUALITY_SENSORS.flatMap((sensor) => {
      const sensorId = sensorIds.get(sensor.id);
      if (sensorId === undefined) {
        throw new Error(`Unable to resolve sensor ${sensor.id}.`);
      }
      return sensor.measurements.map((measurement) => {
        const parameterId = parameterIds.get(measurement.key);
        if (parameterId === undefined || measurement.measuredAt === null) {
          throw new Error(
            `Unable to resolve seed measurement ${measurement.key}.`,
          );
        }
        return {
          sensorId,
          parameterId,
          value: measurement.value,
          measuredAt: new Date(measurement.measuredAt),
        };
      });
    });

    await transaction
      .insert(measurements)
      .values(measurementRows)
      .onConflictDoUpdate({
        target: [
          measurements.sensorId,
          measurements.parameterId,
          measurements.measuredAt,
        ],
        set: { value: sql`excluded.value` },
      });
  });
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => connection.close());
