CREATE TABLE "measurements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "measurements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sensor_id" integer NOT NULL,
	"parameter_id" integer NOT NULL,
	"value" double precision,
	"measured_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parameters" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "parameters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" varchar(64) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sensors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "measurements_sensor_parameter_time_unique" ON "measurements" ("sensor_id","parameter_id","measured_at");--> statement-breakpoint
CREATE INDEX "measurements_sensor_time_idx" ON "measurements" ("sensor_id","measured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "measurements_parameter_time_idx" ON "measurements" ("parameter_id","measured_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "parameters_key_unique" ON "parameters" ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "sensors_uuid_unique" ON "sensors" ("uuid");--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_sensor_id_sensors_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_parameter_id_parameters_id_fkey" FOREIGN KEY ("parameter_id") REFERENCES "parameters"("id") ON DELETE RESTRICT;