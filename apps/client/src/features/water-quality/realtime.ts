import type {
  MeasurementSnapshot,
  SensorSnapshot,
} from "@ana-contest-demo/water-quality-contract";

export type RealtimeConnectionState = "connecting" | "live" | "reconnecting";

function isNewerOrEqual(
  incomingTimestamp: string | null,
  currentTimestamp: string | null,
): boolean {
  if (incomingTimestamp === null) return currentTimestamp === null;
  if (currentTimestamp === null) return true;
  return Date.parse(incomingTimestamp) >= Date.parse(currentTimestamp);
}

export function mergeSensorSnapshots(
  current: SensorSnapshot,
  incoming: SensorSnapshot,
): SensorSnapshot {
  if (current.id !== incoming.id) return current;
  const incomingMeasurements = new Map(
    incoming.measurements.map((measurement) => [measurement.key, measurement]),
  );
  const measurements: MeasurementSnapshot[] = current.measurements.map(
    (measurement) => {
      const nextMeasurement = incomingMeasurements.get(measurement.key);
      return nextMeasurement &&
        isNewerOrEqual(nextMeasurement.measuredAt, measurement.measuredAt)
        ? nextMeasurement
        : measurement;
    },
  );
  const knownKeys = new Set(
    current.measurements.map((measurement) => measurement.key),
  );
  for (const measurement of incoming.measurements) {
    if (!knownKeys.has(measurement.key)) measurements.push(measurement);
  }
  const useIncomingStatus = isNewerOrEqual(
    incoming.statusMeasuredAt,
    current.statusMeasuredAt,
  );
  const measuredAt = measurements.reduce<string | null>(
    (latest, measurement) =>
      isNewerOrEqual(measurement.measuredAt, latest)
        ? measurement.measuredAt
        : latest,
    null,
  );
  return {
    ...current,
    name: incoming.name,
    latitude: incoming.latitude,
    longitude: incoming.longitude,
    status: useIncomingStatus ? incoming.status : current.status,
    statusMeasuredAt: useIncomingStatus
      ? incoming.statusMeasuredAt
      : current.statusMeasuredAt,
    measuredAt,
    measurements,
  };
}

export function isSensorSnapshot(value: unknown): value is SensorSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const snapshot = value as Partial<SensorSnapshot>;
  return (
    typeof snapshot.id === "string" &&
    typeof snapshot.name === "string" &&
    typeof snapshot.statusMeasuredAt === "string" &&
    Array.isArray(snapshot.measurements)
  );
}

export function getRealtimeUrl(): string {
  return process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3001";
}
