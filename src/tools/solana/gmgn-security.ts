import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getTokenSecurity } from '../../providers/gmgn';

export const getTokenSecurityTool = new DynamicStructuredTool({
  name: 'get_token_security',
  description:
    'Read-only GMGN OpenAPI token security (GET /v1/token/security). ' +
    'Missing fields stay null. Does not scrape gmgn.ai and does not submit a trade.',
  schema: z.object({
    mint: z.string().describe('Solana token mint address (base58)'),
  }),
  func: async ({ mint }) => {
    try {
      const sec = await getTokenSecurity(mint);
      const flags: string[] = [];
      if (sec.is_honeypot === true) flags.push('HONEYPOT');
      if (sec.buy_tax != null && sec.buy_tax > 0.05) flags.push(`HIGH BUY TAX (${(sec.buy_tax * 100).toFixed(1)}%)`);
      if (sec.sell_tax != null && sec.sell_tax > 0.05) flags.push(`HIGH SELL TAX (${(sec.sell_tax * 100).toFixed(1)}%)`);
      if (sec.rug_ratio != null && sec.rug_ratio > 0.3) flags.push(`HIGH RUG RATIO (${(sec.rug_ratio * 100).toFixed(0)}%)`);
      if (sec.sniper_count != null && sec.sniper_count > 5) flags.push(`SNIPER HEAVY (${sec.sniper_count})`);
      if (sec.suspected_insider_hold_rate != null && sec.suspected_insider_hold_rate > 0.15) {
        flags.push(`INSIDER RISK (${(sec.suspected_insider_hold_rate * 100).toFixed(0)}%)`);
      }
      if (sec.fresh_wallet_rate != null && sec.fresh_wallet_rate > 0.3) {
        flags.push(`FRESH WALLET RISK (${(sec.fresh_wallet_rate * 100).toFixed(0)}%)`);
      }
      if (sec.bundler_trader_amount_rate != null && sec.bundler_trader_amount_rate > 0.2) {
        flags.push(`BUNDLER RISK (${(sec.bundler_trader_amount_rate * 100).toFixed(0)}%)`);
      }
      return JSON.stringify({ ...sec, risk_flags: flags.length ? flags : undefined }, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `Error fetching token security: ${message}`;
    }
  },
});
