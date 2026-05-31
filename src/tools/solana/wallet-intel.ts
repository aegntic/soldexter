import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import {
  getWalletActivity as fetchActivity,
  decodeTransaction as fetchDecoded,
  searchWalletLabels,
} from "../../providers/helius";
import { getWalletPnl } from "../../providers/birdeye";

export const getWalletActivityTool = new DynamicStructuredTool({
  name: "get_wallet_activity",
  description:
    "Get recent transaction activity for a Solana wallet. Returns parsed swaps, transfers, " +
    "with token amounts and program identification. " +
    "Use to understand what a wallet is doing right now.",
  schema: z.object({
    address: z.string().describe("Solana wallet address"),
    limit: z.number().optional().default(20).describe("Number of transactions (max 50)"),
    type: z.enum(["all", "swaps", "transfers"]).optional().default("all"),
  }),
  func: async ({ address, limit, type }) => {
    try {
      const activity = await fetchActivity(address, Math.min(limit, 50), type);
      if (!activity.length) return "No recent activity found for this wallet.";
      return JSON.stringify(activity, null, 2);
    } catch (e: any) {
      return `Error fetching wallet activity: ${e.message}`;
    }
  },
});

export const decodeTransactionTool = new DynamicStructuredTool({
  name: "decode_transaction",
  description:
    "Decode a Solana transaction by signature. Returns full breakdown: " +
    "program, inner instructions, token transfers, account changes, fees. " +
    "Use for deep forensic analysis of a specific transaction.",
  schema: z.object({
    signature: z.string().describe("Transaction signature (base58)"),
  }),
  func: async ({ signature }) => {
    try {
      const decoded = await fetchDecoded(signature);
      return JSON.stringify(decoded, null, 2);
    } catch (e: any) {
      return `Error decoding transaction: ${e.message}`;
    }
  },
});
