import { getSensorSnapshot } from "@/features/water-quality/data-access";
import { isSensorUuid } from "@/features/water-quality/sensor-readings";

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sensorId: string }> },
) {
  const { sensorId } = await context.params;
  if (!isSensorUuid(sensorId)) {
    return errorResponse(
      400,
      "invalid_sensor_id",
      "The sensor ID is not a valid UUID.",
    );
  }
  try {
    const sensor = await getSensorSnapshot(sensorId);
    return sensor
      ? Response.json({ data: sensor })
      : errorResponse(404, "sensor_not_found", "The sensor does not exist.");
  } catch (error) {
    console.error(`Unable to load sensor ${sensorId}.`, error);
    return errorResponse(
      500,
      "sensor_load_failed",
      "The sensor snapshot could not be loaded.",
    );
  }
}
