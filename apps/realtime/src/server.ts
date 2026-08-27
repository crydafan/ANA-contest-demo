import "dotenv/config";

import { createTerminus } from "@godaddy/terminus";
import { createAdapter } from "@socket.io/redis-adapter";
import helmet from "helmet";
import { Redis } from "ioredis";

import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { createRealtimeApplication } from "./socket-app.js";

async function start(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const redisPublisher = new Redis(config.redisUrl, {
    lazyConnect: true,
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
  });
  const redisSubscriber = redisPublisher.duplicate();
  for (const [role, redis] of [
    ["publisher", redisPublisher],
    ["subscriber", redisSubscriber],
  ] as const) {
    redis.on("error", (error) => {
      logger.error({ error, role }, "Redis connection failed.");
    });
  }

  await Promise.all([redisPublisher.connect(), redisSubscriber.connect()]);

  const realtime = createRealtimeApplication({
    allowedOrigins: config.allowedOrigins,
    isRedisReady: () =>
      redisPublisher.status === "ready" && redisSubscriber.status === "ready",
    logger,
  });
  realtime.io.adapter(
    createAdapter(redisPublisher, redisSubscriber, {
      key: config.redisChannelPrefix,
      publishOnSpecificResponseChannel: true,
    }),
  );

  const server = realtime.app.listen(config.port, "0.0.0.0", () => {
    logger.info(
      { host: "0.0.0.0", port: config.port },
      "Realtime service listening.",
    );
  });
  realtime.io.attach(server);
  realtime.io.engine.use(helmet());

  createTerminus(server, {
    signals: ["SIGINT", "SIGTERM"],
    timeout: 10_000,
    useExit0: true,
    logger: (message, error) => logger.error({ error }, message),
    onSignal: async () => {
      logger.info("Realtime service is shutting down.");
      realtime.io.disconnectSockets(true);
      await Promise.allSettled([redisSubscriber.quit(), redisPublisher.quit()]);
    },
  });
}

start().catch((error: unknown) => {
  const logger = createLogger("error");
  logger.fatal({ error }, "Unable to start the realtime service.");
  process.exitCode = 1;
});
