import { z } from "zod";

const environmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  REDIS_URL: z.string().url(),
  REDIS_CHANNEL_PREFIX: z.string().min(1).default("ana-contest-demo:socket.io"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export interface RealtimeConfig {
  port: number;
  allowedOrigins: string[];
  redisUrl: string;
  redisChannelPrefix: string;
  logLevel: z.infer<typeof environmentSchema>["LOG_LEVEL"];
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): RealtimeConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new Error(`Invalid realtime configuration: ${result.error.message}`);
  }

  const allowedOrigins = result.data.CLIENT_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    allowedOrigins.length === 0 ||
    allowedOrigins.some((origin) => !URL.canParse(origin))
  ) {
    throw new Error(
      "Invalid realtime configuration: CLIENT_ORIGIN must contain valid URLs.",
    );
  }

  return {
    port: result.data.PORT,
    allowedOrigins,
    redisUrl: result.data.REDIS_URL,
    redisChannelPrefix: result.data.REDIS_CHANNEL_PREFIX,
    logLevel: result.data.LOG_LEVEL,
  };
}
