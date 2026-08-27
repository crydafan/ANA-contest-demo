import { ingestAndPublishSensorReading } from "@/features/water-quality/ingestion";
import {
  parseSensorReadingInput,
  SensorReadingValidationError,
} from "@/features/water-quality/sensor-readings";
import { RealtimeUnavailableError } from "@/features/water-quality/snapshot-publisher";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  try {
    const input = parseSensorReadingInput(await request.json());
    return Response.json({ data: await ingestAndPublishSensorReading(input) });
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
    if (error instanceof RealtimeUnavailableError) {
      return errorResponse(
        503,
        "realtime_unavailable",
        "The reading was persisted but could not be published in realtime. Retry the request.",
      );
    }
    console.error("Unable to ingest sensor readings.", error);
    return errorResponse(
      500,
      "ingestion_failed",
      "The sensor reading could not be persisted.",
    );
  }
}
