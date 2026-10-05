/**
 * Keyless market and mint reads. Failures become unverifiable fields.
 * Calls are sequential and honor Retry-After on 429.
 */

import { featureState } from '../soldextra/registry.js';
import { measured, unverifiable, utcNow, type Field } from '../intel/sourced.js';
import { PUBLIC_RPC_URL } from '../intel/programs.js';

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithBackoff(
  url: string,
  init: RequestInit | undefined,
  fetchImpl: FetchLike,
  retries = 2,
): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const response = await fetchImpl(url, init);
    last = response;
    if (response.status !== 429 && response.status !== 413) return response;
    if (attempt === retries) return response;
    const retryAfter = Number.parseInt(response.headers.get('retry-after') ?? '', 10);
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    await sleep(Math.min(waitMs, 10_000));
  }
  return last as Response;
}

export interface MarketSnapshot {
  mint: string;
  price_usd: Field<number>;
  liquidity_usd: Field<number>;
  market_cap_usd: Field<number>;
  pair_address: Field<string>;
  dex: Field<string>;
  as_of_utc: string;
}

function missed(reason: string): Field<number> {
  return unverifiable(reason);
}

export async function getDexScreenerMarket(mint: string, fetchImpl: FetchLike = fetch): Promise<MarketSnapshot> {
  const state = featureState('dexscreener');
  const asOf = utcNow();
  if (!state.active) {
    const reason = state.unavailableReason ?? 'dexscreener off';
    return {
      mint,
      price_usd: missed(reason),
      liquidity_usd: missed(reason),
      market_cap_usd: missed(reason),
      pair_address: unverifiable(reason),
      dex: unverifiable(reason),
      as_of_utc: asOf,
    };
  }
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
  try {
    const response = await fetchWithBackoff(url, undefined, fetchImpl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json() as { pairs?: Array<Record<string, unknown>> };
    const pair = (json.pairs ?? []).find((row) => row.chainId === 'solana') ?? json.pairs?.[0];
    if (!pair) {
      const reason = 'DexScreener returned no Solana pair';
      return {
        mint,
        price_usd: missed(reason),
        liquidity_usd: missed(reason),
        market_cap_usd: missed(reason),
        pair_address: unverifiable(reason),
        dex: unverifiable(reason),
        as_of_utc: asOf,
      };
    }
    const price = Number(pair.priceUsd);
    const liquidity = Number((pair.liquidity as { usd?: number } | undefined)?.usd);
    const cap = Number(pair.marketCap ?? pair.fdv);
    const source = url;
    return {
      mint,
      price_usd: Number.isFinite(price) ? measured(price, source, asOf) : missed('DexScreener price missing'),
      liquidity_usd: Number.isFinite(liquidity) ? measured(liquidity, source, asOf) : missed('DexScreener liquidity missing'),
      market_cap_usd: Number.isFinite(cap) ? measured(cap, source, asOf) : missed('DexScreener market cap missing'),
      pair_address: typeof pair.pairAddress === 'string'
        ? measured(pair.pairAddress, source, asOf)
        : unverifiable('DexScreener pair address missing'),
      dex: typeof pair.dexId === 'string' ? measured(pair.dexId, source, asOf) : unverifiable('DexScreener dex id missing'),
      as_of_utc: asOf,
    };
  } catch (error) {
    const reason = `DexScreener request failed: ${error instanceof Error ? error.message : String(error)}`;
    return {
      mint,
      price_usd: missed(reason),
      liquidity_usd: missed(reason),
      market_cap_usd: missed(reason),
      pair_address: unverifiable(reason),
      dex: unverifiable(reason),
      as_of_utc: asOf,
    };
  }
}

export async function getJupiterPrice(mint: string, fetchImpl: FetchLike = fetch): Promise<Field<number>> {
  const state = featureState('jupiter_price');
  if (!state.active) return unverifiable(state.unavailableReason ?? 'jupiter price off');
  const url = `https://lite-api.jup.ag/price/v3?ids=${mint}`;
  try {
    const response = await fetchWithBackoff(url, undefined, fetchImpl);
    if (!response.ok) return unverifiable(`Jupiter price HTTP ${response.status}`);
    const json = await response.json() as Record<string, { usdPrice?: number; price?: number }>;
    const row = json[mint];
    const price = row?.usdPrice ?? row?.price;
    if (typeof price !== 'number') return unverifiable('Jupiter price payload had no usd price');
    return measured(price, url, utcNow());
  } catch (error) {
    return unverifiable(`Jupiter price failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export interface RugCheckSummary {
  score: Field<number>;
  lp_locked_pct: Field<number>;
  risks: Field<string[]>;
}

export async function getRugCheckSummary(mint: string, fetchImpl: FetchLike = fetch): Promise<RugCheckSummary> {
  const state = featureState('rugcheck');
  if (!state.active) {
    const reason = state.unavailableReason ?? 'rugcheck off';
    return { score: unverifiable(reason), lp_locked_pct: unverifiable(reason), risks: unverifiable(reason) };
  }
  const url = `https://api.rugcheck.xyz/v1/tokens/${mint}/report/summary`;
  try {
    const response = await fetchWithBackoff(url, undefined, fetchImpl);
    if (!response.ok) {
      const reason = `RugCheck HTTP ${response.status}`;
      return { score: unverifiable(reason), lp_locked_pct: unverifiable(reason), risks: unverifiable(reason) };
    }
    const json = await response.json() as { score?: number; lpLockedPct?: number; risks?: Array<{ name?: string }> };
    const asOf = utcNow();
    return {
      score: typeof json.score === 'number' ? measured(json.score, url, asOf) : unverifiable('RugCheck score missing'),
      lp_locked_pct: typeof json.lpLockedPct === 'number'
        ? measured(json.lpLockedPct, url, asOf)
        : unverifiable('RugCheck lpLockedPct missing'),
      risks: Array.isArray(json.risks)
        ? measured(json.risks.map((risk) => risk.name ?? '').filter(Boolean), url, asOf)
        : unverifiable('RugCheck risks missing'),
    };
  } catch (error) {
    const reason = `RugCheck failed: ${error instanceof Error ? error.message : String(error)}`;
    return { score: unverifiable(reason), lp_locked_pct: unverifiable(reason), risks: unverifiable(reason) };
  }
}

export interface ParsedMintAccount {
  mint_authority: string | null;
  freeze_authority: string | null;
  supply: string | null;
  decimals: number | null;
  extensions: string[];
}

export async function getMintAccount(mint: string, fetchImpl: FetchLike = fetch, rpcUrl = PUBLIC_RPC_URL): Promise<Field<ParsedMintAccount>> {
  const state = featureState('public_rpc');
  if (!state.active) return unverifiable(state.unavailableReason ?? 'public rpc off');
  try {
    const response = await fetchWithBackoff(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: [mint, { encoding: 'jsonParsed' }],
      }),
    }, fetchImpl);
    if (!response.ok) return unverifiable(`public RPC HTTP ${response.status}`);
    const json = await response.json() as {
      error?: { message?: string };
      result?: { value?: { data?: { parsed?: { info?: Record<string, unknown> } } } | null };
    };
    if (json.error) return unverifiable(`public RPC ${json.error.message ?? 'error'}`);
    const info = json.result?.value?.data?.parsed?.info;
    if (!info) return unverifiable('public RPC returned no parsed mint account');
    const extensions = Array.isArray(info.extensions)
      ? (info.extensions as Array<{ extension?: string }>).map((ext) => ext.extension ?? '').filter(Boolean)
      : [];
    return measured({
      mint_authority: typeof info.mintAuthority === 'string' ? info.mintAuthority : null,
      freeze_authority: typeof info.freezeAuthority === 'string' ? info.freezeAuthority : null,
      supply: typeof info.supply === 'string' ? info.supply : null,
      decimals: typeof info.decimals === 'number' ? info.decimals : null,
      extensions,
    }, `${rpcUrl} getAccountInfo jsonParsed`, utcNow());
  } catch (error) {
    return unverifiable(`public RPC failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
