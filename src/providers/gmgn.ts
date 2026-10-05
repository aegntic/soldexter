/**
 * GMGN OpenAPI read-only client (https://openapi.gmgn.ai).
 *
 * Auth is the official exist-auth mode: X-APIKEY plus timestamp and client_id.
 * This module does not call swap, multi-swap, order, quote, cooking, follow-wallet,
 * or wallet-holdings. Those routes need a signing key or submit trades.
 * GMGN_PRIVATE_KEY is never read.
 *
 * Free tier is a 5/5 leaky bucket. Calls are sequential and back off once on 429.
 */

import { randomUUID } from 'node:crypto';
import { featureState } from '../soldextra/registry.js';
import { GMGN_FREE_BURST, GMGN_FREE_RATE, SequentialBucket, gmgnRetryWaitMs } from './rate-limit.js';

export const GMGN_HOST = 'https://openapi.gmgn.ai';

/** Routes this build is allowed to call. Anything else throws before fetch. */
export const GMGN_ALLOWED_PATHS = [
  '/v1/token/info',
  '/v1/token/security',
  '/v1/token/pool_info',
  '/v1/market/token_kline',
  '/v1/market/token_top_holders',
  '/v1/market/token_top_traders',
  '/v1/market/rank',
  '/v1/user/wallet_activity',
  '/v1/user/wallet_stats',
  '/v1/user/wallet_token_balance',
  '/v1/user/kol',
  '/v1/user/smartmoney',
  '/v1/user/created_tokens',
  '/v1/user/info',
  '/v1/trenches',
] as const;

export type GmgnAllowedPath = (typeof GMGN_ALLOWED_PATHS)[number];

const ALLOWED = new Set<string>(GMGN_ALLOWED_PATHS);

export class GmgnRouteError extends Error {
  constructor(path: string) {
    super(`GMGN route ${path} is not available in this build (read-only query routes only; swap, order, and cooking are not wired)`);
    this.name = 'GmgnRouteError';
  }
}

export type GmgnFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface GmgnClientOptions {
  apiKey: string;
  host?: string;
  fetchImpl?: GmgnFetch;
  bucket?: SequentialBucket;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

type QueryValue = string | number | boolean | Array<string | number>;

function buildUrl(host: string, path: string, query: Record<string, QueryValue>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, String(item));
    } else {
      params.set(key, String(value));
    }
  }
  return `${host}${path}?${params.toString()}`;
}

export class GmgnClient {
  private readonly apiKey: string;
  private readonly host: string;
  private readonly fetchImpl: GmgnFetch;
  private readonly bucket: SequentialBucket;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(options: GmgnClientOptions) {
    this.apiKey = options.apiKey;
    this.host = (options.host ?? GMGN_HOST).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => Date.now());
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.bucket = options.bucket ?? new SequentialBucket(GMGN_FREE_RATE, GMGN_FREE_BURST, this.sleep, this.now);
  }

  async get(path: GmgnAllowedPath, query: Record<string, QueryValue> = {}): Promise<unknown> {
    return this.request('GET', path, query, null);
  }

  async post(path: GmgnAllowedPath, query: Record<string, QueryValue>, body: unknown): Promise<unknown> {
    return this.request('POST', path, query, body);
  }

  async request(
    method: 'GET' | 'POST',
    path: string,
    query: Record<string, QueryValue>,
    body: unknown,
  ): Promise<unknown> {
    if (!ALLOWED.has(path)) throw new GmgnRouteError(path);
    return this.bucket.schedule(async () => {
      let attempt = 0;
      for (;;) {
        const stamped = {
          ...query,
          timestamp: Math.floor(this.now() / 1000),
          client_id: randomUUID(),
        };
        const url = buildUrl(this.host, path, stamped);
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            'X-APIKEY': this.apiKey,
            'Content-Type': 'application/json',
            'User-Agent': 'soldexter-gmgn/1.0',
          },
          body: body === null ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        let json: { code?: number; data?: unknown; message?: string; error?: string; reset_at?: number } = {};
        try {
          json = text ? JSON.parse(text) as typeof json : {};
        } catch {
          throw new Error(`GMGN ${method} ${path} failed: HTTP ${response.status} (non-JSON response)`);
        }
        const resetHeader = response.headers.get('x-ratelimit-reset');
        const resetAt = json.reset_at ?? (resetHeader ? Number.parseInt(resetHeader, 10) : null);
        const wait = gmgnRetryWaitMs({
          httpStatus: response.status,
          apiError: json.error,
          resetAtUnix: Number.isFinite(resetAt) ? resetAt : null,
          nowMs: this.now(),
          attempt,
        });
        if (wait != null) {
          attempt += 1;
          await this.sleep(wait);
          continue;
        }
        if (response.status === 429 || json.error === 'RATE_LIMIT_EXCEEDED' || json.error === 'RATE_LIMIT_BANNED') {
          const when = Number.isFinite(resetAt) ? new Date((resetAt as number) * 1000).toISOString() : 'an unknown time';
          throw new Error(`GMGN ${method} ${path} rate limited until ${when}. Not retrying, so the ban is not extended.`);
        }
        if (!response.ok || json.code !== 0) {
          throw new Error(`GMGN ${method} ${path} failed: HTTP ${response.status} ${json.message ?? json.error ?? ''}`.trim());
        }
        return json.data;
      }
    });
  }
}

let shared: GmgnClient | null = null;
let sharedKey: string | null = null;

export function getGmgnClient(env: NodeJS.ProcessEnv = process.env): GmgnClient {
  const state = featureState('gmgn_query', env);
  if (!state.active) {
    throw new Error(state.unavailableReason ?? 'GMGN_API_KEY is not set');
  }
  const apiKey = env.GMGN_API_KEY as string;
  if (!shared || sharedKey !== apiKey) {
    shared = new GmgnClient({ apiKey });
    sharedKey = apiKey;
  }
  return shared;
}

/** Test hook. */
export function resetGmgnClient(): void {
  shared = null;
  sharedKey = null;
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  for (const key of ['list', 'rank', 'activities', 'trades', 'tokens', 'history', 'rows']) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return [];
}

export interface TokenSecurity {
  mint: string;
  is_honeypot: boolean | null;
  renounced: boolean | null;
  buy_tax: number | null;
  sell_tax: number | null;
  rug_ratio: number | null;
  holder_count: number | null;
  sniper_count: number | null;
  suspected_insider_hold_rate: number | null;
  fresh_wallet_rate: number | null;
  bundler_trader_amount_rate: number | null;
  creator: string | null;
  raw: unknown;
}

export async function getTokenSecurity(mint: string): Promise<TokenSecurity> {
  const data = asRecord(await getGmgnClient().get('/v1/token/security', { chain: 'sol', address: mint }));
  const row = asRecord(data.token_security ?? data.security ?? data);
  return {
    mint,
    is_honeypot: bool(row.is_honeypot ?? row.isHoneypot),
    renounced: bool(row.renounced ?? row.is_renounced),
    buy_tax: num(row.buy_tax ?? row.buyTax),
    sell_tax: num(row.sell_tax ?? row.sellTax),
    rug_ratio: num(row.rug_ratio ?? row.rugRatio),
    holder_count: num(row.holder_count ?? row.holderCount),
    sniper_count: num(row.sniper_count ?? row.sniperCount),
    suspected_insider_hold_rate: num(row.suspected_insider_hold_rate),
    fresh_wallet_rate: num(row.fresh_wallet_rate),
    bundler_trader_amount_rate: num(row.bundler_trader_amount_rate),
    creator: str(row.creator ?? row.creator_address),
    raw: data,
  };
}

export interface TrendingToken {
  mint: string | null;
  symbol: string | null;
  name: string | null;
  price: number | null;
  market_cap: number | null;
  liquidity: number | null;
  volume: number | null;
  raw: unknown;
}

export async function getTrendingTokens(
  timeframe = '1h',
  _orderBy = 'volume',
  _filters: string[] = [],
  limit = 20,
): Promise<TrendingToken[]> {
  const data = await getGmgnClient().get('/v1/market/rank', { chain: 'sol', interval: timeframe, limit });
  return asList(data).slice(0, limit).map((item) => {
    const row = asRecord(item);
    return {
      mint: str(row.address ?? row.mint ?? row.base_address),
      symbol: str(row.symbol),
      name: str(row.name),
      price: num(row.price),
      market_cap: num(row.market_cap ?? row.marketcap),
      liquidity: num(row.liquidity),
      volume: num(row.volume ?? row.volume_24h),
      raw: item,
    };
  });
}

export async function getTrenchTokens(
  type = 'new_creation',
  platform = 'all',
  limit = 20,
): Promise<TrendingToken[]> {
  const body: Record<string, unknown> = { version: 'v2' };
  body[type] = {
    filters: ['offchain', 'onchain'],
    launchpad_platform_v2: true,
    limit,
    ...(platform !== 'all' ? { launchpad_platform: [platform] } : {}),
  };
  const data = await getGmgnClient().post('/v1/trenches', { chain: 'sol' }, body);
  const record = asRecord(data);
  const section = asList(record[type] ?? data);
  return section.slice(0, limit).map((item) => {
    const row = asRecord(item);
    return {
      mint: str(row.address ?? row.mint),
      symbol: str(row.symbol),
      name: str(row.name),
      price: num(row.price),
      market_cap: num(row.market_cap),
      liquidity: num(row.liquidity),
      volume: num(row.volume),
      raw: item,
    };
  });
}

export interface TrackedTrade {
  token_mint: string | null;
  token_symbol: string | null;
  wallet: string | null;
  side: string | null;
  amount_usd: number | null;
  price: number | null;
  timestamp: number | null;
  tx_hash: string | null;
  raw: unknown;
}

function mapTrades(data: unknown, limit: number): TrackedTrade[] {
  return asList(data).slice(0, limit).map((item) => {
    const row = asRecord(item);
    return {
      token_mint: str(row.base_address ?? row.token_address ?? row.mint ?? row.address),
      token_symbol: str(row.symbol ?? row.token_symbol),
      wallet: str(row.maker ?? row.wallet ?? row.address),
      side: str(row.side ?? row.trade_side),
      amount_usd: num(row.amount_usd ?? row.usd_value),
      price: num(row.price),
      timestamp: num(row.timestamp ?? row.block_timestamp),
      tx_hash: str(row.tx_hash ?? row.hash ?? row.signature),
      raw: item,
    };
  });
}

export async function getSmartMoneyTrades(side = 'buy', limit = 20): Promise<TrackedTrade[]> {
  const data = await getGmgnClient().get('/v1/user/smartmoney', { chain: 'sol', limit, side });
  return mapTrades(data, limit);
}

export async function getKolTrades(side = 'buy', limit = 20): Promise<TrackedTrade[]> {
  const data = await getGmgnClient().get('/v1/user/kol', { chain: 'sol', limit, side });
  return mapTrades(data, limit);
}

export interface WalletPortfolioView {
  wallet: string;
  stats: unknown;
  holdings: null;
  holdings_note: string;
}

/**
 * Portfolio stats and PnL fields the OpenAPI returns for wallet_stats.
 * Per-token holdings use a signed route, which this build does not call.
 */
export async function getWalletPortfolio(wallet: string, period = '7d'): Promise<WalletPortfolioView> {
  const stats = await getGmgnClient().get('/v1/user/wallet_stats', {
    chain: 'sol',
    wallet_address: wallet,
    period,
  });
  return {
    wallet,
    stats,
    holdings: null,
    holdings_note: 'unverifiable (per-token holdings use a signed GMGN route; this build does not send a signing key)',
  };
}

export async function getWalletTrades(wallet: string, type = 'all', limit = 20): Promise<TrackedTrade[]> {
  const query: Record<string, QueryValue> = { chain: 'sol', wallet_address: wallet, limit };
  if (type !== 'all') query.type = type;
  const data = await getGmgnClient().get('/v1/user/wallet_activity', query);
  return mapTrades(data, limit);
}

export async function getTokenInfo(mint: string): Promise<unknown> {
  return getGmgnClient().get('/v1/token/info', { chain: 'sol', address: mint });
}

export async function getTokenPool(mint: string): Promise<unknown> {
  return getGmgnClient().get('/v1/token/pool_info', { chain: 'sol', address: mint });
}
