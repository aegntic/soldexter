import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { getSmartMoneyTrades, getKolTrades } from "../../providers/gmgn";

export const getSmartMoneyTool = new DynamicStructuredTool({
  name: "get_smart_money",
  description:
    "Get recent smart money trades on Solana from GMGN. Shows what wallets flagged as " +
    "smart money are buying or selling, with token, amount, price, tx hash. " +
    "Use to follow profitable traders, find tokens with smart money inflow.",
  schema: z.object({
    side: z.enum(["buy", "sell"]).optional().default("buy"),
    limit: z.number().optional().default(20),
  }),
  func: async ({ side, limit }) => {
    try {
      const trades = await getSmartMoneyTrades(side, limit);
      if (!trades.length) return "No smart money trades found.";
      return JSON.stringify(trades, null, 2);
    } catch (e: any) {
      return `Error fetching smart money: ${e.message}`;
    }
  },
});

export const getKolTool = new DynamicStructuredTool({
  name: "get_kol_trades",
  description:
    "Get recent KOL (Key Opinion Leader) trades on Solana from GMGN. " +
    "Track what influential traders are buying/selling. " +
    "Use to detect narrative shifts and early token adoption by influencers.",
  schema: z.object({
    side: z.enum(["buy", "sell"]).optional().default("buy"),
    limit: z.number().optional().default(20),
  }),
  func: async ({ side, limit }) => {
    try {
      const trades = await getKolTrades(side, limit);
      if (!trades.length) return "No KOL trades found.";
      return JSON.stringify(trades, null, 2);
    } catch (e: any) {
      return `Error fetching KOL trades: ${e.message}`;
    }
  },
});
