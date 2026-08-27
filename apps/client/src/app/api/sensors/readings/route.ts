import { ingestSensorReading } from "@/features/water-quality/data-access";
import {
  parseSensorReadingInput,
  SensorReadingValidationError,
} from "@/features/water-quality/sensor-readings";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    const input = parseSensorReadingInput(await request.json());
    return Response.json({ data: await ingestSensorReading(input) });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse(
        400,
        "invalid_json",
        "The request body is not valid JSON.",
      );
    }
    if (error instanceof SensorReadingValidationError) {
      return errorResponse(400, "invalid_payload", error.message);
    }
    console.error("Unable to ingest sensor readings.", error);
    return errorResponse(
      500,
      "ingestion_failed",
      "The sensor reading could not be persisted.",
    );
  }
}
