import { z } from "zod";

export const WATER_QUALITY_PARAMETER_KEYS = [
  "ph",
  "temperature",
  "conductivity",
  "dissolved_oxygen",
  "sulfates",
  "total_nitrogen",
  "e_coli",
  "thermotolerant_coliforms",
  "turbidity",
  "lead",
  "zinc",
] as const;

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

export const waterQualityParameterKeySchema = z.enum(
  WATER_QUALITY_PARAMETER_KEYS,
);
export const waterQualityStatusSchema = z.enum(WATER_QUALITY_STATUSES);

export type WaterQualityParameterKey = z.infer<
  typeof waterQualityParameterKeySchema
>;
export type WaterQualityStatus = z.infer<typeof waterQualityStatusSchema>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const sensorUuidSchema = z
  .string()
  .regex(UUID_PATTERN, "must be a valid UUID")
  .transform((value) => value.toLowerCase());

export const measurementSnapshotSchema = z
  .object({
    key: waterQualityParameterKeySchema,
    value: z.number().finite().nullable(),
    unit: z.string(),
    measuredAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const sensorSnapshotSchema = z
  .object({
    id: sensorUuidSchema,
    name: z.string(),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    status: waterQualityStatusSchema,
    statusMeasuredAt: z.string().datetime({ offset: true }),
    measuredAt: z.string().datetime({ offset: true }).nullable(),
    measurements: z.array(measurementSnapshotSchema),
  })
  .strict();

const sensorMeasurementInputSchema = z
  .object({
    key: waterQualityParameterKeySchema,
    value: z.number().finite().nullable(),
  })
  .strict();

export const sensorReadingInputSchema = z
  .object({
    sensor: z
      .object({
        id: sensorUuidSchema,
        name: z.string().trim().min(1).max(255),
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
        status: waterQualityStatusSchema,
      })
      .strict(),
    measuredAt: z
      .string()
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
    measurements: z
      .array(sensorMeasurementInputSchema)
      .min(1)
      .superRefine((measurements, context) => {
        const keys = new Set<WaterQualityParameterKey>();
        measurements.forEach((measurement, index) => {
          if (keys.has(measurement.key)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              path: [index, "key"],
              message: `Parameter ${measurement.key} appears more than once.`,
            });
          }
          keys.add(measurement.key);
        });
      }),
  })
  .strict();

export const socketAuthenticationSchema = z
  .object({ sensorId: sensorUuidSchema })
  .passthrough();

export type MeasurementSnapshot = z.infer<typeof measurementSnapshotSchema>;
export type SensorSnapshot = Omit<
  z.infer<typeof sensorSnapshotSchema>,
  "measurements"
> & {
  readonly measurements: readonly MeasurementSnapshot[];
};
export type SensorReadingInput = z.infer<typeof sensorReadingInputSchema>;

export interface ServerToClientEvents {
  "sensor:snapshot": (snapshot: SensorSnapshot) => void;
}

export type ClientToServerEvents = Record<never, never>;
export type InterServerEvents = Record<never, never>;

export interface SocketData {
  sensorId: string;
}

export function isSensorUuid(value: string): boolean {
  return sensorUuidSchema.safeParse(value).success;
}

export function sensorRoomName(sensorId: string): string {
  return `sensor:${sensorId}`;
}
