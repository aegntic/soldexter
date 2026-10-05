/**
 * Append-only paper-trade ledger.
 *
 * A signal is written once. A horizon is scored by appending a new line.
 * Lines are never rewritten. Live trading is not involved.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { dexterPath } from '../utils/paths.js';

export const PAPER_HORIZONS = ['1h', '24h', '72h'] as const;
export type PaperHorizon = (typeof PAPER_HORIZONS)[number];

export const HORIZON_MS: Record<PaperHorizon, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '72h': 72 * 60 * 60 * 1000,
};

/** Applied on top of the measured price change and stored on the score line. */
export const DEFAULT_PAPER_FEE_BPS = 30;
export const DEFAULT_PAPER_SLIPPAGE_BPS = 100;

export interface PaperPrice {
  value: number;
  quote: 'USD' | 'SOL';
  source: string;
  as_of_utc: string;
}

export interface PaperSignal {
  type: 'signal';
  id: string;
  logged_at_utc: string;
  token: string;
  on_chain_price: PaperPrice;
  source: string;
}

export interface PaperScore {
  type: 'score';
  signal_id: string;
  horizon: PaperHorizon;
  scored_at_utc: string;
  exit_price: PaperPrice;
  fee_bps: number;
  slippage_bps: number;
  /** Percentage points. Null is not written; a missing price is left unscored. */
  return_pct: number;
  entry_price: number;
  entry_as_of_utc: string;
}

export type PaperRecord = PaperSignal | PaperScore;

export function paperReturnPct(
  entry: number,
  exit: number,
  feeBps: number,
  slippageBps: number,
): number | null {
  if (!(entry > 0) || !Number.isFinite(exit) || exit < 0) return null;
  if (!Number.isFinite(feeBps) || !Number.isFinite(slippageBps)) return null;
  const rawPct = ((exit - entry) / entry) * 100;
  const dragPct = (feeBps + slippageBps) / 100;
  return Math.round((rawPct - dragPct) * 1000) / 1000;
}

export function defaultLedgerPath(): string {
  return dexterPath('paper-ledger.jsonl');
}

export function readLedger(path: string): PaperRecord[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const records: PaperRecord[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = JSON.parse(trimmed) as PaperRecord;
    records.push(parsed);
  }
  return records;
}

function appendRecord(path: string, record: PaperRecord): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'a' });
}

export function logPaperSignal(
  input: Omit<PaperSignal, 'type' | 'id' | 'logged_at_utc'> & { id?: string; logged_at_utc?: string },
  path: string = defaultLedgerPath(),
  now: Date = new Date(),
): PaperSignal {
  const signal: PaperSignal = {
    type: 'signal',
    id: input.id ?? `paper_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    logged_at_utc: input.logged_at_utc ?? now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    token: input.token,
    on_chain_price: input.on_chain_price,
    source: input.source,
  };
  if (!(signal.on_chain_price.value > 0)) {
    throw new Error('refusing to log a paper signal without a positive measured price');
  }
  appendRecord(path, signal);
  return signal;
}

export interface ScoreAttempt {
  horizon: PaperHorizon;
  status: 'scored' | 'pending' | 'already_scored';
  score?: PaperScore;
  reason?: string;
}

export function scorePaperSignal(args: {
  signalId: string;
  horizon: PaperHorizon;
  exitPrice: PaperPrice | null;
  path?: string;
  now?: Date;
  feeBps?: number;
  slippageBps?: number;
}): ScoreAttempt {
  const path = args.path ?? defaultLedgerPath();
  const now = args.now ?? new Date();
  const records = readLedger(path);
  const signal = records.find((record): record is PaperSignal => record.type === 'signal' && record.id === args.signalId);
  if (!signal) {
    return { horizon: args.horizon, status: 'pending', reason: `unverifiable (signal ${args.signalId} is not in the ledger)` };
  }
  const existing = records.find((record): record is PaperScore =>
    record.type === 'score' && record.signal_id === args.signalId && record.horizon === args.horizon,
  );
  if (existing) return { horizon: args.horizon, status: 'already_scored', score: existing };

  const loggedMs = Date.parse(signal.logged_at_utc);
  const dueMs = loggedMs + HORIZON_MS[args.horizon];
  if (now.getTime() < dueMs) {
    return {
      horizon: args.horizon,
      status: 'pending',
      reason: `not due until ${new Date(dueMs).toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    };
  }
  if (!args.exitPrice || !(args.exitPrice.value > 0)) {
    return {
      horizon: args.horizon,
      status: 'pending',
      reason: 'unverifiable (exit price was not measured; nothing was written)',
    };
  }
  if (args.exitPrice.quote !== signal.on_chain_price.quote) {
    return {
      horizon: args.horizon,
      status: 'pending',
      reason: `unverifiable (exit quote ${args.exitPrice.quote} does not match entry quote ${signal.on_chain_price.quote})`,
    };
  }
  const feeBps = args.feeBps ?? DEFAULT_PAPER_FEE_BPS;
  const slippageBps = args.slippageBps ?? DEFAULT_PAPER_SLIPPAGE_BPS;
  const ret = paperReturnPct(signal.on_chain_price.value, args.exitPrice.value, feeBps, slippageBps);
  if (ret === null) {
    return { horizon: args.horizon, status: 'pending', reason: 'unverifiable (return could not be computed from the measured prices)' };
  }
  const score: PaperScore = {
    type: 'score',
    signal_id: signal.id,
    horizon: args.horizon,
    scored_at_utc: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    exit_price: args.exitPrice,
    fee_bps: feeBps,
    slippage_bps: slippageBps,
    return_pct: ret,
    entry_price: signal.on_chain_price.value,
    entry_as_of_utc: signal.on_chain_price.as_of_utc,
  };
  appendRecord(path, score);
  return { horizon: args.horizon, status: 'scored', score };
}

export function formatLedgerSummary(path: string = defaultLedgerPath()): string {
  const records = readLedger(path);
  if (records.length === 0) return 'PAPER LEDGER: empty';
  return records.map((record) => {
    if (record.type === 'signal') {
      return `SIGNAL ${record.id} ${record.logged_at_utc} ${record.token} price ${record.on_chain_price.value} ${record.on_chain_price.quote} (source: ${record.on_chain_price.source}, as_of_utc: ${record.on_chain_price.as_of_utc}) via ${record.source}`;
    }
    return `SCORE ${record.signal_id} ${record.horizon} return ${record.return_pct}% after ${record.fee_bps}bps fees + ${record.slippage_bps}bps slippage (exit source: ${record.exit_price.source}, as_of_utc: ${record.exit_price.as_of_utc})`;
  }).join('\n');
}
