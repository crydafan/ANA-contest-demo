import type { SensorReadingInput } from "@ana-contest-demo/contract";
import {
  getAllSensorSnapshots as loadAllSensorSnapshots,
  getSensorSnapshot as loadSensorSnapshot,
  ingestSensorReading as persistSensorReading,
} from "@ana-contest-demo/db";

import { getDatabaseConnection } from "@/db";

export function getAllSensorSnapshots() {
  return loadAllSensorSnapshots(getDatabaseConnection().database);
}

export function getSensorSnapshot(sensorUuid: string) {
  return loadSensorSnapshot(getDatabaseConnection().database, sensorUuid);
}

export function ingestSensorReading(input: SensorReadingInput) {
  return persistSensorReading(getDatabaseConnection().database, input);
}
