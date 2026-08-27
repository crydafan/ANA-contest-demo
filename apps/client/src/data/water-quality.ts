import {
  type MeasurementSnapshot,
  type SensorSnapshot,
  WATER_QUALITY_PARAMETERS,
  type WaterQualityParameterKey,
} from "@ana-contest-demo/water-quality-contract";

export {
  type MeasurementSnapshot,
  type SensorSnapshot,
  WATER_QUALITY_PARAMETERS,
  type WaterQualityParameterKey,
  type WaterQualityStatus,
} from "@ana-contest-demo/water-quality-contract";

export const WATER_QUALITY_MEASURED_AT = "2026-08-26T17:00:00.000Z";

type MeasurementValues = Record<WaterQualityParameterKey, number | null>;

function createMeasurements(
  values: MeasurementValues,
): readonly MeasurementSnapshot[] {
  return WATER_QUALITY_PARAMETERS.map(({ key, unit }) => ({
    key,
    value: values[key],
    unit,
    measuredAt: WATER_QUALITY_MEASURED_AT,
  }));
}

export const WATER_QUALITY_SENSORS: readonly SensorSnapshot[] = [
  {
    id: "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761",
    name: "Río Añasmayo – aguas arriba del C.P. La Perla",
    latitude: -11.388661,
    longitude: -76.769007,
    status: "stable",
    statusMeasuredAt: WATER_QUALITY_MEASURED_AT,
    measuredAt: WATER_QUALITY_MEASURED_AT,
    measurements: createMeasurements({
      ph: 8.02,
      temperature: 19.5,
      conductivity: 425,
      dissolved_oxygen: 9.45,
      sulfates: 72.35,
      total_nitrogen: 1.342,
      e_coli: 490,
      thermotolerant_coliforms: 790,
      turbidity: null,
      lead: null,
      zinc: 0.206,
    }),
  },
  {
    id: "e6d01d9f-019e-4cc4-918b-cdfd18bd9027",
    name: "Río Chancay-Huaral – Puente Callantama",
    latitude: -11.223,
    longitude: -76.657,
    status: "observation",
    statusMeasuredAt: WATER_QUALITY_MEASURED_AT,
    measuredAt: WATER_QUALITY_MEASURED_AT,
    measurements: createMeasurements({
      ph: 7.74,
      temperature: 20.1,
      conductivity: 398,
      dissolved_oxygen: 8.92,
      sulfates: 68.4,
      total_nitrogen: 1.18,
      e_coli: 350,
      thermotolerant_coliforms: 540,
      turbidity: 6.8,
      lead: 0.004,
      zinc: 0.172,
    }),
  },
  {
    id: "73e576ad-04a2-4748-b78a-11dd9798b612",
    name: "Río Chancay-Huaral – sector Santo Domingo",
    latitude: -11.370121,
    longitude: -77.028234,
    status: "attention",
    statusMeasuredAt: WATER_QUALITY_MEASURED_AT,
    measuredAt: WATER_QUALITY_MEASURED_AT,
    measurements: createMeasurements({
      ph: 7.58,
      temperature: 21,
      conductivity: 512,
      dissolved_oxygen: 8.21,
      sulfates: 81.2,
      total_nitrogen: 1.56,
      e_coli: 620,
      thermotolerant_coliforms: 920,
      turbidity: 12.4,
      lead: 0.008,
      zinc: 0.231,
    }),
  },
] as const;
