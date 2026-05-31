import { z } from "zod";

const GMGN_BASE = "https://gmgn.ai";
const GMGN_API_KEY = process.env.GMGN_API_KEY || "";

// ---------------------------------------------------------------------------
// Zod input schemas
// ---------------------------------------------------------------------------

export const GetTokenSecuritySchema = z.object({
  mint: z.string().describe("Solana token mint address"),
});

export const GetTrendingSchema = z.object({
  timeframe: z.enum(["1m", "5m", "1h", "6h", "24h"]).optional().default("1h"),
  order_by: z.enum(["volume", "marketcap", "swaps", "liquidity", "change", "smartmoney", "holders"]).optional().default("volume"),
  filters: z.array(z.enum(["not_honeypot", "renounced", "locked", "verified", "not_wash_trading"])).optional().default(["not_honeypot"]),
  limit: z.number().optional().default(20),
});

export const GetTrenchesSchema = z.object({
  type: z.enum(["new_creation", "near_completion", "completed"]).optional().default("new_creation"),
  platform: z.enum(["Pump.fun", "letsbonk", "bonkers", "moonshot_app", "ray_launchpad", "all"]).optional().default("all"),
  limit: z.number().optional().default(20),
});

export const GetSmartMoneySchema = z.object({
  side: z.enum(["buy", "sell"]).optional().default("buy"),
  limit: z.number().optional().default(20),
});

export const GetKolSchema = z.object({
  side: z.enum(["buy", "sell"]).optional().default("buy"),
  limit: z.number().optional().default(20),
});

export const GetPortfolioSchema = z.object({
  wallet: z.string().describe("Wallet address"),
  order_by: z.enum(["usd_value", "unrealized_profit", "total_profit", "price"]).optional().default("usd_value"),
  limit: z.number().optional().default(20),
});

export const GetWalletActivitySchema = z.object({
  wallet: z.string().describe("Wallet address"),
  type: z.enum(["buy", "sell", "all"]).optional().default("all"),
  limit: z.number().optional().default(20),
});

// ---------------------------------------------------------------------------
// TypeScript response interfaces
// ---------------------------------------------------------------------------

export interface TokenSecurity {
  mint: string;
  is_honeypot: boolean;
  is_open_source: boolean;
  renounced: boolean;
  buy_tax: number;
  sell_tax: number;
  rug_ratio: number;
  is_on_curve: boolean;
  holder_count: number;
  smart_degen_count: number;
  renowned_count: number;
  bluechip_owner_pct: number;
  sniper_count: number;
  rat_trader_amount_rate: number;
  bundler_trader_amount_rate: number;
  suspected_insider_hold_rate: number;
  fresh_wallet_rate: number;
  lock_info: { is_locked: boolean; lock_pct: number; lock_tag: string } | null;
  creator: string | null;
  creator_created_count: number;
  creator_open_ratio: number;
}

export interface TrendingToken {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  price_change_pct: number;
  volume_24h: number;
  liquidity: number;
  market_cap: number;
  swaps: number;
  buys: number;
  sells: number;
  holder_count: number;
  smart_buy_24h: number;
  smart_sell_24h: number;
  smart_degen_count: number;
  renowned_count: number;
  is_honeypot: boolean;
  renounced: boolean;
  sniper_count: number;
  bluechip_owner_pct: number;
  pool_creation_timestamp: number;
}

export interface TrenchToken {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  market_cap: number;
  volume: number;
  liquidity: number;
  platform: string;
  creation_timestamp: number;
  bonding_curve_pct: number | null;
  holder_count: number;
  buys: number;
  sells: number;
}

export interface SmartMoneyTrade {
  token_mint: string;
  token_symbol: string;
  token_name: string;
  wallet: string;
  side: "buy" | "sell";
  amount_usd: number;
  amount_tokens: number;
  price: number;
  timestamp: number;
  tx_hash: string;
}

export interface PortfolioHolding {
  mint: string;
  symbol: string;
  name: string;
  amount: number;
  usd_value: number;
  price: number;
  avg_buy_price: number;
  unrealized_profit: number;
  realized_profit: number;
  total_profit: number;
}

export interface WalletTrade {
  token_mint: string;
  token_symbol: string;
  side: "buy" | "sell";
  amount_usd: number;
  amount_tokens: number;
  price: number;
  timestamp: number;
  tx_hash: string;
}

// ---------------------------------------------------------------------------
// API fetch helpers
// ---------------------------------------------------------------------------

/** Headers that mimic the gmgn.ai frontend to pass Cloudflare. */
const gmgnHeaders = () => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Referer: "https://gmgn.ai/",
  Origin: "https://gmgn.ai",
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  ...(GMGN_API_KEY ? { "x-route-key": GMGN_API_KEY } : {}),
});

async function gmgnFetch(path: string) {
  const res = await fetch(`${GMGN_BASE}${path}`, { headers: gmgnHeaders() });
  if (!res.ok) throw new Error(`GMGN API error: ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.code !== 0 && json.code !== undefined) {
    throw new Error(`GMGN API error: ${json.msg || json.message || "unknown"}`);
  }
  return json.data;
}

// ---------------------------------------------------------------------------
// Token security — honeypot detection, rug ratio, smart money holders, etc.
// ---------------------------------------------------------------------------

export async function getTokenSecurity(mint: string): Promise<TokenSecurity> {
  const data = await gmgnFetch(`/defi/quotation/v1/tokens/security/sol/${mint}`);
  const s = data?.tokenSecurity?.[mint] || data || {};

  return {
    mint,
    is_honeypot: s.is_honeypot ?? false,
    is_open_source: s.is_open_source ?? false,
    renounced: s.renounced ?? false,
    buy_tax: s.buy_tax ?? 0,
    sell_tax: s.sell_tax ?? 0,
    rug_ratio: s.rug_ratio ?? 0,
    is_on_curve: s.is_on_curve ?? false,
    holder_count: s.holder_count ?? 0,
    smart_degen_count: s.smart_degen_count ?? 0,
    renowned_count: s.renowned_count ?? 0,
    bluechip_owner_pct: s.bluechip_owner_percentage ?? 0,
    sniper_count: s.sniper_count ?? 0,
    rat_trader_amount_rate: s.rat_trader_amount_rate ?? 0,
    bundler_trader_amount_rate: s.bundler_trader_amount_rate ?? 0,
    suspected_insider_hold_rate: s.suspected_insider_hold_rate ?? 0,
    fresh_wallet_rate: s.fresh_wallet_rate ?? 0,
    lock_info: s.lockInfo
      ? { is_locked: s.lockInfo.isLock ?? false, lock_pct: s.lockInfo.lockPercent ?? 0, lock_tag: s.lockInfo.lockTag ?? "" }
      : null,
    creator: s.creator ?? null,
    creator_created_count: (s.creator_created_inner_count ?? 0) + (s.creator_created_open_count ?? 0),
    creator_open_ratio: s.creator_created_open_ratio ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Trending tokens — ranked by volume, market cap, smart money, etc.
// ---------------------------------------------------------------------------

export async function getTrendingTokens(
  timeframe = "1h",
  orderBy = "volume",
  filters: string[] = ["not_honeypot"],
  limit = 20,
): Promise<TrendingToken[]> {
  const filtersQs = filters.map((f) => `filters[]=${f}`).join("&");
  const direction = orderBy === "change" ? "desc" : "desc";
  const data = await gmgnFetch(
    `/defi/quotation/v1/rank/sol/swaps/${timeframe}?orderby=${orderBy}&direction=${direction}&${filtersQs}`,
  );

  return (data?.rank || [])
    .slice(0, limit)
    .map((t: any) => ({
      mint: t.address,
      symbol: t.symbol || "",
      name: t.name || "",
      price: t.price ?? 0,
      price_change_pct: t.price_change_percent ?? t.price_change_percent1h ?? 0,
      volume_24h: t.volume ?? 0,
      liquidity: t.liquidity ?? 0,
      market_cap: t.market_cap ?? 0,
      swaps: t.swaps ?? 0,
      buys: t.buys ?? 0,
      sells: t.sells ?? 0,
      holder_count: t.holder_count ?? 0,
      smart_buy_24h: t.smart_buy_24h ?? 0,
      smart_sell_24h: t.smart_sell_24h ?? 0,
      smart_degen_count: t.smart_degen_count ?? 0,
      renowned_count: t.renowned_count ?? 0,
      is_honeypot: t.is_honeypot ?? false,
      renounced: t.renounced ?? false,
      sniper_count: t.sniper_count ?? 0,
      bluechip_owner_pct: t.bluechip_owner_percentage ?? 0,
      pool_creation_timestamp: t.pool_creation_timestamp ?? t.open_timestamp ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Trenches — new token launches (Pump.fun, etc.)
// ---------------------------------------------------------------------------

export async function getTrenchTokens(
  type = "new_creation",
  platform = "all",
  limit = 20,
): Promise<TrenchToken[]> {
  let path = `/defi/quotation/v1/rank/sol/tokens/${type}?limit=${limit}`;
  if (platform !== "all") {
    path += `&launchpad_platform=${platform}`;
  }
  const data = await gmgnFetch(path);

  return (data?.rank || data || [])
    .slice(0, limit)
    .map((t: any) => ({
      mint: t.address,
      symbol: t.symbol || "",
      name: t.name || "",
      price: t.price ?? 0,
      market_cap: t.market_cap ?? 0,
      volume: t.volume ?? 0,
      liquidity: t.liquidity ?? 0,
      platform: t.launchpad_platform || platform,
      creation_timestamp: t.creation_timestamp ?? t.open_timestamp ?? 0,
      bonding_curve_pct: t.bonding_curve_pct ?? null,
      holder_count: t.holder_count ?? 0,
      buys: t.buys ?? 0,
      sells: t.sells ?? 0,
    }));
}

// ---------------------------------------------------------------------------
// Smart money & KOL tracking
// ---------------------------------------------------------------------------

export async function getSmartMoneyTrades(side = "buy", limit = 20): Promise<SmartMoneyTrade[]> {
  const data = await gmgnFetch(`/defi/quotation/v1/smartmoney/sol/trades?side=${side}&limit=${limit}`);

  return (data?.trades || data || [])
    .slice(0, limit)
    .map((t: any) => ({
      token_mint: t.token_address || t.mint,
      token_symbol: t.token_symbol || t.symbol || "",
      token_name: t.token_name || t.name || "",
      wallet: t.wallet || t.address,
      side: (t.side || side) as "buy" | "sell",
      amount_usd: t.amount_usd ?? t.usd_value ?? 0,
      amount_tokens: t.amount ?? t.token_amount ?? 0,
      price: t.price ?? 0,
      timestamp: t.timestamp ?? t.block_timestamp ?? 0,
      tx_hash: t.hash || t.tx_hash || t.signature || "",
    }));
}

export async function getKolTrades(side = "buy", limit = 20): Promise<SmartMoneyTrade[]> {
  const data = await gmgnFetch(`/defi/quotation/v1/kol/sol/trades?side=${side}&limit=${limit}`);

  return (data?.trades || data || [])
    .slice(0, limit)
    .map((t: any) => ({
      token_mint: t.token_address || t.mint,
      token_symbol: t.token_symbol || t.symbol || "",
      token_name: t.token_name || t.name || "",
      wallet: t.wallet || t.address,
      side: (t.side || side) as "buy" | "sell",
      amount_usd: t.amount_usd ?? t.usd_value ?? 0,
      amount_tokens: t.amount ?? t.token_amount ?? 0,
      price: t.price ?? 0,
      timestamp: t.timestamp ?? t.block_timestamp ?? 0,
      tx_hash: t.hash || t.tx_hash || t.signature || "",
    }));
}

// ---------------------------------------------------------------------------
// Wallet portfolio & activity
// ---------------------------------------------------------------------------

export async function getPortfolioHoldings(
  wallet: string,
  orderBy = "usd_value",
  limit = 20,
): Promise<PortfolioHolding[]> {
  const data = await gmgnFetch(
    `/defi/quotation/v1/portfolio/sol/${wallet}/tokens?orderby=${orderBy}&direction=desc&limit=${limit}`,
  );

  return (data?.tokens || data || [])
    .slice(0, limit)
    .map((t: any) => ({
      mint: t.address || t.mint,
      symbol: t.symbol || "",
      name: t.name || "",
      amount: t.amount ?? t.balance ?? 0,
      usd_value: t.usd_value ?? t.value ?? 0,
      price: t.price ?? 0,
      avg_buy_price: t.avg_buy_price ?? t.bought_price ?? 0,
      unrealized_profit: t.unrealized_profit ?? t.profit ?? 0,
      realized_profit: t.realized_profit ?? 0,
      total_profit: t.total_profit ?? (t.unrealized_profit ?? 0) + (t.realized_profit ?? 0),
    }));
}

export async function getWalletTrades(
  wallet: string,
  type = "all",
  limit = 20,
): Promise<WalletTrade[]> {
  const typeQs = type !== "all" ? `&type=${type}` : "";
  const data = await gmgnFetch(
    `/defi/quotation/v1/portfolio/sol/${wallet}/activity?limit=${limit}${typeQs}`,
  );

  return (data?.activities || data || [])
    .slice(0, limit)
    .map((t: any) => ({
      token_mint: t.token_address || t.mint,
      token_symbol: t.token_symbol || t.symbol || "",
      side: (t.side || t.type || "buy") as "buy" | "sell",
      amount_usd: t.amount_usd ?? t.usd_value ?? 0,
      amount_tokens: t.amount ?? t.token_amount ?? 0,
      price: t.price ?? 0,
      timestamp: t.timestamp ?? t.block_timestamp ?? 0,
      tx_hash: t.hash || t.tx_hash || t.signature || "",
    }));
}
