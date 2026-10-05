import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { formatWalletBlock, scoreWallet, SCAN_MINIMUMS, type WalletScanInput } from '../../intel/wallet-scan.js';
import { utcNow } from '../../intel/sourced.js';
import { parseSwap } from '../../intel/swap-parse.js';
import { PUBLIC_RPC_URL } from '../../intel/programs.js';
import { featureState } from '../../soldextra/registry.js';
import { fetchWithBackoff } from '../../providers/free-market.js';
import { getKolTrades, getWalletPortfolio, getWalletTrades } from '../../providers/gmgn.js';

const MAX_PARSED_TXS = 8;

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const helius = featureState('helius');
  const url = helius.active
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : PUBLIC_RPC_URL;
  const response = await fetchWithBackoff(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }, fetch);
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const json = await response.json() as { error?: { message?: string }; result?: unknown };
  if (json.error) throw new Error(json.error.message ?? method);
  return json.result;
}

const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function numFrom(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

/**
 * Live scan. On-chain FIFO layers stay unverifiable until a full window parse
 * is supplied. GMGN stats are attached only when the payload actually contains
 * the field, and they are not copied into WIN_RATE.
 */
export async function collectWalletScanInput(wallet: string, now = new Date()): Promise<{ input: WalletScanInput; extra: string[] }> {
  const asOf = utcNow(now);
  const end = now;
  const start = new Date(end.getTime() - WINDOW_MS);
  const extra: string[] = [];
  const input: WalletScanInput = {
    wallet,
    window_start_utc: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    window_end_utc: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    as_of_utc: asOf,
    trades: 0,
    positions_at_least_min_sol: 0,
    window_fully_parsed: false,
    buys: [],
    closed: [],
    loser_mints: null,
    cto_claims: null,
    listing_times: null,
    cohort: null,
    kol_signals: null,
    copy_trade_list_count: null,
    cluster_wallet_count: null,
    bundler_or_jito: null,
    wallet_first_tx_utc: null,
  };

  try {
    const signatures = await rpcCall('getSignaturesForAddress', [wallet, { limit: 100 }]) as Array<{ signature: string; blockTime?: number | null; err?: unknown }>;
    const windowStart = start.getTime() / 1000;
    const inWindow = signatures.filter((row) => row.blockTime == null || row.blockTime >= windowStart);
    const oldest = signatures[signatures.length - 1]?.blockTime;
    const parsed: ReturnType<typeof parseSwap>[] = [];
    for (const row of inWindow.filter((item) => !item.err).slice(0, MAX_PARSED_TXS)) {
      const tx = await rpcCall('getTransaction', [row.signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1 }]);
      parsed.push(parseSwap(tx as Parameters<typeof parseSwap>[0], wallet));
    }
    const swaps = parsed.filter((swap): swap is NonNullable<typeof swap> => swap !== null && swap.time_utc !== null);
    input.trades = swaps.length;
    input.buys = swaps.filter((swap) => swap.side === 'buy').map((swap) => ({
      mint: swap.mint,
      sol: swap.sol,
      time_utc: swap.time_utc as string,
      signature: swap.signature,
    }));
    input.positions_at_least_min_sol = input.buys.filter((buy) => buy.sol >= SCAN_MINIMUMS.minPositionSol).length;
    input.window_fully_parsed = signatures.length < 100 && (oldest == null || oldest <= windowStart) && inWindow.length <= MAX_PARSED_TXS;
    const rpcName = featureState('helius').active ? 'helius getTransaction v1' : 'public RPC getTransaction v1';
    extra.push(`Parsed ${swaps.length} swaps from ${Math.min(inWindow.length, MAX_PARSED_TXS)} of ${inWindow.length} in-window signatures (source: ${rpcName}, as_of_utc: ${asOf}).`);
    if (!input.window_fully_parsed) {
      extra.push('The chain window is a sample. Win rate and layer scores that need full coverage stay unverifiable.');
    }
  } catch (error) {
    extra.push(`Chain window: unverifiable (${error instanceof Error ? error.message : String(error)})`);
  }

  const gmgn = featureState('gmgn_query');
  if (!gmgn.active) {
    extra.push(`GMGN wallet stats: unverifiable (${gmgn.unavailableReason})`);
    return { input, extra };
  }

  try {
    const portfolio = await getWalletPortfolio(wallet, '14d');
    const stats = portfolio.stats && typeof portfolio.stats === 'object'
      ? portfolio.stats as Record<string, unknown>
      : {};
    const win = numFrom(stats, ['winrate', 'win_rate', 'winRate']);
    const pnl = numFrom(stats, ['realized_profit', 'realized_pnl', 'pnl']);
    const trades = numFrom(stats, ['buy', 'buys', 'trade_count', 'total_trades']);
    if (win !== null) {
      extra.push(`GMGN win_rate ${win} (source: GET /v1/user/wallet_stats period=14d, as_of_utc: ${asOf}). This is GMGN's figure, not the FIFO WIN_RATE above.`);
    } else {
      extra.push(`GMGN win_rate: unverifiable (wallet_stats payload had no win-rate field, as_of_utc: ${asOf})`);
    }
    if (pnl !== null) extra.push(`GMGN realized_profit ${pnl} (source: GET /v1/user/wallet_stats, as_of_utc: ${asOf})`);
    if (trades !== null) extra.push(`GMGN trade count field ${trades} (source: GET /v1/user/wallet_stats, as_of_utc: ${asOf})`);
    extra.push(portfolio.holdings_note);
  } catch (error) {
    extra.push(`GMGN wallet stats: unverifiable (${error instanceof Error ? error.message : String(error)})`);
  }

  try {
    const trades = await getWalletTrades(wallet, 'all', 50);
    extra.push(`GMGN wallet_activity returned ${trades.length} rows (source: GET /v1/user/wallet_activity, as_of_utc: ${asOf}). Rows are not promoted to a win rate.`);
  } catch (error) {
    extra.push(`GMGN wallet activity: unverifiable (${error instanceof Error ? error.message : String(error)})`);
  }

  try {
    const kol = await getKolTrades('buy', 20);
    const signals = kol
      .filter((trade) => trade.token_mint && trade.timestamp)
      .map((trade) => ({
        mint: trade.token_mint as string,
        time_utc: new Date((trade.timestamp as number) * (trade.timestamp! > 10_000_000_000 ? 1 : 1000)).toISOString(),
      }));
    input.kol_signals = {
      source: 'GET https://openapi.gmgn.ai/v1/user/kol',
      as_of_utc: asOf,
      items: signals,
    };
  } catch (error) {
    extra.push(`KOL signals: unverifiable (${error instanceof Error ? error.message : String(error)})`);
  }

  return { input, extra };
}

export const scanWalletTool = new DynamicStructuredTool({
  name: 'scan_wallet',
  description:
    'Five-layer Solana wallet scan over a 14-day window. Minimums: 5 trades and at least one position of 0.5 SOL. ' +
    'Weights: inverse loss 20%, liquidity ghost 25%, irrational conviction 20%, CTO meta-reader 20%, consensus deviation 15%. ' +
    'Tiers: PRECOGNITIVE 90-100, SOVEREIGN 75-89, EMERGING 55-74, NOISE below 55. ' +
    'Unmeasured fields are unverifiable. Does not invent a win rate, multiplier, or deviation. Paper tracking only.',
  schema: z.object({
    wallet: z.string().describe('Solana wallet address'),
  }),
  func: async ({ wallet }) => {
    const { input, extra } = await collectWalletScanInput(wallet);
    const report = scoreWallet(input);
    const block = formatWalletBlock(report);
    return extra.length ? `${block}\nNOTES_EXTRA: ${extra.join(' ')}` : block;
  },
});
