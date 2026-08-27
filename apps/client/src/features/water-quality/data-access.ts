import {
  type MeasurementSnapshot,
  SENSOR_SNAPSHOT_CHANNEL,
  type SensorSnapshot,
  type WaterQualityParameterKey,
  type WaterQualityStatus,
} from "@ana-contest-demo/water-quality-contract";
import { inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { measurements, parameters, sensors } from "@/db/schema";
import type { SensorReadingInput } from "@/features/water-quality/sensor-readings";

interface SnapshotRow extends Record<string, unknown> {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  status_measured_at: Date | string;
  key: string;
  unit: string;
  value: number | null;
  measured_at: Date | string | null;
}

function timestampToIso(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function isWaterQualityStatus(value: string): value is WaterQualityStatus {
  return value === "stable" || value === "observation" || value === "attention";
}

function snapshotsFromRows(rows: SnapshotRow[]): SensorSnapshot[] {
  const snapshots = new Map<string, SensorSnapshot>();
  for (const row of rows) {
    let snapshot = snapshots.get(row.id);
    if (!snapshot) {
      snapshot = {
        id: row.id,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        status: isWaterQualityStatus(row.status) ? row.status : "stable",
        statusMeasuredAt: timestampToIso(row.status_measured_at),
        measuredAt: null,
        measurements: [],
      };
      snapshots.set(row.id, snapshot);
    }
    const measuredAt =
      row.measured_at === null ? null : timestampToIso(row.measured_at);
    (snapshot.measurements as MeasurementSnapshot[]).push({
      key: row.key as WaterQualityParameterKey,
      unit: row.unit,
      value: row.value,
      measuredAt,
    });
    if (
      measuredAt !== null &&
      (snapshot.measuredAt === null || measuredAt > snapshot.measuredAt)
    ) {
      snapshot.measuredAt = measuredAt;
    }
  }
  return [...snapshots.values()];
}

async function querySensorSnapshots(
  sensorUuid: string | null,
): Promise<SensorSnapshot[]> {
  const result = await db.execute<SnapshotRow>(sql`
    select s.uuid::text as id, s.name, s.latitude, s.longitude, s.status,
      s.status_measured_at, p.key, p.unit, latest.value, latest.measured_at
    from ${sensors} s
    cross join ${parameters} p
    left join lateral (
      select m.value, m.measured_at
      from ${measurements} m
      where m.sensor_id = s.id and m.parameter_id = p.id
      order by m.measured_at desc, m.id desc
      limit 1
    ) latest on true
    where (${sensorUuid}::uuid is null or s.uuid = ${sensorUuid}::uuid)
    order by s.name, p.id
  `);
  return snapshotsFromRows(result.rows);
}

export async function getAllSensorSnapshots(): Promise<SensorSnapshot[]> {
  return querySensorSnapshots(null);
}

export async function getSensorSnapshot(
  sensorUuid: string,
): Promise<SensorSnapshot | null> {
  return (await querySensorSnapshots(sensorUuid))[0] ?? null;
}

export async function ingestSensorReading(
  input: SensorReadingInput,
): Promise<SensorSnapshot> {
  const measuredAt = new Date(input.measuredAt);
  await db.transaction(async (transaction) => {
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
    await transaction.execute(
      sql`select pg_notify(${SENSOR_SNAPSHOT_CHANNEL}, ${input.sensor.id})`,
    );
  });

  const snapshot = await getSensorSnapshot(input.sensor.id);
  if (!snapshot)
    throw new Error("The persisted sensor snapshot could not be loaded.");
  return snapshot;
}
