import {
  type ClientToServerEvents,
  type InterServerEvents,
  type ServerToClientEvents,
  type SocketData,
  sensorRoomName,
  socketAuthenticationSchema,
} from "@ana-contest-demo/contract";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { Server } from "socket.io";

import type { Logger } from "./logger.js";

export type SensorSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface RealtimeApplication {
  app: Express;
  io: SensorSocketServer;
}

interface RealtimeApplicationOptions {
  allowedOrigins: readonly string[];
  isRedisReady: () => boolean;
  logger: Logger;
}

export function createRealtimeApplication({
  allowedOrigins,
  isRedisReady,
  logger,
}: RealtimeApplicationOptions): RealtimeApplication {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: [...allowedOrigins] }));
  app.use(pinoHttp({ logger }));

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >({
    cors: { origin: [...allowedOrigins], methods: ["GET", "POST"] },
  });

  app.get("/health", (_request, response) => {
    const ready = isRedisReady();
    response.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "unavailable",
      redis: ready ? "ready" : "unavailable",
      connections: io.engine.clientsCount,
    });
  });

  io.use((socket, next) => {
    const authentication = socketAuthenticationSchema.safeParse(
      socket.handshake.auth,
    );
    if (!authentication.success) {
      next(new Error("A valid sensorId is required."));
      return;
    }
    socket.data.sensorId = authentication.data.sensorId;
    next();
  });

  io.on("connection", (socket) => {
    void socket.join(sensorRoomName(socket.data.sensorId));
    logger.debug(
      { socketId: socket.id, sensorId: socket.data.sensorId },
      "Socket connected.",
    );
    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "Socket disconnected.");
    });
  });

  return { app, io };
}
