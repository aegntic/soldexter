import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getPortfolioHoldings, getWalletTrades } from "../../providers/gmgn";

export const getPortfolioTool = new DynamicStructuredTool({
  name: "get_gmgn_portfolio",
  description:
    "Get wallet portfolio from GMGN with PnL data. Shows each token holding with " +
    "unrealized/realized profit, average buy price, current value. " +
    "More detailed PnL than Helius wallet activity. Use for wallet profit tracking.",
  schema: z.object({
    wallet: z.string().describe("Solana wallet address (base58)"),
    order_by: z
      .enum(["usd_value", "unrealized_profit", "total_profit", "price"])
      .optional()
      .default("usd_value"),
    limit: z.number().optional().default(20),
  }),
  func: async ({ wallet, order_by, limit }) => {
    try {
      const holdings = await getPortfolioHoldings(wallet, order_by, limit);
      if (!holdings.length) return "No holdings found for this wallet.";
      return JSON.stringify(holdings, null, 2);
    } catch (e: any) {
      return `Error fetching portfolio: ${e.message}`;
    }
  },
});

export const getWalletActivityGMGNTool = new DynamicStructuredTool({
  name: "get_gmgn_wallet_activity",
  description:
    "Get wallet trade history from GMGN. Shows individual buy/sell trades with " +
    "token, amounts, prices, timestamps. Complements Helius wallet activity " +
    "with GMGN's smart labeling and degen classification.",
  schema: z.object({
    wallet: z.string().describe("Solana wallet address (base58)"),
    type: z.enum(["buy", "sell", "all"]).optional().default("all"),
    limit: z.number().optional().default(20),
  }),
  func: async ({ wallet, type, limit }) => {
    try {
      const trades = await getWalletTrades(wallet, type, limit);
      if (!trades.length) return "No trades found for this wallet.";
      return JSON.stringify(trades, null, 2);
    } catch (e: any) {
      return `Error fetching wallet activity: ${e.message}`;
    }
  },
});
