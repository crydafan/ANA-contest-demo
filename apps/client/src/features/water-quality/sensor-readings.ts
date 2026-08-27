import {
  isSensorUuid,
  type SensorReadingInput,
  sensorReadingInputSchema,
} from "@ana-contest-demo/contract";

export type { SensorReadingInput };
export { isSensorUuid };

export class SensorReadingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SensorReadingValidationError";
  }
}

export function parseSensorReadingInput(input: unknown): SensorReadingInput {
  const result = sensorReadingInputSchema.safeParse(input);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const field = issue?.path.join(".");
  throw new SensorReadingValidationError(
    field
      ? `${field}: ${issue.message}`
      : (issue?.message ?? "Invalid payload."),
  );
}
