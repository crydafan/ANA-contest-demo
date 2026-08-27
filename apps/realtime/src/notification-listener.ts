import { SENSOR_SNAPSHOT_CHANNEL } from "@ana-contest-demo/water-quality-contract";
import { Client } from "pg";

export class SensorNotificationListener {
  private client: Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly databaseUrl: string,
    private readonly onSensorChanged: (
      sensorId: string,
    ) => void | Promise<void>,
  ) {}

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const client = this.client;
    this.client = null;
    await client?.end().catch(() => undefined);
  }

  private scheduleReconnect(client: Client): void {
    if (this.stopped || this.client !== client) return;
    this.client = null;
    void client.end().catch(() => undefined);
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 5_000);
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const client = new Client({ connectionString: this.databaseUrl });
    this.client = client;
    client.on("notification", (notification) => {
      if (
        notification.channel === SENSOR_SNAPSHOT_CHANNEL &&
        notification.payload
      ) {
        void this.onSensorChanged(notification.payload);
      }
    });
    client.on("error", (error) => {
      console.error("PostgreSQL notification connection failed.", error);
      this.scheduleReconnect(client);
    });
    client.on("end", () => this.scheduleReconnect(client));

    try {
      await client.connect();
      await client.query(`LISTEN ${SENSOR_SNAPSHOT_CHANNEL}`);
    } catch (error) {
      console.error("Unable to listen for sensor notifications.", error);
      this.scheduleReconnect(client);
    }
  }
}
