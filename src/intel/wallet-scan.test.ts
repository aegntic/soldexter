import { describe, expect, test } from 'bun:test';
import { formatWalletBlock, scoreWallet, tierForScore, type WalletScanInput } from './wallet-scan.js';

const AS_OF = '2026-10-03T05:35:12Z';
const WINDOW_START = '2026-09-19T00:00:00Z';
const WINDOW_END = '2026-10-03T00:00:00Z';

function buy(partial: Partial<WalletScanInput['buys'][number]> & { mint: string }): WalletScanInput['buys'][number] {
  return {
    sol: 1,
    time_utc: '2026-09-25T12:00:00Z',
    entry_mcap_usd: 50_000,
    sol_balance_before: 10,
    ...partial,
  };
}

function baseInput(overrides: Partial<WalletScanInput> = {}): WalletScanInput {
  const buys = Array.from({ length: 10 }, (_, index) => buy({
    mint: `mint${index}`,
    sol: 1,
    time_utc: '2026-09-25T12:00:00Z',
    entry_mcap_usd: index < 5 ? 50_000 : 200_000,
    sol_balance_before: 10,
  }));

  const closed = [0, 1, 2, 3, 4].map((index) => ({
    mint: `mint${index}`,
    sol_in: 1,
    sol_out: index < 3 ? 1.5 : 0.4,
    realized_pnl_sol: index < 3 ? 0.5 : -0.6,
    entry_time_utc: '2026-09-25T12:00:00Z',
    profitable: index < 3,
    median_buy_over_pool_liquidity: index < 2 ? 0.005 : 0.2,
    exit_split_count: index < 2 ? 4 : 1,
    max_exit_price_impact_pct: index < 2 ? 0.5 : 5,
  }));

  return {
    wallet: 'C1ha9J8b8KSDGvEGDC2hmYy6yN4cvcBz9AVDdpQmD3at',
    window_start_utc: WINDOW_START,
    window_end_utc: WINDOW_END,
    as_of_utc: AS_OF,
    trades: 10,
    positions_at_least_min_sol: 10,
    window_fully_parsed: true,
    buys,
    closed,
    loser_mints: {
      source: 'fixture loser cohort',
      as_of_utc: AS_OF,
      items: ['mint8', 'mint9'],
    },
    cto_claims: {
      source: 'fixture DexScreener community-takeovers',
      as_of_utc: AS_OF,
      items: [
        { mint: 'mint0', claim_utc: '2026-09-25T10:00:00Z', token_age_days: 10 },
        { mint: 'mint1', claim_utc: '2026-09-25T10:00:00Z', token_age_days: 12 },
      ],
    },
    listing_times: {
      source: 'fixture DexScreener boosts',
      as_of_utc: AS_OF,
      items: buys.map((row) => ({
        mint: row.mint,
        first_listing_utc: '2026-09-25T12:30:00Z',
      })),
    },
    cohort: {
      source: 'fixture cohort',
      as_of_utc: AS_OF,
      items: [{ wallet: 'peer', mints: ['other'] }],
    },
    kol_signals: { source: 'fixture kol', as_of_utc: AS_OF, items: [] },
    copy_trade_list_count: { value: 1, source: 'fixture lists', as_of_utc: AS_OF },
    cluster_wallet_count: { value: 1, source: 'fixture cluster', as_of_utc: AS_OF },
    bundler_or_jito: { detected: false, detail: 'none', source: 'fixture funding', as_of_utc: AS_OF },
    wallet_first_tx_utc: { value: '2024-12-26T18:56:27Z', source: 'fixture age', as_of_utc: AS_OF },
    ...overrides,
  };
}

describe('tierForScore', () => {
  test('uses the owner bands', () => {
    expect(tierForScore(100)).toBe('PRECOGNITIVE');
    expect(tierForScore(90)).toBe('PRECOGNITIVE');
    expect(tierForScore(89.9)).toBe('SOVEREIGN');
    expect(tierForScore(75)).toBe('SOVEREIGN');
    expect(tierForScore(74.9)).toBe('EMERGING');
    expect(tierForScore(55)).toBe('EMERGING');
    expect(tierForScore(54.9)).toBe('NOISE');
  });
});

describe('scoreWallet', () => {
  test('scores measured layers with owner weights and does not invent missing fields', () => {
    const report = scoreWallet(baseInput());
    expect(report.tier).toBe('EMERGING');
    expect(report.score).toEqual({
      kind: 'measured',
      value: 55,
      source: expect.stringContaining('owner weights'),
      as_of_utc: AS_OF,
    });
    expect(report.primary_edge).toMatchObject({ kind: 'measured', value: 'inverse loss' });
    expect(report.win_rate).toMatchObject({ kind: 'measured', value: '3/5 (60%)' });
    expect(report.consensus_deviation).toMatchObject({ kind: 'measured', value: 100 });
    const block = formatWalletBlock(report);
    expect(block.split('\n').map((line) => line.split(':')[0])).toEqual([
      'WALLET', 'TIER', 'SCORE', 'PRIMARY EDGE', 'WIN_RATE', 'AVG_ENTRY_MCAP',
      'BEST_CALL', 'CONSENSUS_DEVIATION', 'RED_FLAGS', 'CONFIDENCE', 'NOTES',
    ]);
    expect(block).toContain('as_of_utc: 2026-10-03T05:35:12Z');
    expect(block).not.toContain('win rate: 0');
  });

  test('leaves unverifiable layers out of the score and marks a single layer provisional', () => {
    const report = scoreWallet(baseInput({
      loser_mints: null,
      cto_claims: null,
      listing_times: null,
      cohort: null,
      closed: [],
      window_fully_parsed: false,
    }));
    expect(report.tier).toBe('PROVISIONAL');
    expect(report.comparable_band).toBe('NOISE');
    expect(report.score).toMatchObject({ kind: 'measured', value: 50 });
    expect(report.score.kind === 'measured' && report.score.source).toContain('re-weighted');
    expect(report.win_rate.kind).toBe('unverifiable');
    expect(report.consensus_deviation.kind).toBe('unverifiable');
    expect(formatWalletBlock(report)).toContain('unverifiable (');
  });

  test('does not treat a partial window as a failed minimum', () => {
    const report = scoreWallet(baseInput({
      trades: 2,
      positions_at_least_min_sol: 0,
      window_fully_parsed: false,
      buys: [],
      closed: [],
    }));
    expect(report.tier).toBe('UNSCORED');
    expect(formatWalletBlock(report)).toContain('partly parsed');
    expect(report.win_rate.kind).toBe('unverifiable');
  });

  test('does not score a wallet that misses the trade or size minimum', () => {
    const report = scoreWallet(baseInput({ trades: 2, positions_at_least_min_sol: 0, buys: [], closed: [] }));
    expect(report.tier).toBe('UNSCORED');
    expect(report.score.kind).toBe('unverifiable');
    expect(formatWalletBlock(report)).toContain('minimums not met');
    expect(report.win_rate.kind).toBe('unverifiable');
  });

  test('auto-disqualifies the owner red flags', () => {
    const copy = scoreWallet(baseInput({
      copy_trade_list_count: { value: 4, source: 'lists', as_of_utc: AS_OF },
    }));
    expect(copy.tier).toBe('DISQUALIFIED');
    expect(copy.red_flags.map((flag) => flag.code)).toContain('copy_trade_lists');

    const kolBuys = baseInput().buys.map((row, index) => ({
      ...row,
      time_utc: '2026-09-25T12:00:00Z',
      mint: index < 5 ? 'mint0' : row.mint,
    }));
    const kol = scoreWallet(baseInput({
      buys: kolBuys,
      kol_signals: {
        source: 'kol feed',
        as_of_utc: AS_OF,
        items: [{ mint: 'mint0', time_utc: '2026-09-25T12:00:30Z' }],
      },
    }));
    expect(kol.tier).toBe('DISQUALIFIED');
    expect(kol.red_flags.map((flag) => flag.code)).toContain('kol_timing');

    const cluster = scoreWallet(baseInput({
      cluster_wallet_count: { value: 6, source: 'same-slot', as_of_utc: AS_OF },
    }));
    expect(cluster.red_flags.map((flag) => flag.code)).toContain('cluster');

    const bundler = scoreWallet(baseInput({
      bundler_or_jito: { detected: true, detail: 'Jito tip bundle', source: 'funding graph', as_of_utc: AS_OF },
    }));
    expect(bundler.red_flags.map((flag) => flag.code)).toContain('bundler_jito');
  });

  test('disqualifies a young wallet only when the PnL curve is measured and smooth', () => {
    const smooth = [0, 1, 2, 3, 4].map((index) => ({
      mint: `m${index}`,
      sol_in: 1,
      sol_out: 1.2,
      realized_pnl_sol: 0.2,
      entry_time_utc: '2026-09-25T12:00:00Z',
      profitable: true,
      median_buy_over_pool_liquidity: 0.5,
      exit_split_count: 1,
      max_exit_price_impact_pct: 3,
    }));
    const flagged = scoreWallet(baseInput({
      closed: smooth,
      wallet_first_tx_utc: { value: '2026-09-20T00:00:00Z', source: 'first sig', as_of_utc: AS_OF },
    }));
    expect(flagged.tier).toBe('DISQUALIFIED');
    expect(flagged.red_flags.map((flag) => flag.code)).toContain('young_clean_pnl');

    const unmeasured = scoreWallet(baseInput({
      window_fully_parsed: false,
      wallet_first_tx_utc: { value: '2026-09-20T00:00:00Z', source: 'first sig', as_of_utc: AS_OF },
    }));
    expect(unmeasured.tier).not.toBe('DISQUALIFIED');
    expect(unmeasured.unchecked_flags.map((flag) => flag.code)).toContain('young_clean_pnl');
  });

  test('names unchecked red flags instead of calling them clean', () => {
    const report = scoreWallet(baseInput({
      copy_trade_list_count: null,
      kol_signals: null,
      cluster_wallet_count: null,
      bundler_or_jito: null,
      wallet_first_tx_utc: null,
    }));
    expect(report.red_flags).toHaveLength(0);
    expect(formatWalletBlock(report)).toContain('unverifiable: copy_trade_lists');
  });
});
