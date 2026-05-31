import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getTokenInfo as fetchTokenInfo } from "../../providers/helius";

export const getTokenInfoTool = new DynamicStructuredTool({
  name: "get_token_info",
  description:
    "Get Solana token metadata, supply, freeze authority, and creation info. " +
    "Use this to check token fundamentals: age, creator, supply, whether it's a pump.fun token. " +
    "Input: token mint address.",
  schema: z.object({
    mint: z.string().describe("Solana token mint address (base58)"),
  }),
  func: async ({ mint }) => {
    try {
      const info = await fetchTokenInfo(mint);
      const flags: string[] = [];
      if (info.pump_fun_flag) flags.push("PUMP.FUN TOKEN");
      if (info.freeze_authority) flags.push("FREEZE AUTHORITY ACTIVE");
      if (info.is_mutable) flags.push("METADATA MUTABLE");

      return JSON.stringify({
        ...info,
        risk_flags: flags.length ? flags : undefined,
      }, null, 2);
    } catch (e: any) {
      return `Error fetching token info: ${e.message}`;
    }
  },
});
