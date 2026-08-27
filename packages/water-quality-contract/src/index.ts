export const WATER_QUALITY_PARAMETERS = [
  { key: "ph", unit: "pH" },
  { key: "temperature", unit: "°C" },
  { key: "conductivity", unit: "μS/cm" },
  { key: "dissolved_oxygen", unit: "mg/L" },
  { key: "sulfates", unit: "mg/L" },
  { key: "total_nitrogen", unit: "mg/L" },
  { key: "e_coli", unit: "NMP/100 mL" },
  { key: "thermotolerant_coliforms", unit: "NMP/100 mL" },
  { key: "turbidity", unit: "NTU" },
  { key: "lead", unit: "mg/L" },
  { key: "zinc", unit: "mg/L" },
] as const;

export const WATER_QUALITY_STATUSES = [
  "stable",
  "observation",
  "attention",
] as const;

export type WaterQualityParameterKey =
  (typeof WATER_QUALITY_PARAMETERS)[number]["key"];
export type WaterQualityStatus = (typeof WATER_QUALITY_STATUSES)[number];

export interface MeasurementSnapshot {
  key: WaterQualityParameterKey;
  value: number | null;
  unit: string;
  measuredAt: string | null;
}

export interface SensorSnapshot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: WaterQualityStatus;
  statusMeasuredAt: string;
  measuredAt: string | null;
  measurements: readonly MeasurementSnapshot[];
}

export interface ServerToClientEvents {
  "sensor:snapshot": (snapshot: SensorSnapshot) => void;
}

export type ClientToServerEvents = Record<never, never>;
export type InterServerEvents = Record<never, never>;

export interface SocketData {
  sensorId: string;
}

export const SENSOR_SNAPSHOT_CHANNEL = "water_quality_sensor_snapshots";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSensorUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function sensorRoomName(sensorId: string): string {
  return `sensor:${sensorId}`;
}
