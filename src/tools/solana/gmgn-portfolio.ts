import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getWalletPortfolio, getWalletTrades } from '../../providers/gmgn';

export const getPortfolioTool = new DynamicStructuredTool({
  name: 'get_gmgn_portfolio',
  description:
    'GMGN OpenAPI wallet stats and PnL (GET /v1/user/wallet_stats). ' +
    'Per-token holdings are unverifiable here because that route needs a request-signing key, which is not configured. ' +
    'Read-only. Does not invent a win rate when the payload omits it.',
  schema: z.object({
    wallet: z.string().describe('Solana wallet address (base58)'),
    period: z.enum(['7d', '14d', '30d']).optional().default('7d'),
  }),
  func: async ({ wallet, period }) => {
    try {
      const portfolio = await getWalletPortfolio(wallet, period);
      return JSON.stringify(portfolio, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error fetching portfolio: ${message}`;
    }
  },
});

export const getWalletActivityGMGNTool = new DynamicStructuredTool({
  name: 'get_gmgn_wallet_activity',
  description:
    'GMGN OpenAPI wallet trade history (GET /v1/user/wallet_activity). Read-only. ' +
    'Fields the payload omits are null.',
  schema: z.object({
    wallet: z.string().describe('Solana wallet address (base58)'),
    type: z.enum(['buy', 'sell', 'all']).optional().default('all'),
    limit: z.number().optional().default(20),
  }),
  func: async ({ wallet, type, limit }) => {
    try {
      const trades = await getWalletTrades(wallet, type, limit);
      if (!trades.length) return 'No trades found for this wallet.';
      return JSON.stringify(trades, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error fetching wallet activity: ${message}`;
    }
  },
});
