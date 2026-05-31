import { z } from "zod";

const BIRDEYE_BASE = "https://public-api.birdeye.so";
const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || "";

const headers = () => ({
  "X-API-KEY": BIRDEYE_KEY,
  "x-chain": "solana",
});

export const GetDexDataSchema = z.object({
  mint: z.string().describe("Token mint address"),
  dex: z.enum(["raydium", "orca", "pumpfun", "all"]).optional().default("all"),
});

export const GetTrendingSchema = z.object({
  timeframe: z.enum(["1h", "4h", "24h"]).optional().default("24h"),
  min_liquidity: z.number().optional().default(10000),
  limit: z.number().optional().default(20),
});

export const GetWalletPnlSchema = z.object({
  address: z.string().describe("Wallet address"),
  timeframe: z.enum(["7d", "30d", "all"]).optional().default("30d"),
});

export interface DexData {
  price_usd: number;
  price_sol: number;
  market_cap: number;
  liquidity_usd: number;
  volume_24h: number;
  price_change_1h: number;
  price_change_4h: number;
  price_change_24h: number;
  price_change_7d: number;
  tx_count_24h: number;
  buys_24h: number;
  sells_24h: number;
  pair_address: string;
  dex_name: string;
  pool_creation_date: string | null;
}

export interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  price_usd: number;
  market_cap: number;
  volume_24h: number;
  liquidity_usd: number;
  price_change: number;
  tx_count: number;
}

export interface WalletPnl {
  total_pnl_usd: number;
  win_rate: number;
  total_trades: number;
  avg_trade_size: number;
  best_trade: { mint: string; symbol: string; pnl: number } | null;
  worst_trade: { mint: string; symbol: string; pnl: number } | null;
  most_traded_tokens: Array<{ mint: string; symbol: string; count: number; pnl: number }>;
}

async function birdeyeFetch(path: string) {
  const res = await fetch(`${BIRDEYE_BASE}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Birdeye API error: ${res.status}`);
  const json = await res.json();
  return json.data;
}

/**
 * Get DEX trading data for a token
 */
export async function getDexData(mint: string): Promise<DexData> {
  // Get price
  const priceData = await birdeyeFetch(`/defi/price?address=${mint}&check_liquidity=true`);

  // Get token overview for market data
  let overview: any = {};
  try {
    overview = await birdeyeFetch(`/defi/token_overview?address=${mint}`);
  } catch {}

  // Get OHLCV for price changes
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 86400;
  let ohlcv: any[] = [];
  try {
    ohlcv = await birdeyeFetch(`/defi/ohlcv?address=${mint}&type=1H&time_from=${dayAgo}&time_to=${now}`) || [];
  } catch {}

  return {
    price_usd: priceData?.value || 0,
    price_sol: priceData?.valueSol || 0,
    market_cap: overview?.mc || 0,
    liquidity_usd: overview?.liquidity || 0,
    volume_24h: overview?.volume24h || 0,
    price_change_1h: 0,
    price_change_4h: 0,
    price_change_24h: overview?.priceChange24h || 0,
    price_change_7d: overview?.priceChange7d || 0,
    tx_count_24h: overview?.trade24h || 0,
    buys_24h: overview?.buy24h || 0,
    sells_24h: overview?.sell24h || 0,
    pair_address: overview?.pair || "",
    dex_name: overview?.dex || "unknown",
    pool_creation_date: overview?.poolCreationTime ? new Date(overview.poolCreationTime * 1000).toISOString() : null,
  };
}

/**
 * Get trending tokens on Solana
 */
export async function getTrendingTokens(timeframe = "24h", minLiquidity = 10000, limit = 20): Promise<TrendingToken[]> {
  const sortField = timeframe === "1h" ? "rank1h" : timeframe === "4h" ? "rank4h" : "rank24h";
  const data = await birdeyeFetch(`/defi/token_trending?sort_by=${sortField}&sort_type=desc&limit=${limit}`);

  return (data || [])
    .filter((t: any) => (t.liquidity || 0) >= minLiquidity)
    .map((t: any) => ({
      mint: t.address,
      symbol: t.symbol || "",
      name: t.name || "",
      price_usd: t.price || 0,
      market_cap: t.mc || 0,
      volume_24h: t.volume || 0,
      liquidity_usd: t.liquidity || 0,
      price_change: t.priceChange || 0,
      tx_count: t.trade || 0,
    }));
}

/**
 * Get wallet P&L (requires Birdeye paid tier, graceful fallback)
 */
export async function getWalletPnl(address: string, timeframe = "30d"): Promise<WalletPnl> {
  try {
    const data = await birdeyeFetch(`/v1/wallet/token_list?wallet=${address}`);
    // Basic P&L estimation from token list
    return {
      total_pnl_usd: data?.totalPnl || 0,
      win_rate: data?.winRate || 0,
      total_trades: data?.totalTrades || 0,
      avg_trade_size: data?.avgTradeSize || 0,
      best_trade: null,
      worst_trade: null,
      most_traded_tokens: [],
    };
  } catch {
    return {
      total_pnl_usd: 0,
      win_rate: 0,
      total_trades: 0,
      avg_trade_size: 0,
      best_trade: null,
      worst_trade: null,
      most_traded_tokens: [],
    };
  }
}
