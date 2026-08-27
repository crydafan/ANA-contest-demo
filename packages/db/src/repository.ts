import {
  type MeasurementSnapshot,
  type SensorReadingInput,
  type SensorSnapshot,
  sensorSnapshotSchema,
  waterQualityParameterKeySchema,
  waterQualityStatusSchema,
} from "@ana-contest-demo/contract";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "./database";
import { measurements, parameters, sensors } from "./schema";

function timestampToIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

async function querySensorSnapshots(
  database: Database,
  sensorUuid?: string,
): Promise<SensorSnapshot[]> {
  const sensorRows = await database
    .select({
      id: sensors.id,
      uuid: sensors.uuid,
      name: sensors.name,
      latitude: sensors.latitude,
      longitude: sensors.longitude,
      status: sensors.status,
      statusMeasuredAt: sensors.statusMeasuredAt,
    })
    .from(sensors)
    .where(sensorUuid === undefined ? undefined : eq(sensors.uuid, sensorUuid))
    .orderBy(asc(sensors.name));

  if (sensorRows.length === 0) return [];

  const sensorIds = sensorRows.map(({ id }) => id);
  const [parameterRows, latestMeasurements] = await Promise.all([
    database
      .select({ id: parameters.id, key: parameters.key, unit: parameters.unit })
      .from(parameters)
      .orderBy(asc(parameters.id)),
    database
      .selectDistinctOn([measurements.sensorId, measurements.parameterId], {
        sensorId: measurements.sensorId,
        parameterId: measurements.parameterId,
        value: measurements.value,
        measuredAt: measurements.measuredAt,
      })
      .from(measurements)
      .where(inArray(measurements.sensorId, sensorIds))
      .orderBy(
        asc(measurements.sensorId),
        asc(measurements.parameterId),
        desc(measurements.measuredAt),
        desc(measurements.id),
      ),
  ]);

  const latestBySensorAndParameter = new Map(
    latestMeasurements.map((measurement) => [
      `${measurement.sensorId}:${measurement.parameterId}`,
      measurement,
    ]),
  );

  return sensorRows.map((sensor) => {
    let measuredAt: string | null = null;
    const snapshotMeasurements: MeasurementSnapshot[] = parameterRows.map(
      (parameter) => {
        const latest = latestBySensorAndParameter.get(
          `${sensor.id}:${parameter.id}`,
        );
        const latestMeasuredAt = latest
          ? timestampToIso(latest.measuredAt)
          : null;
        if (
          latestMeasuredAt !== null &&
          (measuredAt === null || latestMeasuredAt > measuredAt)
        ) {
          measuredAt = latestMeasuredAt;
        }
        return {
          key: waterQualityParameterKeySchema.parse(parameter.key),
          unit: parameter.unit,
          value: latest?.value ?? null,
          measuredAt: latestMeasuredAt,
        };
      },
    );

    return sensorSnapshotSchema.parse({
      id: sensor.uuid,
      name: sensor.name,
      latitude: sensor.latitude,
      longitude: sensor.longitude,
      status: waterQualityStatusSchema.catch("stable").parse(sensor.status),
      statusMeasuredAt: timestampToIso(sensor.statusMeasuredAt),
      measuredAt,
      measurements: snapshotMeasurements,
    });
  });
}

export function getAllSensorSnapshots(
  database: Database,
): Promise<SensorSnapshot[]> {
  return querySensorSnapshots(database);
}

export async function getSensorSnapshot(
  database: Database,
  sensorUuid: string,
): Promise<SensorSnapshot | null> {
  return (await querySensorSnapshots(database, sensorUuid))[0] ?? null;
}

export async function ingestSensorReading(
  database: Database,
  input: SensorReadingInput,
): Promise<SensorSnapshot> {
  const measuredAt = new Date(input.measuredAt);
  await database.transaction(async (transaction) => {
    const [sensor] = await transaction
      .insert(sensors)
      .values({
        uuid: input.sensor.id,
        name: input.sensor.name,
        latitude: input.sensor.latitude,
        longitude: input.sensor.longitude,
        status: input.sensor.status,
        statusMeasuredAt: measuredAt,
      })
      .onConflictDoUpdate({
        target: sensors.uuid,
        set: {
          name: input.sensor.name,
          latitude: input.sensor.latitude,
          longitude: input.sensor.longitude,
          status: sql`case when ${measuredAt} >= ${sensors.statusMeasuredAt} then ${input.sensor.status} else ${sensors.status} end`,
          statusMeasuredAt: sql`greatest(${sensors.statusMeasuredAt}, ${measuredAt})`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: sensors.id });

    if (!sensor) throw new Error("The sensor could not be persisted.");

    const keys = input.measurements.map(({ key }) => key);
    const parameterRows = await transaction
      .select({ id: parameters.id, key: parameters.key })
      .from(parameters)
      .where(inArray(parameters.key, keys));
    const parameterIds = new Map(
      parameterRows.map((parameter) => [parameter.key, parameter.id]),
    );
    if (parameterIds.size !== keys.length) {
      throw new Error(
        "The parameters table is missing one or more configured parameters.",
      );
    }

    await transaction
      .insert(measurements)
      .values(
        input.measurements.map((measurement) => ({
          sensorId: sensor.id,
          parameterId: parameterIds.get(measurement.key) as number,
          value: measurement.value,
          measuredAt,
        })),
      )
      .onConflictDoUpdate({
        target: [
          measurements.sensorId,
          measurements.parameterId,
          measurements.measuredAt,
        ],
        set: { value: sql`excluded.value` },
      });
  });

  const snapshot = await getSensorSnapshot(database, input.sensor.id);
  if (!snapshot) {
    throw new Error("The persisted sensor snapshot could not be loaded.");
  }
  return snapshot;
}
