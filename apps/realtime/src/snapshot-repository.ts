import type {
  MeasurementSnapshot,
  SensorSnapshot,
  WaterQualityParameterKey,
  WaterQualityStatus,
} from "@ana-contest-demo/water-quality-contract";
import type { Pool } from "pg";

interface SnapshotRow {
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

export async function loadSensorSnapshot(
  pool: Pool,
  sensorId: string,
): Promise<SensorSnapshot | null> {
  const result = await pool.query<SnapshotRow>(
    `select
      s.uuid::text as id,
      s.name,
      s.latitude,
      s.longitude,
      s.status,
      s.status_measured_at,
      p.key,
      p.unit,
      latest.value,
      latest.measured_at
    from sensors s
    cross join parameters p
    left join lateral (
      select m.value, m.measured_at
      from measurements m
      where m.sensor_id = s.id and m.parameter_id = p.id
      order by m.measured_at desc, m.id desc
      limit 1
    ) latest on true
    where s.uuid = $1::uuid
    order by p.id`,
    [sensorId],
  );

  const first = result.rows[0];
  if (!first) return null;

  const measurements: MeasurementSnapshot[] = result.rows.map((row) => ({
    key: row.key as WaterQualityParameterKey,
    unit: row.unit,
    value: row.value,
    measuredAt:
      row.measured_at === null ? null : timestampToIso(row.measured_at),
  }));
  const measuredAt = measurements.reduce<string | null>(
    (latest, measurement) =>
      measurement.measuredAt !== null &&
      (latest === null || measurement.measuredAt > latest)
        ? measurement.measuredAt
        : latest,
    null,
  );

  return {
    id: first.id,
    name: first.name,
    latitude: first.latitude,
    longitude: first.longitude,
    status: isWaterQualityStatus(first.status) ? first.status : "stable",
    statusMeasuredAt: timestampToIso(first.status_measured_at),
    measuredAt,
    measurements,
  };
}
