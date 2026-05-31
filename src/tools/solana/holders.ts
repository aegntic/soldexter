import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getTokenHolders as fetchHolders, searchWalletLabels } from "../../providers/helius";

export const getTokenHoldersTool = new DynamicStructuredTool({
  name: "get_token_holders",
  description:
    "Get top holders of a Solana token. Returns addresses with balances and percentage of supply. " +
    "Use to check token concentration, whale presence, distribution health.",
  schema: z.object({
    mint: z.string().describe("Token mint address"),
    top: z.number().optional().default(20).describe("Number of top holders"),
  }),
  func: async ({ mint, top }) => {
    try {
      const holders = await fetchHolders(mint, top);
      // Enrich with labels where available
      const enriched = await Promise.all(
        holders.slice(0, 5).map(async (h) => {
          try {
            const labels = await searchWalletLabels(h.address);
            return { ...h, label: labels.labels.join(", ") || null };
          } catch {
            return h;
          }
        })
      );
      return JSON.stringify(
        { total_returned: enriched.length, holders: enriched },
        null,
        2
      );
    } catch (e: any) {
      return `Error fetching token holders: ${e.message}`;
    }
  },
});
