import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getTrendingTokens,
  getTrenchTokens,
} from "../../providers/gmgn";

export const getGMGNTrendingTool = new DynamicStructuredTool({
  name: "get_gmgn_trending",
  description:
    "Get trending Solana tokens from GMGN ranked by volume, market cap, smart money activity, " +
    "or holder growth. Includes honeypot status, sniper count, smart degen/renowned counts. " +
    "More granular than Birdeye trending — adds smart money and sniper data.",
  schema: z.object({
    timeframe: z.enum(["1m", "5m", "1h", "6h", "24h"]).optional().default("1h"),
    order_by: z
      .enum(["volume", "marketcap", "swaps", "liquidity", "change", "smartmoney", "holders"])
      .optional()
      .default("volume"),
    filters: z
      .array(z.enum(["not_honeypot", "renounced", "locked", "verified", "not_wash_trading"]))
      .optional()
      .default(["not_honeypot"]),
    limit: z.number().optional().default(20),
  }),
  func: async ({ timeframe, order_by, filters, limit }) => {
    try {
      const tokens = await getTrendingTokens(timeframe, order_by, filters, limit);
      if (!tokens.length) return "No trending tokens found.";
      return JSON.stringify(tokens, null, 2);
    } catch (e: any) {
      return `Error fetching GMGN trending: ${e.message}`;
    }
  },
});

export const getGMGNTrenchesTool = new DynamicStructuredTool({
  name: "get_gmgn_trenches",
  description:
    "Get new token launches from GMGN trenches — Pump.fun, letsbonk, bonkers, moonshot, " +
    "ray_launchpad. Track new creations, near-completion, and completed bonding curves. " +
    "For finding brand new launches before they hit DEX.",
  schema: z.object({
    type: z
      .enum(["new_creation", "near_completion", "completed"])
      .optional()
      .default("new_creation"),
    platform: z
      .enum(["Pump.fun", "letsbonk", "bonkers", "moonshot_app", "ray_launchpad", "all"])
      .optional()
      .default("all"),
    limit: z.number().optional().default(20),
  }),
  func: async ({ type, platform, limit }) => {
    try {
      const tokens = await getTrenchTokens(type, platform, limit);
      if (!tokens.length) return "No trench tokens found.";
      return JSON.stringify(tokens, null, 2);
    } catch (e: any) {
      return `Error fetching GMGN trenches: ${e.message}`;
    }
  },
});
