import {
  isSensorUuid,
  WATER_QUALITY_PARAMETERS,
  WATER_QUALITY_STATUSES,
  type WaterQualityParameterKey,
  type WaterQualityStatus,
} from "@ana-contest-demo/water-quality-contract";

const PARAMETER_KEYS = new Set<string>(
  WATER_QUALITY_PARAMETERS.map(({ key }) => key),
);
const STATUSES = new Set<string>(WATER_QUALITY_STATUSES);
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

export interface SensorReadingInput {
  sensor: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    status: WaterQualityStatus;
  };
  measuredAt: string;
  measurements: Array<{
    key: WaterQualityParameterKey;
    value: number | null;
  }>;
}

export class SensorReadingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SensorReadingValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoTimestamp(value: string): boolean {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    match[1],
    match[2],
    match[3],
    match[4],
    match[5],
    match[6],
    match[8],
    match[9],
  ].map((part) => Number(part ?? 0));
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][month - 1];
  return (
    year > 0 &&
    daysInMonth !== undefined &&
    day > 0 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function requireFiniteNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new SensorReadingValidationError(
      `${field} must be a finite number between ${minimum} and ${maximum}.`,
    );
  }
  return value;
}

export { isSensorUuid };

export function parseSensorReadingInput(input: unknown): SensorReadingInput {
  if (!isRecord(input) || !isRecord(input.sensor)) {
    throw new SensorReadingValidationError(
      "The request must contain a sensor object.",
    );
  }
  const { sensor } = input;
  if (typeof sensor.id !== "string" || !isSensorUuid(sensor.id)) {
    throw new SensorReadingValidationError("sensor.id must be a valid UUID.");
  }
  if (typeof sensor.name !== "string" || sensor.name.trim().length === 0) {
    throw new SensorReadingValidationError("sensor.name is required.");
  }
  const name = sensor.name.trim();
  if (name.length > 255) {
    throw new SensorReadingValidationError(
      "sensor.name cannot exceed 255 characters.",
    );
  }
  if (typeof sensor.status !== "string" || !STATUSES.has(sensor.status)) {
    throw new SensorReadingValidationError(
      "sensor.status must be stable, observation, or attention.",
    );
  }
  if (
    typeof input.measuredAt !== "string" ||
    !isIsoTimestamp(input.measuredAt)
  ) {
    throw new SensorReadingValidationError(
      "measuredAt must be an ISO 8601 timestamp.",
    );
  }
  const measuredAt = new Date(input.measuredAt);
  if (Number.isNaN(measuredAt.getTime())) {
    throw new SensorReadingValidationError(
      "measuredAt must be an ISO 8601 timestamp.",
    );
  }
  if (!Array.isArray(input.measurements) || input.measurements.length === 0) {
    throw new SensorReadingValidationError(
      "measurements must contain at least one reading.",
    );
  }

  const keys = new Set<string>();
  const measurements = input.measurements.map((measurement, index) => {
    if (!isRecord(measurement) || typeof measurement.key !== "string") {
      throw new SensorReadingValidationError(
        `measurements[${index}].key is required.`,
      );
    }
    if (!PARAMETER_KEYS.has(measurement.key)) {
      throw new SensorReadingValidationError(
        `measurements[${index}].key is not a known parameter.`,
      );
    }
    if (keys.has(measurement.key)) {
      throw new SensorReadingValidationError(
        `Parameter ${measurement.key} appears more than once.`,
      );
    }
    keys.add(measurement.key);
    if (
      measurement.value !== null &&
      (typeof measurement.value !== "number" ||
        !Number.isFinite(measurement.value))
    ) {
      throw new SensorReadingValidationError(
        `measurements[${index}].value must be a finite number or null.`,
      );
    }
    return {
      key: measurement.key as WaterQualityParameterKey,
      value: measurement.value as number | null,
    };
  });

  return {
    sensor: {
      id: sensor.id.toLowerCase(),
      name,
      latitude: requireFiniteNumber(
        sensor.latitude,
        "sensor.latitude",
        -90,
        90,
      ),
      longitude: requireFiniteNumber(
        sensor.longitude,
        "sensor.longitude",
        -180,
        180,
      ),
      status: sensor.status as WaterQualityStatus,
    },
    measuredAt: measuredAt.toISOString(),
    measurements,
  };
}
