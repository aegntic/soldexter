import { createClient, type RedisClientType } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client: RedisClientType | null = null;

export function getRedis(): RedisClientType {
  if (!client) {
    client = createClient(REDIS_URL);
    client.on('error', (err) => console.error('Redis bridge error:', err));
    client.connect().catch(() => console.warn('Redis not available — signal bus disabled'));
  }
  return client;
}

export const REKT_CHANNELS = {
  signalEvents: 'signal.events',
  reconSignals: 'mas:recon:signals',
  detectResults: 'mas:detect:results',
  riskAlerts: 'mas:risk:alerts',
  economySettled: 'mas:economy:settled',
} as const;

export async function publishSignal(channel: keyof typeof REKT_CHANNELS, payload: unknown): Promise<void> {
  const r = getRedis();
  const key = REKT_CHANNELS[channel];
  try {
    await r.publish(key, JSON.stringify(payload));
  } catch {
    console.warn(`Failed to publish to ${key}`);
  }
}

export async function subscribeSignals(
  channel: keyof typeof REKT_CHANNELS,
  handler: (msg: unknown) => void | Promise<void>,
): Promise<void> {
  const r = getRedis();
  const key = REKT_CHANNELS[channel];
  await r.subscribe(key, (err, count) => {
    if (err) console.error(`Subscribe ${key} error:`, err);
  });
  r.on('message', (ch, raw) => {
    if (ch === key) {
      try { handler(JSON.parse(raw)); } catch { /* skip malformed */ }
    }
  });
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
