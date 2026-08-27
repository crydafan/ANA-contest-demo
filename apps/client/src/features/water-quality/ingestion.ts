import type {
  SensorReadingInput,
  SensorSnapshot,
} from "@ana-contest-demo/contract";

import { ingestSensorReading } from "@/features/water-quality/data-access";
import {
  getSensorSnapshotPublisher,
  type SensorSnapshotPublisher,
} from "@/features/water-quality/snapshot-publisher";

interface IngestionDependencies {
  persist: (input: SensorReadingInput) => Promise<SensorSnapshot>;
  publisher: SensorSnapshotPublisher;
}

export async function ingestAndPublishSensorReading(
  input: SensorReadingInput,
  dependencies?: IngestionDependencies,
): Promise<SensorSnapshot> {
  const snapshot = await (dependencies?.persist ?? ingestSensorReading)(input);
  (dependencies?.publisher ?? getSensorSnapshotPublisher()).publish(snapshot);
  return snapshot;
}
