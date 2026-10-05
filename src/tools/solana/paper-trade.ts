import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  defaultLedgerPath,
  logPaperSignal,
  PAPER_HORIZONS,
  readLedger,
  scorePaperSignal,
  type PaperHorizon,
  type PaperPrice,
} from '../../intel/paper-ledger.js';
import { getDexScreenerMarket, getJupiterPrice } from '../../providers/free-market.js';
import { isMeasured } from '../../intel/sourced.js';

async function measuredUsdPrice(mint: string): Promise<PaperPrice | null> {
  const jupiter = await getJupiterPrice(mint);
  if (isMeasured(jupiter) && jupiter.value > 0) {
    return { value: jupiter.value, quote: 'USD', source: jupiter.source, as_of_utc: jupiter.as_of_utc };
  }
  const dex = await getDexScreenerMarket(mint);
  if (isMeasured(dex.price_usd) && dex.price_usd.value > 0) {
    return { value: dex.price_usd.value, quote: 'USD', source: dex.price_usd.source, as_of_utc: dex.price_usd.as_of_utc };
  }
  return null;
}

export const logPaperSignalTool = new DynamicStructuredTool({
  name: 'log_paper_signal',
  description:
    'Append a paper-trade signal (time, token, on-chain price, source) to the public ledger. ' +
    'Does not send a transaction. Live trading stays behind the existing double opt-in and is not used here.',
  schema: z.object({
    token: z.string().describe('Token mint'),
    source: z.string().describe('Why this signal was flagged'),
    price_usd: z.number().optional().describe('Measured USD price. Omit to fetch Jupiter or DexScreener.'),
    price_source: z.string().optional().describe('Source URL or method when price_usd is supplied'),
  }),
  func: async ({ token, source, price_usd, price_source }) => {
    let price: PaperPrice | null = null;
    if (typeof price_usd === 'number') {
      if (!(price_usd > 0)) return 'Refusing to log a paper signal without a positive measured price.';
      price = {
        value: price_usd,
        quote: 'USD',
        source: price_source ?? 'caller-supplied measured price',
        as_of_utc: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      };
    } else {
      price = await measuredUsdPrice(token);
    }
    if (!price) return `unverifiable (no Jupiter or DexScreener USD price for ${token}; signal was not logged)`;
    const signal = logPaperSignal({ token, source, on_chain_price: price });
    return `Logged paper signal ${signal.id} at ${signal.logged_at_utc} for ${token} at ${price.value} USD (source: ${price.source}, as_of_utc: ${price.as_of_utc}).`;
  },
});

export const scorePaperSignalsTool = new DynamicStructuredTool({
  name: 'score_paper_signals',
  description:
    'Score logged paper signals at 1h, 24h, and 72h using a measured exit price, minus fees and slippage. ' +
    'Append-only. Horizons that are not due, or that have no exit price, stay pending and are not invented.',
  schema: z.object({
    signal_id: z.string().describe('Paper signal id to score'),
    horizon: z.enum(PAPER_HORIZONS).optional().describe('One horizon. Omit to attempt 1h, 24h, and 72h.'),
  }),
  func: async ({ signal_id, horizon }) => {
    const horizons: PaperHorizon[] = horizon ? [horizon] : [...PAPER_HORIZONS];
    const lines: string[] = [];
    for (const item of horizons) {
      const existing = scorePaperSignal({ signalId: signal_id, horizon: item, exitPrice: null });
      if (existing.status === 'already_scored') {
        lines.push(`${item}: already scored ${existing.score?.return_pct}%`);
        continue;
      }
      if (existing.status === 'pending' && existing.reason?.startsWith('not due')) {
        lines.push(`${item}: ${existing.reason}`);
        continue;
      }
      if (existing.reason?.includes('not in the ledger')) {
        lines.push(`${item}: ${existing.reason}`);
        continue;
      }
      const signal = readLedger(defaultLedgerPath()).find((record) => record.type === 'signal' && record.id === signal_id);
      const token = signal && signal.type === 'signal' ? signal.token : undefined;
      const exitPrice = token ? await measuredUsdPrice(token) : null;
      const scored = scorePaperSignal({ signalId: signal_id, horizon: item, exitPrice });
      if (scored.status === 'scored') {
        lines.push(`${item}: return ${scored.score?.return_pct}% after ${scored.score?.fee_bps}bps fees and ${scored.score?.slippage_bps}bps slippage (exit source: ${scored.score?.exit_price.source}, as_of_utc: ${scored.score?.exit_price.as_of_utc})`);
      } else {
        lines.push(`${item}: ${scored.reason ?? scored.status}`);
      }
    }
    return lines.join('\n');
  },
});
