import { describe, expect, test } from 'bun:test';
import { GmgnClient, GmgnRouteError } from './gmgn.js';
import { SequentialBucket, gmgnRetryWaitMs } from './rate-limit.js';

describe('gmgnRetryWaitMs', () => {
  test('retries a short 429 once and refuses a long ban', () => {
    expect(gmgnRetryWaitMs({
      httpStatus: 429,
      resetAtUnix: 100,
      nowMs: 99_000,
      attempt: 0,
    })).toBe(2000);
    expect(gmgnRetryWaitMs({
      httpStatus: 429,
      resetAtUnix: 100,
      nowMs: 99_000,
      attempt: 1,
    })).toBeNull();
    expect(gmgnRetryWaitMs({
      httpStatus: 429,
      apiError: 'RATE_LIMIT_BANNED',
      resetAtUnix: 500,
      nowMs: 0,
      attempt: 0,
    })).toBeNull();
  });
});

describe('SequentialBucket', () => {
  test('runs calls one at a time', async () => {
    let now = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const bucket = new SequentialBucket(1000, 5, async (ms) => {
      now += ms;
    }, () => now);
    const run = () => bucket.schedule(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      inFlight -= 1;
      return true;
    });
    await Promise.all([run(), run(), run()]);
    expect(maxInFlight).toBe(1);
  });
});

describe('GmgnClient', () => {
  test('does not call swap, order, or cooking routes', async () => {
    let called = false;
    const client = new GmgnClient({
      apiKey: 'test',
      fetchImpl: async () => {
        called = true;
        return new Response('{}');
      },
      sleep: async () => undefined,
      now: () => 1_700_000_000_000,
    });
    await expect(client.request('POST', '/v1/trade/swap', {}, { amount: '1' })).rejects.toBeInstanceOf(GmgnRouteError);
    await expect(client.request('POST', '/v1/trade/multi_swap', {}, {})).rejects.toBeInstanceOf(GmgnRouteError);
    await expect(client.request('POST', '/v1/cooking/create_token', {}, {})).rejects.toBeInstanceOf(GmgnRouteError);
    await expect(client.request('GET', '/v1/trade/quote', {}, null)).rejects.toBeInstanceOf(GmgnRouteError);
    expect(called).toBe(false);
  });

  test('backs off once on 429 and then returns the payload', async () => {
    const calls: string[] = [];
    let now = 1_700_000_000_000;
    const client = new GmgnClient({
      apiKey: 'test-key',
      fetchImpl: async (url, init) => {
        calls.push(String(url));
        const headers = new Headers(init?.headers);
        expect(headers.get('X-APIKEY')).toBe('test-key');
        if (calls.length === 1) {
          return new Response(JSON.stringify({
            code: 429,
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'slow down',
            reset_at: Math.floor(now / 1000) + 1,
          }), { status: 429, headers: { 'x-ratelimit-reset': String(Math.floor(now / 1000) + 1) } });
        }
        return new Response(JSON.stringify({ code: 0, data: { ok: true } }), { status: 200 });
      },
      sleep: async (ms) => {
        now += ms;
      },
      now: () => now,
    });
    const data = await client.get('/v1/token/info', { chain: 'sol', address: 'Mint' });
    expect(data).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('https://openapi.gmgn.ai/v1/token/info');
    expect(calls[0]).not.toContain('gmgn.ai/defi');
  });
});
