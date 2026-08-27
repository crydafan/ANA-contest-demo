import assert from "node:assert/strict";
import test from "node:test";

import { isSensorUuid, sensorRoomName } from "@ana-contest-demo/contract";

import {
  parseSensorReadingInput,
  SensorReadingValidationError,
} from "@/features/water-quality/sensor-readings";

const VALID_INPUT = {
  sensor: {
    id: "1BBF0DFA-E3D8-4DE8-8B7E-3C521A7B4761",
    name: "  Río Añasmayo  ",
    latitude: -11.388661,
    longitude: -76.769007,
    status: "stable",
  },
  measuredAt: "2026-08-27T13:30:00-05:00",
  measurements: [
    { key: "ph", value: 7.82 },
    { key: "temperature", value: null },
  ],
};

test("parses and normalizes a partial sensor batch", () => {
  const input = parseSensorReadingInput(VALID_INPUT);
  assert.equal(input.sensor.id, "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761");
  assert.equal(input.sensor.name, "Río Añasmayo");
  assert.equal(input.measuredAt, "2026-08-27T18:30:00.000Z");
  assert.equal(input.measurements[1]?.value, null);
});

test("rejects duplicate and unknown parameters", () => {
  assert.throws(
    () =>
      parseSensorReadingInput({
        ...VALID_INPUT,
        measurements: [
          { key: "ph", value: 7 },
          { key: "ph", value: 8 },
        ],
      }),
    SensorReadingValidationError,
  );
  assert.throws(
    () =>
      parseSensorReadingInput({
        ...VALID_INPUT,
        measurements: [{ key: "salinity", value: 2 }],
      }),
    SensorReadingValidationError,
  );
});

test("rejects invalid metadata, timestamps, and values", () => {
  assert.throws(
    () =>
      parseSensorReadingInput({
        ...VALID_INPUT,
        sensor: { ...VALID_INPUT.sensor, latitude: 91 },
      }),
    SensorReadingValidationError,
  );
  assert.throws(
    () => parseSensorReadingInput({ ...VALID_INPUT, measuredAt: "yesterday" }),
    SensorReadingValidationError,
  );
  assert.throws(
    () => parseSensorReadingInput({ ...VALID_INPUT, measuredAt: "2026-08-27" }),
    SensorReadingValidationError,
  );
  assert.throws(
    () =>
      parseSensorReadingInput({
        ...VALID_INPUT,
        measuredAt: "2026-02-30T18:30:00.000Z",
      }),
    SensorReadingValidationError,
  );
  assert.throws(
    () =>
      parseSensorReadingInput({
        ...VALID_INPUT,
        measurements: [{ key: "ph", value: Number.POSITIVE_INFINITY }],
      }),
    SensorReadingValidationError,
  );
});

test("validates sensor UUIDs and creates stable room names", () => {
  const sensorId = "1bbf0dfa-e3d8-4de8-8b7e-3c521a7b4761";
  assert.equal(isSensorUuid(sensorId), true);
  assert.equal(isSensorUuid("not-a-uuid"), false);
  assert.equal(sensorRoomName(sensorId), `sensor:${sensorId}`);
});
