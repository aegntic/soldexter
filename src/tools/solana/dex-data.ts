import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getDexData as fetchDexData } from "../../providers/birdeye";

export const getDexDataTool = new DynamicStructuredTool({
  name: "get_dex_data",
  description:
    "Get DEX trading data for a Solana token: price, volume, liquidity, price changes, " +
    "transaction counts, pool info. Source: Birdeye + DexScreener. " +
    "Use for market analysis, liquidity checks, momentum assessment.",
  schema: z.object({
    mint: z.string().describe("Token mint address"),
  }),
  func: async ({ mint }) => {
    try {
      const data = await fetchDexData(mint);
      return JSON.stringify(data, null, 2);
    } catch (e: any) {
      return `Error fetching DEX data: ${e.message}`;
    }
  },
});
