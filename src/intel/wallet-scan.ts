/**
 * Five-layer wallet scan.
 *
 * Owner weights: inverse loss 20%, liquidity ghost 25%, irrational conviction 20%,
 * CTO meta-reader 20%, consensus deviation 15%.
 *
 * Tiers: PRECOGNITIVE 90–100, SOVEREIGN 75–89, EMERGING 55–74, NOISE <55.
 * A single measured layer is PROVISIONAL (the number is not comparable).
 * Red flags disqualify before a tier is assigned.
 * Unmeasured inputs stay unverifiable. Nothing here invents a win rate,
 * multiplier, or deviation.
 */

import { formatField, measured, unverifiable, type Field } from './sourced.js';

export const LAYER_WEIGHTS = {
  inverse_loss: 0.2,
  liquidity_ghost: 0.25,
  irrational_conviction: 0.2,
  cto_meta_reader: 0.2,
  consensus_deviation: 0.15,
} as const;

export type LayerId = keyof typeof LAYER_WEIGHTS;

export const LAYER_LABEL: Record<LayerId, string> = {
  inverse_loss: 'inverse loss',
  liquidity_ghost: 'liquidity ghost',
  irrational_conviction: 'irrational conviction',
  cto_meta_reader: 'CTO meta-reader',
  consensus_deviation: 'consensus deviation',
};

export const SCAN_MINIMUMS = {
  minTrades: 5,
  minPositionSol: 0.5,
  windowDays: 14,
} as const;

const SMALL_CAP_USD = 100_000;
const CONVICTION_BALANCE_SHARE = 0.05;
const GHOST_POOL_SHARE = 0.01;
const GHOST_MIN_EXITS = 3;
const GHOST_MAX_IMPACT_PCT = 2;
const GHOST_MIN_COVERAGE = 0.5;
const CTO_MAX_LAG_MS = 24 * 60 * 60 * 1000;
const CTO_MIN_TOKEN_AGE_DAYS = 7;
const LISTING_LEAD_MS = 10 * 60 * 1000;
const HERD_JACCARD = 0.2;
const KOL_WINDOW_MS = 60 * 1000;
const KOL_ENTRY_SHARE = 0.4;
const COPY_LIST_MAX = 3;
const CLUSTER_MAX = 5;
const YOUNG_WALLET_DAYS = 30;
const CLEAN_MIN_CLOSED = 5;
const CLEAN_MIN_WIN_RATE = 0.8;
const CLEAN_MAX_TOP_SHARE = 0.5;
const WINDOW_SLACK_MS = 60 * 1000;

export type SkillTier = 'PRECOGNITIVE' | 'SOVEREIGN' | 'EMERGING' | 'NOISE';
export type ScanTier = SkillTier | 'PROVISIONAL' | 'DISQUALIFIED' | 'UNSCORED';

export interface SourcedCount {
  value: number;
  source: string;
  as_of_utc: string;
}

export interface BuyObservation {
  mint: string;
  sol: number;
  time_utc: string;
  entry_mcap_usd?: number | null;
  sol_balance_before?: number | null;
  signature?: string;
}

export interface ClosedPosition {
  mint: string;
  sol_in: number;
  sol_out: number;
  realized_pnl_sol: number;
  entry_time_utc: string;
  profitable: boolean;
  entry_mcap_usd?: number | null;
  /** Median buy SOL / pool SOL liquidity at entry. */
  median_buy_over_pool_liquidity?: number | null;
  exit_split_count?: number | null;
  max_exit_price_impact_pct?: number | null;
}

export interface CtoClaim {
  mint: string;
  claim_utc: string;
  token_age_days: number;
}

export interface ListingTime {
  mint: string;
  first_listing_utc: string;
}

export interface CohortWallet {
  wallet: string;
  mints: string[];
}

export interface KolSignal {
  mint: string;
  time_utc: string;
}

export interface SourcedSet<T> {
  source: string;
  as_of_utc: string;
  items: T[];
}

export interface WalletScanInput {
  wallet: string;
  window_start_utc: string;
  window_end_utc: string;
  as_of_utc: string;
  /** Completed swaps inside the window. */
  trades: number;
  /** Positions whose cost is at least SCAN_MINIMUMS.minPositionSol. */
  positions_at_least_min_sol: number;
  /** True only when every in-window transaction was parsed. */
  window_fully_parsed: boolean;
  buys: BuyObservation[];
  closed: ClosedPosition[];
  /** null = the check was not run. */
  loser_mints: SourcedSet<string> | null;
  cto_claims: SourcedSet<CtoClaim> | null;
  listing_times: SourcedSet<ListingTime> | null;
  cohort: SourcedSet<CohortWallet> | null;
  kol_signals: SourcedSet<KolSignal> | null;
  copy_trade_list_count: SourcedCount | null;
  /** Other wallets in the same cluster, not including this wallet. */
  cluster_wallet_count: SourcedCount | null;
  bundler_or_jito: { detected: boolean; detail: string; source: string; as_of_utc: string } | null;
  wallet_first_tx_utc: { value: string; source: string; as_of_utc: string } | null;
}

export interface LayerResult {
  id: LayerId;
  weight: number;
  score: Field<number>;
}

export interface RedFlag {
  code: string;
  detail: string;
  source: string;
  as_of_utc: string;
}

export interface UncheckedFlag {
  code: string;
  reason: string;
}

export interface WalletScanReport {
  wallet: string;
  tier: ScanTier;
  /** Skill band the score would land in. Omitted when there is no score. */
  comparable_band: SkillTier | null;
  score: Field<number>;
  primary_edge: Field<string>;
  win_rate: Field<string>;
  avg_entry_mcap: Field<number>;
  best_call: Field<string>;
  consensus_deviation: Field<number>;
  red_flags: RedFlag[];
  unchecked_flags: UncheckedFlag[];
  confidence: Field<string>;
  notes: string[];
  layers: LayerResult[];
  as_of_utc: string;
}

export function tierForScore(score: number): SkillTier {
  if (score >= 90) return 'PRECOGNITIVE';
  if (score >= 75) return 'SOVEREIGN';
  if (score >= 55) return 'EMERGING';
  return 'NOISE';
}

function parseTime(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function inWindow(timeUtc: string, startMs: number, endMs: number): boolean {
  const ms = parseTime(timeUtc);
  if (ms === null) return false;
  return ms >= startMs && ms <= endMs;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function jaccard(a: string[], b: string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size === 0 && right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) intersection += 1;
  }
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function scoreInverseLoss(buys: BuyObservation[], losers: SourcedSet<string> | null): Field<number> {
  if (!losers) return unverifiable('no loser cohort (GMGN or supplied top-loser list was not available)');
  const large = buys.filter((buy) => buy.sol >= SCAN_MINIMUMS.minPositionSol);
  if (large.length === 0) return unverifiable('no buys of at least 0.5 SOL to compare with the loser cohort');
  const loserSet = new Set(losers.items);
  const avoided = large.filter((buy) => !loserSet.has(buy.mint)).length;
  return measured(
    round1((avoided / large.length) * 100),
    `${losers.source}; ${avoided}/${large.length} buys >=0.5 SOL not in the loser set`,
    losers.as_of_utc,
  );
}

function scoreLiquidityGhost(closed: ClosedPosition[], asOf: string): Field<number> {
  if (closed.length === 0) return unverifiable('no closed positions in the window');
  const fully = closed.filter((position) =>
    typeof position.median_buy_over_pool_liquidity === 'number'
    && typeof position.exit_split_count === 'number'
    && typeof position.max_exit_price_impact_pct === 'number',
  );
  const hits = fully.filter((position) =>
    (position.median_buy_over_pool_liquidity as number) <= GHOST_POOL_SHARE
    && (position.exit_split_count as number) >= GHOST_MIN_EXITS
    && (position.max_exit_price_impact_pct as number) < GHOST_MAX_IMPACT_PCT,
  );
  const coverage = fully.length / closed.length;
  if (coverage < GHOST_MIN_COVERAGE && hits.length < 3) {
    return unverifiable(
      `pool-footprint coverage ${fully.length}/${closed.length} closed positions, below 50%, and fewer than 3 ghost exits`,
    );
  }
  const denominator = fully.length === 0 ? closed.length : fully.length;
  return measured(
    round1((hits.length / denominator) * 100),
    `on-chain pool footprint: ${hits.length}/${denominator} closed positions with buy/pool<=1%, >=3 exits, impact<2%`,
    asOf,
  );
}

function scoreConviction(buys: BuyObservation[], asOf: string): Field<number> {
  const large = buys.filter((buy) => buy.sol >= SCAN_MINIMUMS.minPositionSol);
  const measurable = large.filter((buy) =>
    typeof buy.entry_mcap_usd === 'number'
    && typeof buy.sol_balance_before === 'number'
    && (buy.sol_balance_before as number) > 0,
  );
  if (measurable.length === 0) {
    return unverifiable('no buys >=0.5 SOL with both entry market cap and pre-trade SOL balance');
  }
  const passed = measurable.filter((buy) =>
    (buy.entry_mcap_usd as number) < SMALL_CAP_USD
    && buy.sol / (buy.sol_balance_before as number) > CONVICTION_BALANCE_SHARE,
  );
  return measured(
    round1((passed.length / measurable.length) * 100),
    `${passed.length}/${measurable.length} measurable buys >=0.5 SOL with entry mcap <$100k and size >5% of SOL balance`,
    asOf,
  );
}

function scoreCto(buys: BuyObservation[], claims: SourcedSet<CtoClaim> | null): Field<number> {
  if (!claims) return unverifiable('no DexScreener community-takeover claim list');
  if (buys.length === 0) return unverifiable('no buys in the window to compare with takeover claims');
  const hits = buys.filter((buy) => {
    const buyMs = parseTime(buy.time_utc);
    if (buyMs === null) return false;
    return claims.items.some((claim) => {
      if (claim.mint !== buy.mint) return false;
      if (claim.token_age_days < CTO_MIN_TOKEN_AGE_DAYS) return false;
      const claimMs = parseTime(claim.claim_utc);
      if (claimMs === null) return false;
      return buyMs > claimMs && buyMs - claimMs <= CTO_MAX_LAG_MS;
    });
  });
  return measured(
    round1((hits.length / buys.length) * 100),
    `${claims.source}; ${hits.length}/${buys.length} buys within 24h after a takeover claim on a token >=7d old`,
    claims.as_of_utc,
  );
}

function scoreConsensus(
  buys: BuyObservation[],
  listings: SourcedSet<ListingTime> | null,
  cohort: SourcedSet<CohortWallet> | null,
): Field<number> {
  if (!listings) return unverifiable('no DexScreener listing or boost timestamps');
  if (!cohort) return unverifiable('no peer cohort to measure herding against');
  if (cohort.items.length === 0) return unverifiable('peer cohort was empty');
  const walletMints = [...new Set(buys.map((buy) => buy.mint))];
  const listingByMint = new Map(listings.items.map((row) => [row.mint, row.first_listing_utc]));
  const comparable = buys.filter((buy) => listingByMint.has(buy.mint) && parseTime(buy.time_utc) !== null);
  if (comparable.length === 0) return unverifiable('no buys had a listing timestamp to compare');
  const early = comparable.filter((buy) => {
    const buyMs = parseTime(buy.time_utc) as number;
    const listMs = parseTime(listingByMint.get(buy.mint) as string);
    if (listMs === null) return false;
    return buyMs < listMs - LISTING_LEAD_MS;
  });
  const earlyShare = early.length / comparable.length;
  const overlaps = cohort.items.map((peer) => jaccard(walletMints, peer.mints));
  const meanJaccard = overlaps.reduce((sum, value) => sum + value, 0) / overlaps.length;
  const herdingFactor = meanJaccard < HERD_JACCARD ? 1 : Math.max(0, 1 - meanJaccard);
  return measured(
    round1(earlyShare * herdingFactor * 100),
    `${listings.source}; ${early.length}/${comparable.length} buys were >10min before first listing; mean Jaccard vs cohort ${meanJaccard.toFixed(3)} (${cohort.source})`,
    listings.as_of_utc,
  );
}

function winRateField(input: WalletScanInput, closed: ClosedPosition[]): Field<string> {
  if (!input.window_fully_parsed) {
    return unverifiable('window only partly parsed, so a win rate would be a lower bound');
  }
  if (closed.length < SCAN_MINIMUMS.minTrades) {
    return unverifiable(`fewer than ${SCAN_MINIMUMS.minTrades} closed positions (${closed.length})`);
  }
  const wins = closed.filter((position) => position.profitable).length;
  const pct = round1((wins / closed.length) * 100);
  return measured(
    `${wins}/${closed.length} (${pct}%)`,
    'FIFO realized PnL on closed positions inside the fully parsed 14-day window',
    input.as_of_utc,
  );
}

function avgEntryMcap(buys: BuyObservation[], asOf: string): Field<number> {
  const samples = buys.filter((buy) =>
    buy.sol >= SCAN_MINIMUMS.minPositionSol && typeof buy.entry_mcap_usd === 'number',
  );
  if (samples.length === 0) return unverifiable('no buys >=0.5 SOL with a measured entry market cap');
  const mean = samples.reduce((sum, buy) => sum + (buy.entry_mcap_usd as number), 0) / samples.length;
  return measured(
    round1(mean),
    `mean entry market cap across ${samples.length} buys >=0.5 SOL`,
    asOf,
  );
}

function bestCall(closed: ClosedPosition[], asOf: string): Field<string> {
  if (closed.length === 0) return unverifiable('no closed positions in the window');
  const best = closed.reduce((top, position) =>
    position.realized_pnl_sol > top.realized_pnl_sol ? position : top,
  );
  const multiple = best.sol_in > 0 ? `, multiple ${(best.sol_out / best.sol_in).toFixed(2)}x` : '';
  return measured(
    `${best.mint} realized ${best.realized_pnl_sol} SOL${multiple}`,
    'largest FIFO realized SOL pnl among closed positions in the window',
    asOf,
  );
}

function cleanCurve(closed: ClosedPosition[]): boolean {
  if (closed.length < CLEAN_MIN_CLOSED) return false;
  const wins = closed.filter((position) => position.profitable).length;
  if (wins / closed.length < CLEAN_MIN_WIN_RATE) return false;
  const gains = closed.map((position) => position.realized_pnl_sol).filter((pnl) => pnl > 0);
  const total = gains.reduce((sum, pnl) => sum + pnl, 0);
  if (total <= 0) return false;
  const top = Math.max(...gains);
  return top / total < CLEAN_MAX_TOP_SHARE;
}

function collectRedFlags(input: WalletScanInput, closed: ClosedPosition[]): { flags: RedFlag[]; unchecked: UncheckedFlag[] } {
  const flags: RedFlag[] = [];
  const unchecked: UncheckedFlag[] = [];

  if (!input.copy_trade_list_count) {
    unchecked.push({ code: 'copy_trade_lists', reason: 'copy-trade list membership was not measured' });
  } else if (input.copy_trade_list_count.value > COPY_LIST_MAX) {
    flags.push({
      code: 'copy_trade_lists',
      detail: `on ${input.copy_trade_list_count.value} copy-trade lists (more than ${COPY_LIST_MAX})`,
      source: input.copy_trade_list_count.source,
      as_of_utc: input.copy_trade_list_count.as_of_utc,
    });
  }

  if (!input.kol_signals) {
    unchecked.push({ code: 'kol_timing', reason: 'KOL signal timestamps were not measured' });
  } else if (input.buys.length === 0) {
    unchecked.push({ code: 'kol_timing', reason: 'no buys to compare with KOL signals' });
  } else {
    const near = input.buys.filter((buy) => {
      const buyMs = parseTime(buy.time_utc);
      if (buyMs === null) return false;
      return input.kol_signals!.items.some((signal) => {
        if (signal.mint !== buy.mint) return false;
        const signalMs = parseTime(signal.time_utc);
        if (signalMs === null) return false;
        return Math.abs(buyMs - signalMs) <= KOL_WINDOW_MS;
      });
    });
    const share = near.length / input.buys.length;
    if (share > KOL_ENTRY_SHARE) {
      flags.push({
        code: 'kol_timing',
        detail: `${near.length}/${input.buys.length} entries (${round1(share * 100)}%) within 60s of a KOL signal`,
        source: input.kol_signals.source,
        as_of_utc: input.kol_signals.as_of_utc,
      });
    }
  }

  if (!input.cluster_wallet_count) {
    unchecked.push({ code: 'cluster', reason: 'wallet clustering was not measured' });
  } else if (input.cluster_wallet_count.value > CLUSTER_MAX) {
    flags.push({
      code: 'cluster',
      detail: `clustering with ${input.cluster_wallet_count.value} wallets (more than ${CLUSTER_MAX})`,
      source: input.cluster_wallet_count.source,
      as_of_utc: input.cluster_wallet_count.as_of_utc,
    });
  }

  if (!input.bundler_or_jito) {
    unchecked.push({ code: 'bundler_jito', reason: 'bundler and Jito patterns were not measured' });
  } else if (input.bundler_or_jito.detected) {
    flags.push({
      code: 'bundler_jito',
      detail: input.bundler_or_jito.detail,
      source: input.bundler_or_jito.source,
      as_of_utc: input.bundler_or_jito.as_of_utc,
    });
  }

  if (!input.wallet_first_tx_utc) {
    unchecked.push({ code: 'young_clean_pnl', reason: 'wallet age was not measured' });
  } else {
    const firstMs = parseTime(input.wallet_first_tx_utc.value);
    const asOfMs = parseTime(input.as_of_utc);
    if (firstMs === null || asOfMs === null) {
      unchecked.push({ code: 'young_clean_pnl', reason: 'wallet age timestamps could not be parsed' });
    } else {
      const ageDays = (asOfMs - firstMs) / (24 * 60 * 60 * 1000);
      if (ageDays < YOUNG_WALLET_DAYS) {
        if (!input.window_fully_parsed || closed.length < CLEAN_MIN_CLOSED) {
          unchecked.push({
            code: 'young_clean_pnl',
            reason: `wallet is ${ageDays.toFixed(1)}d old but the PnL curve is not fully measured, so it is not auto-disqualified on age alone`,
          });
        } else if (cleanCurve(closed)) {
          flags.push({
            code: 'young_clean_pnl',
            detail: `wallet age ${ageDays.toFixed(1)}d (<${YOUNG_WALLET_DAYS}) with a smooth win rate >=80% that is not one trade`,
            source: input.wallet_first_tx_utc.source,
            as_of_utc: input.wallet_first_tx_utc.as_of_utc,
          });
        }
      }
    }
  }

  return { flags, unchecked };
}

function gateReason(input: WalletScanInput, startMs: number, endMs: number): string | null {
  const span = endMs - startMs;
  const maxSpan = SCAN_MINIMUMS.windowDays * 24 * 60 * 60 * 1000 + WINDOW_SLACK_MS;
  const problems: string[] = [];
  if (span > maxSpan) problems.push(`window is longer than ${SCAN_MINIMUMS.windowDays} days`);
  const shortTrades = input.trades < SCAN_MINIMUMS.minTrades;
  const shortSize = input.positions_at_least_min_sol < 1;
  if (!input.window_fully_parsed && (shortTrades || shortSize)) {
    problems.push(
      `window only partly parsed (trades seen=${input.trades}, positions >=${SCAN_MINIMUMS.minPositionSol} SOL seen=${input.positions_at_least_min_sol}); the minimum is unverifiable from this sample`,
    );
  } else {
    if (shortTrades) problems.push(`trades=${input.trades}, need >=${SCAN_MINIMUMS.minTrades}`);
    if (shortSize) {
      problems.push(`positions >=${SCAN_MINIMUMS.minPositionSol} SOL=${input.positions_at_least_min_sol}, need >=1`);
    }
  }
  return problems.length ? problems.join('; ') : null;
}

export function scoreWallet(input: WalletScanInput): WalletScanReport {
  const startMs = parseTime(input.window_start_utc) ?? 0;
  const endMs = parseTime(input.window_end_utc) ?? 0;
  const buys = input.buys.filter((buy) => inWindow(buy.time_utc, startMs, endMs));
  const closed = input.closed.filter((position) => inWindow(position.entry_time_utc, startMs, endMs));

  const layers: LayerResult[] = [
    { id: 'inverse_loss', weight: LAYER_WEIGHTS.inverse_loss, score: scoreInverseLoss(buys, input.loser_mints) },
    { id: 'liquidity_ghost', weight: LAYER_WEIGHTS.liquidity_ghost, score: scoreLiquidityGhost(closed, input.as_of_utc) },
    { id: 'irrational_conviction', weight: LAYER_WEIGHTS.irrational_conviction, score: scoreConviction(buys, input.as_of_utc) },
    { id: 'cto_meta_reader', weight: LAYER_WEIGHTS.cto_meta_reader, score: scoreCto(buys, input.cto_claims) },
    { id: 'consensus_deviation', weight: LAYER_WEIGHTS.consensus_deviation, score: scoreConsensus(buys, input.listing_times, input.cohort) },
  ];

  const { flags, unchecked } = collectRedFlags({ ...input, buys }, closed);
  const consensus = layers.find((layer) => layer.id === 'consensus_deviation')!.score;
  const notes: string[] = [];

  const base = {
    wallet: input.wallet,
    win_rate: winRateField(input, closed),
    avg_entry_mcap: avgEntryMcap(buys, input.as_of_utc),
    best_call: bestCall(closed, input.as_of_utc),
    consensus_deviation: consensus,
    red_flags: flags,
    unchecked_flags: unchecked,
    layers,
    as_of_utc: input.as_of_utc,
    notes,
  };

  if (flags.length > 0) {
    notes.push('Red flags disqualify the wallet before a skill tier is assigned. Do not copy-trade it.');
    notes.push('Priority fee versus the block median is unverifiable (getBlock per slot is too heavy for the public RPC).');
    return {
      ...base,
      tier: 'DISQUALIFIED',
      comparable_band: null,
      score: unverifiable(`disqualified before scoring: ${flags.map((flag) => flag.code).join(', ')}`),
      primary_edge: unverifiable('disqualified before scoring'),
      confidence: unverifiable('disqualified before scoring'),
    };
  }

  const failedGate = gateReason(input, startMs, endMs);
  if (failedGate) {
    notes.push(`Minimums are ${SCAN_MINIMUMS.minTrades} trades and at least one position of ${SCAN_MINIMUMS.minPositionSol} SOL inside a ${SCAN_MINIMUMS.windowDays}-day window.`);
    return {
      ...base,
      tier: 'UNSCORED',
      comparable_band: null,
      score: unverifiable(`minimums not met: ${failedGate}`),
      primary_edge: unverifiable('minimums not met'),
      confidence: unverifiable('minimums not met'),
    };
  }

  const measuredLayers = layers.filter((layer) => layer.score.kind === 'measured');
  for (const layer of layers) {
    if (layer.score.kind === 'unverifiable') {
      notes.push(`${LAYER_LABEL[layer.id]}: unverifiable (${layer.score.reason})`);
    } else {
      notes.push(`${LAYER_LABEL[layer.id]}: ${layer.score.value}/100 (weight ${(layer.weight * 100).toFixed(0)}%, source: ${layer.score.source}, as_of_utc: ${layer.score.as_of_utc})`);
    }
  }
  notes.push('Priority fee versus the block median is unverifiable (getBlock per slot is too heavy for the public RPC).');
  if (!input.window_fully_parsed) {
    notes.push('The window was only partly parsed. Trade counts from this sample are a lower bound.');
  }

  if (measuredLayers.length === 0) {
    return {
      ...base,
      tier: 'UNSCORED',
      comparable_band: null,
      score: unverifiable('no layer could be measured'),
      primary_edge: unverifiable('no layer could be measured'),
      confidence: measured('0/5 measured layers', 'wallet scan layer coverage', input.as_of_utc),
    };
  }

  const weightSum = measuredLayers.reduce((sum, layer) => sum + layer.weight, 0);
  const weighted = measuredLayers.reduce((sum, layer) => sum + layer.weight * (layer.score.kind === 'measured' ? layer.score.value : 0), 0);
  const scoreValue = round1(weighted / weightSum);
  const band = tierForScore(scoreValue);
  const used = measuredLayers.map((layer) => `${LAYER_LABEL[layer.id]} ${(layer.weight * 100).toFixed(0)}%`).join(', ');
  const dropped = layers.filter((layer) => layer.score.kind === 'unverifiable').map((layer) => LAYER_LABEL[layer.id]);
  const weightNote = dropped.length === 0
    ? `owner weights: ${used}`
    : `re-weighted over measured layers: ${used}; unverifiable: ${dropped.join(', ')}`;

  const edge = [...measuredLayers].sort((a, b) => {
    const av = a.weight * (a.score.kind === 'measured' ? a.score.value : 0);
    const bv = b.weight * (b.score.kind === 'measured' ? b.score.value : 0);
    if (bv !== av) return bv - av;
    return b.weight - a.weight;
  })[0];

  const provisional = measuredLayers.length < 2;
  if (provisional) {
    notes.push(`PROVISIONAL: only ${LAYER_LABEL[edge.id]} was measured. The score is not comparable to a multi-layer score. Comparable band if it were: ${band}.`);
  }

  return {
    ...base,
    tier: provisional ? 'PROVISIONAL' : band,
    comparable_band: band,
    score: measured(scoreValue, weightNote, input.as_of_utc),
    primary_edge: measured(LAYER_LABEL[edge.id], 'highest weight times layer score among measured layers', input.as_of_utc),
    confidence: measured(
      `${measuredLayers.length}/5 measured layers`,
      'wallet scan layer coverage',
      input.as_of_utc,
    ),
  };
}

function formatFlagList(flags: RedFlag[], unchecked: UncheckedFlag[]): string {
  const detected = flags.length
    ? flags.map((flag) => `${flag.detail} (source: ${flag.source}, as_of_utc: ${flag.as_of_utc})`).join('; ')
    : 'none detected among measured checks';
  const missing = unchecked.length
    ? `; unverifiable: ${unchecked.map((item) => `${item.code} (${item.reason})`).join('; ')}`
    : '';
  return `${detected}${missing}`;
}

export function formatWalletBlock(report: WalletScanReport): string {
  const scoreText = report.score.kind === 'measured'
    ? `${report.score.value}/100 (${report.score.source}, as_of_utc: ${report.score.as_of_utc})`
    : formatField(report.score);
  const lines = [
    `WALLET: ${report.wallet}`,
    `TIER: ${report.tier}`,
    `SCORE: ${scoreText}`,
    `PRIMARY EDGE: ${formatField(report.primary_edge)}`,
    `WIN_RATE: ${formatField(report.win_rate)}`,
    `AVG_ENTRY_MCAP: ${formatField(report.avg_entry_mcap, (value) => `$${value}`)}`,
    `BEST_CALL: ${formatField(report.best_call)}`,
    `CONSENSUS_DEVIATION: ${formatField(report.consensus_deviation, (value) => `${value}/100`)}`,
    `RED_FLAGS: ${formatFlagList(report.red_flags, report.unchecked_flags)}`,
    `CONFIDENCE: ${formatField(report.confidence)}`,
    `NOTES: ${report.notes.join(' ')}`,
  ];
  return lines.join('\n');
}
