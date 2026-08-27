import { defineRelations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const sensors = pgTable(
  "sensors",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    uuid: uuid().defaultRandom().notNull(),
    name: varchar({ length: 255 }).notNull(),
    latitude: doublePrecision().notNull(),
    longitude: doublePrecision().notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("sensors_uuid_unique").on(table.uuid)],
);

export const parameters = pgTable(
  "parameters",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    key: varchar({ length: 64 }).notNull(),
    unit: varchar({ length: 32 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("parameters_key_unique").on(table.key)],
);

export const measurements = pgTable(
  "measurements",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    sensorId: integer("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "cascade" }),
    parameterId: integer("parameter_id")
      .notNull()
      .references(() => parameters.id, { onDelete: "restrict" }),
    value: doublePrecision(),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("measurements_sensor_parameter_time_unique").on(
      table.sensorId,
      table.parameterId,
      table.measuredAt,
    ),
    index("measurements_sensor_time_idx").on(
      table.sensorId,
      table.measuredAt.desc(),
    ),
    index("measurements_parameter_time_idx").on(
      table.parameterId,
      table.measuredAt.desc(),
    ),
  ],
);

export const waterQualityRelations = defineRelations(
  { sensors, parameters, measurements },
  (relations) => ({
    sensors: {
      measurements: relations.many.measurements(),
    },
    parameters: {
      measurements: relations.many.measurements(),
    },
    measurements: {
      sensor: relations.one.sensors({
        from: relations.measurements.sensorId,
        to: relations.sensors.id,
        optional: false,
      }),
      parameter: relations.one.parameters({
        from: relations.measurements.parameterId,
        to: relations.parameters.id,
        optional: false,
      }),
    },
  }),
);

export type Sensor = typeof sensors.$inferSelect;
export type NewSensor = typeof sensors.$inferInsert;
export type Parameter = typeof parameters.$inferSelect;
export type NewParameter = typeof parameters.$inferInsert;
export type Measurement = typeof measurements.$inferSelect;
export type NewMeasurement = typeof measurements.$inferInsert;
