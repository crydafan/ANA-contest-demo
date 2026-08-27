import type {
  MeasurementSnapshot,
  WaterQualityParameterKey,
  WaterQualityStatus,
} from "@/data/water-quality";

export const WATER_QUALITY_PARAMETER_LABELS = {
  ph: "pH",
  temperature: "Temperatura",
  conductivity: "Conductividad",
  dissolved_oxygen: "Oxígeno disuelto",
  sulfates: "Sulfatos",
  total_nitrogen: "Nitrógeno total",
  e_coli: "E. coli",
  thermotolerant_coliforms: "Coliformes termotolerantes",
  turbidity: "Turbidez",
  lead: "Plomo",
  zinc: "Zinc",
} as const satisfies Record<WaterQualityParameterKey, string>;

export const WATER_QUALITY_STATUS_PRESENTATION = {
  stable: {
    label: "Estable",
    description:
      "Las últimas mediciones muestran condiciones estables para este punto de monitoreo.",
  },
  observation: {
    label: "En observación",
    description:
      "Las últimas mediciones presentan variaciones que deben mantenerse en observación.",
  },
  attention: {
    label: "Requiere atención",
    description:
      "Las últimas mediciones muestran parámetros que requieren atención y seguimiento.",
  },
} as const satisfies Record<
  WaterQualityStatus,
  { label: string; description: string }
>;

const WATER_QUALITY_PARAMETER_PRECISION = {
  ph: 2,
  temperature: 1,
  conductivity: 0,
  dissolved_oxygen: 2,
  sulfates: 2,
  total_nitrogen: 3,
  e_coli: 0,
  thermotolerant_coliforms: 0,
  turbidity: 1,
  lead: 3,
  zinc: 3,
} as const satisfies Record<WaterQualityParameterKey, number>;

export function formatMeasurementValue({
  key,
  value,
}: MeasurementSnapshot): string {
  if (value === null) return "—";

  return value.toFixed(WATER_QUALITY_PARAMETER_PRECISION[key]);
}

const MEASUREMENT_DATE_FORMATTER = new Intl.DateTimeFormat("es-PE", {
  dateStyle: "medium",
  timeStyle: "medium",
});

export function formatMeasuredAt(measuredAt: string | null): string {
  if (measuredAt === null) return "Sin lecturas disponibles";
  return MEASUREMENT_DATE_FORMATTER.format(new Date(measuredAt));
}
