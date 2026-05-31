import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getTrendingTokens } from "../../providers/birdeye";

export const getTrendingTokensTool = new DynamicStructuredTool({
  name: "get_trending_tokens",
  description:
    "Get trending Solana tokens by volume/price momentum. " +
    "Returns tokens with price, market cap, volume, liquidity. " +
    "Use for market overview, finding momentum plays, sector analysis.",
  schema: z.object({
    timeframe: z.enum(["1h", "4h", "24h"]).optional().default("24h"),
    min_liquidity: z.number().optional().default(10000).describe("Minimum liquidity in USD"),
  }),
  func: async ({ timeframe, min_liquidity }) => {
    try {
      const tokens = await getTrendingTokens(timeframe, min_liquidity, 20);
      if (!tokens.length) return "No trending tokens found matching criteria.";
      return JSON.stringify(tokens, null, 2);
    } catch (e: any) {
      return `Error fetching trending tokens: ${e.message}`;
    }
  },
});
