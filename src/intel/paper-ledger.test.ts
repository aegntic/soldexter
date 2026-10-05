import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_PAPER_FEE_BPS,
  DEFAULT_PAPER_SLIPPAGE_BPS,
  formatLedgerSummary,
  logPaperSignal,
  paperReturnPct,
  readLedger,
  scorePaperSignal,
} from './paper-ledger.js';

describe('paperReturnPct', () => {
  test('subtracts fees and slippage from the measured price change', () => {
    // 10% raw move, 30 bps fee + 100 bps slippage = 1.3 percentage points.
    expect(paperReturnPct(1, 1.1, 30, 100)).toBe(8.7);
  });

  test('refuses a zero entry price', () => {
    expect(paperReturnPct(0, 1, 30, 100)).toBeNull();
  });
});

describe('paper ledger', () => {
  test('appends a signal and later scores due horizons without rewriting lines', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'paper-')), 'ledger.jsonl');
    const logged = new Date('2026-10-03T00:00:00Z');
    const signal = logPaperSignal({
      id: 'sig1',
      token: 'Mint111',
      on_chain_price: {
        value: 1,
        quote: 'USD',
        source: 'https://lite-api.jup.ag/price/v3?ids=Mint111',
        as_of_utc: '2026-10-03T00:00:00Z',
      },
      source: 'risk auditor HIGH',
      logged_at_utc: '2026-10-03T00:00:00Z',
    }, path, logged);

    const tooSoon = scorePaperSignal({
      signalId: signal.id,
      horizon: '1h',
      exitPrice: { value: 2, quote: 'USD', source: 'jupiter', as_of_utc: '2026-10-03T00:30:00Z' },
      path,
      now: new Date('2026-10-03T00:30:00Z'),
    });
    expect(tooSoon.status).toBe('pending');
    expect(readLedger(path)).toHaveLength(1);

    const missing = scorePaperSignal({
      signalId: signal.id,
      horizon: '1h',
      exitPrice: null,
      path,
      now: new Date('2026-10-03T02:00:00Z'),
    });
    expect(missing.status).toBe('pending');
    expect(missing.reason).toContain('unverifiable');
    expect(readLedger(path)).toHaveLength(1);

    const scored = scorePaperSignal({
      signalId: signal.id,
      horizon: '1h',
      exitPrice: { value: 1.1, quote: 'USD', source: 'jupiter price', as_of_utc: '2026-10-03T01:00:05Z' },
      path,
      now: new Date('2026-10-03T01:00:05Z'),
      feeBps: DEFAULT_PAPER_FEE_BPS,
      slippageBps: DEFAULT_PAPER_SLIPPAGE_BPS,
    });
    expect(scored.status).toBe('scored');
    expect(scored.score?.return_pct).toBe(8.7);

    const again = scorePaperSignal({
      signalId: signal.id,
      horizon: '1h',
      exitPrice: { value: 9, quote: 'USD', source: 'should-not-apply', as_of_utc: '2026-10-03T01:10:00Z' },
      path,
      now: new Date('2026-10-03T03:00:00Z'),
    });
    expect(again.status).toBe('already_scored');
    expect(again.score?.return_pct).toBe(8.7);
    expect(readLedger(path)).toHaveLength(2);
    expect(formatLedgerSummary(path)).toContain('return 8.7%');
  });

  test('refuses to log a signal with no measured price', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'paper-')), 'ledger.jsonl');
    expect(() => logPaperSignal({
      token: 'Mint',
      on_chain_price: { value: 0, quote: 'USD', source: 'none', as_of_utc: '2026-10-03T00:00:00Z' },
      source: 'test',
    }, path)).toThrow(/positive measured price/);
  });
});
