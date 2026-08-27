import {
  type SensorSnapshot,
  type ServerToClientEvents,
  sensorRoomName,
} from "@ana-contest-demo/contract";
import { Emitter } from "@socket.io/redis-emitter";
import Redis from "ioredis";

export interface SensorSnapshotPublisher {
  publish: (snapshot: SensorSnapshot) => void;
}

export class RealtimeUnavailableError extends Error {
  constructor() {
    super("The realtime event publisher is unavailable.");
    this.name = "RealtimeUnavailableError";
  }
}

class RedisSensorSnapshotPublisher implements SensorSnapshotPublisher {
  private readonly emitter: Emitter<ServerToClientEvents>;

  constructor(
    private readonly redis: Redis,
    channelPrefix: string,
  ) {
    this.emitter = new Emitter<ServerToClientEvents>(redis, {
      key: channelPrefix,
    });
  }

  publish(snapshot: SensorSnapshot): void {
    if (this.redis.status !== "ready") {
      throw new RealtimeUnavailableError();
    }
    this.emitter
      .to(sensorRoomName(snapshot.id))
      .emit("sensor:snapshot", snapshot);
  }
}

const globalPublisher = globalThis as typeof globalThis & {
  anaSnapshotPublisher?: SensorSnapshotPublisher;
};

export function getSensorSnapshotPublisher(): SensorSnapshotPublisher {
  if (globalPublisher.anaSnapshotPublisher) {
    return globalPublisher.anaSnapshotPublisher;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new RealtimeUnavailableError();

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });
  redis.on("error", (error) => {
    console.error("Redis publisher connection failed.", error);
  });
  const publisher = new RedisSensorSnapshotPublisher(
    redis,
    process.env.REDIS_CHANNEL_PREFIX ?? "ana-contest-demo:socket.io",
  );
  globalPublisher.anaSnapshotPublisher = publisher;
  return publisher;
}
