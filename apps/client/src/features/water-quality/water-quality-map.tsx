"use client";

import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@ana-contest-demo/water-quality-contract";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Map as BaseMap,
  MapControls,
  MapMarker,
  MapPopup,
  MarkerContent,
} from "@/components/ui/map";
import type { SensorSnapshot } from "@/data/water-quality";
import {
  formatMeasuredAt,
  formatMeasurementValue,
  WATER_QUALITY_PARAMETER_LABELS,
  WATER_QUALITY_STATUS_PRESENTATION,
} from "@/features/water-quality/presentation";
import {
  getRealtimeUrl,
  isSensorSnapshot,
  mergeSensorSnapshots,
  type RealtimeConnectionState,
} from "@/features/water-quality/realtime";
import { cn } from "@/lib/utils";

const MAP_BOUNDS: [[number, number], [number, number]] = [
  [-77.028234, -11.388661],
  [-76.657, -11.223],
];

const STATUS_STYLES = {
  stable: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  observation: "bg-amber-50 text-amber-700 ring-amber-200",
  attention: "bg-rose-50 text-rose-700 ring-rose-200",
} as const;

function StatusBadge({ sensor }: { sensor: SensorSnapshot }) {
  const status = WATER_QUALITY_STATUS_PRESENTATION[sensor.status];

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATUS_STYLES[sensor.status],
      )}
    >
      {status.label}
    </span>
  );
}

function SensorMarker({ sensor }: { sensor: SensorSnapshot }) {
  return (
    <span className="relative block h-12 w-10 drop-shadow-[0_3px_4px_rgba(0,0,0,0.28)]">
      <span className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-[58%] -rotate-45 rounded-[50%_50%_50%_7px] border-[3px] border-white bg-[#009dbd]">
        <span className="absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#009dbd]" />
      </span>
      <span className="sr-only">Ver sensor {sensor.name}</span>
    </span>
  );
}

function SensorPopup({
  sensor,
  onClose,
  onOpenDetails,
}: {
  sensor: SensorSnapshot;
  onClose: () => void;
  onOpenDetails: () => void;
}) {
  const status = WATER_QUALITY_STATUS_PRESENTATION[sensor.status];

  return (
    <MapPopup
      longitude={sensor.longitude}
      latitude={sensor.latitude}
      onClose={onClose}
      closeOnClick={false}
      focusAfterOpen={false}
      offset={28}
      className="max-w-none border-0 bg-transparent p-0 shadow-none"
    >
      <Card className="w-[min(21rem,calc(100vw-2rem))] gap-4 rounded-2xl border border-slate-200 bg-white py-5 shadow-xl">
        <CardHeader className="gap-3 pr-12">
          <CardTitle className="text-lg font-semibold leading-snug text-slate-900">
            {sensor.name}
          </CardTitle>
          <StatusBadge sensor={sensor} />
          <CardDescription className="text-sm leading-6 text-slate-600">
            {status.description}
          </CardDescription>
        </CardHeader>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Cerrar información del sensor"
          className="absolute right-3 top-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="size-5" />
        </Button>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-10 w-full border-slate-300 text-slate-800"
            onClick={onOpenDetails}
          >
            Ver más información
          </Button>
        </CardContent>
      </Card>
    </MapPopup>
  );
}

function MeasurementList({ sensor }: { sensor: SensorSnapshot }) {
  return (
    <div className="divide-y divide-dotted divide-slate-300 border-y border-dotted border-slate-300">
      {sensor.measurements.map((measurement) => {
        const hasValue = measurement.value !== null;

        return (
          <div
            key={measurement.key}
            className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3"
          >
            <div className="min-w-0">
              <span className="text-[15px] leading-5 font-medium text-slate-800 sm:text-base">
                {WATER_QUALITY_PARAMETER_LABELS[measurement.key]}
              </span>
              {hasValue ? (
                <span className="ml-1.5 whitespace-nowrap text-xs text-slate-500">
                  ({measurement.unit})
                </span>
              ) : null}
            </div>
            <output className="min-w-24 border border-slate-200 bg-slate-50 px-3 py-1.5 text-right text-base tabular-nums text-slate-950">
              {formatMeasurementValue(measurement)}
            </output>
          </div>
        );
      })}
    </div>
  );
}

function SensorDrawer({
  sensor,
  open,
  onOpenChange,
  onSnapshot,
}: {
  sensor: SensorSnapshot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnapshot: (snapshot: SensorSnapshot) => void;
}) {
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>("connecting");
  const status = sensor
    ? WATER_QUALITY_STATUS_PRESENTATION[sensor.status]
    : null;
  const sensorId = sensor?.id ?? null;

  useEffect(() => {
    if (!open || sensorId === null) return;
    let disposed = false;
    let realtimeSocket: Socket<
      ServerToClientEvents,
      ClientToServerEvents
    > | null = null;
    const abortController = new AbortController();

    const acceptSnapshot = (value: unknown) => {
      if (isSensorSnapshot(value) && value.id === sensorId) onSnapshot(value);
    };
    const refreshSnapshot = async () => {
      try {
        const response = await fetch(`/api/sensors/${sensorId}`, {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { data?: unknown };
        acceptSnapshot(payload.data);
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error(`Unable to refresh sensor ${sensorId}.`, error);
        }
      }
    };
    const connectRealtime = async () => {
      const { io } = await import("socket.io-client");
      if (disposed) return;
      const socket = io(getRealtimeUrl(), {
        auth: { sensorId },
        reconnection: true,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 10_000,
      }) as Socket<ServerToClientEvents, ClientToServerEvents>;
      realtimeSocket = socket;
      socket.on("connect", () => setConnectionState("live"));
      socket.on("sensor:snapshot", acceptSnapshot);
      socket.on("disconnect", () => {
        if (!disposed && socket.active) setConnectionState("reconnecting");
      });
      socket.on("connect_error", () => {
        if (!disposed) setConnectionState("reconnecting");
      });
      socket.io.on("reconnect_attempt", () => {
        if (!disposed) setConnectionState("reconnecting");
      });
    };

    setConnectionState("connecting");
    void connectRealtime();
    void refreshSnapshot();
    return () => {
      disposed = true;
      abortController.abort();
      realtimeSocket?.disconnect();
    };
  }, [open, sensorId, onSnapshot]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} swipeDirection="right">
      <DrawerContent className="[--drawer-content-width:100%] sm:[--drawer-content-width:40rem]">
        {sensor && status ? (
          <>
            <DrawerHeader className="gap-4 border-b border-slate-200 p-6 pr-16 sm:p-8 sm:pr-20">
              <DrawerTitle className="text-xl leading-snug font-bold text-slate-900 sm:text-2xl">
                {sensor.name}
              </DrawerTitle>
              <StatusBadge sensor={sensor} />
              <DrawerDescription className="text-base leading-6 text-slate-600">
                {status.description}
              </DrawerDescription>
            </DrawerHeader>
            <DrawerClose
              aria-label="Cerrar detalle del sensor"
              className="absolute right-5 top-5 z-10 inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009dbd] sm:right-7 sm:top-7"
            >
              <X className="size-5" />
            </DrawerClose>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
              <div className="mb-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Parámetros monitoreados
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                      connectionState === "live"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        connectionState === "live"
                          ? "bg-emerald-500"
                          : "animate-pulse bg-slate-400",
                      )}
                    />
                    {connectionState === "live"
                      ? "En vivo"
                      : connectionState === "reconnecting"
                        ? "Reconectando"
                        : "Conectando"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Última lectura: {formatMeasuredAt(sensor.measuredAt)}
                </p>
              </div>
              <MeasurementList sensor={sensor} />
              <p className="mt-5 text-xs leading-5 text-slate-500">
                Los estados mostrados son datos de demostración y no representan
                una evaluación normativa oficial.
              </p>
            </div>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}

export function WaterQualityMap({
  initialSensors,
}: {
  initialSensors: readonly SensorSnapshot[];
}) {
  const [sensors, setSensors] = useState(() => [...initialSensors]);
  const [popupSensorId, setPopupSensorId] = useState<string | null>(null);
  const [drawerSensorId, setDrawerSensorId] = useState<string | null>(null);

  const popupSensor =
    sensors.find((sensor) => sensor.id === popupSensorId) ?? null;
  const drawerSensor =
    sensors.find((sensor) => sensor.id === drawerSensorId) ?? null;

  const acceptSnapshot = useCallback((snapshot: SensorSnapshot) => {
    setSensors((currentSensors) =>
      currentSensors.map((sensor) =>
        sensor.id === snapshot.id
          ? mergeSensorSnapshots(sensor, snapshot)
          : sensor,
      ),
    );
  }, []);

  const openDetails = (sensorId: string) => {
    setPopupSensorId(null);
    setDrawerSensorId(sensorId);
  };

  return (
    <div className="relative size-full overflow-hidden bg-slate-100">
      <BaseMap
        theme="light"
        bounds={MAP_BOUNDS}
        fitBoundsOptions={{
          padding: { top: 110, right: 120, bottom: 100, left: 120 },
          maxZoom: 11,
        }}
        minZoom={7}
        maxZoom={16}
        className="size-full"
      >
        {sensors.map((sensor) => (
          <MapMarker
            key={sensor.id}
            longitude={sensor.longitude}
            latitude={sensor.latitude}
            anchor="bottom"
            onClick={() => setPopupSensorId(sensor.id)}
          >
            <MarkerContent>
              <button
                type="button"
                aria-label={`Ver sensor ${sensor.name}`}
                className="rounded-full outline-none focus-visible:ring-4 focus-visible:ring-[#009dbd]/35"
              >
                <SensorMarker sensor={sensor} />
              </button>
            </MarkerContent>
          </MapMarker>
        ))}

        {popupSensor ? (
          <SensorPopup
            sensor={popupSensor}
            onClose={() => setPopupSensorId(null)}
            onOpenDetails={() => openDetails(popupSensor.id)}
          />
        ) : null}

        <MapControls position="bottom-right" />
      </BaseMap>

      <SensorDrawer
        sensor={drawerSensor}
        open={drawerSensor !== null}
        onOpenChange={(open) => {
          if (!open) setDrawerSensorId(null);
        }}
        onSnapshot={acceptSnapshot}
      />
    </div>
  );
}
