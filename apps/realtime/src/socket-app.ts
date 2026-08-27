import { createServer, type Server as HttpServer } from "node:http";

import {
  type ClientToServerEvents,
  type InterServerEvents,
  isSensorUuid,
  type SensorSnapshot,
  type ServerToClientEvents,
  type SocketData,
  sensorRoomName,
} from "@ana-contest-demo/water-quality-contract";
import cors from "cors";
import express, { type Express } from "express";
import { Server } from "socket.io";

export type SensorSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export interface RealtimeApplication {
  app: Express;
  httpServer: HttpServer;
  io: SensorSocketServer;
  emitSnapshot: (snapshot: SensorSnapshot) => void;
}

export function createRealtimeApplication(
  allowedOrigins: readonly string[],
): RealtimeApplication {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: [...allowedOrigins] }));
  app.use(express.json({ limit: "32kb" }));

  const httpServer = createServer(app);
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: { origin: [...allowedOrigins], methods: ["GET", "POST"] },
  });

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      connections: io.engine.clientsCount,
    });
  });

  io.use((socket, next) => {
    const sensorId = socket.handshake.auth.sensorId;
    if (typeof sensorId !== "string" || !isSensorUuid(sensorId)) {
      next(new Error("A valid sensorId is required."));
      return;
    }
    socket.data.sensorId = sensorId.toLowerCase();
    next();
  });

  io.on("connection", (socket) => {
    void socket.join(sensorRoomName(socket.data.sensorId));
  });

  return {
    app,
    httpServer,
    io,
    emitSnapshot(snapshot) {
      io.to(sensorRoomName(snapshot.id)).emit("sensor:snapshot", snapshot);
    },
  };
}
