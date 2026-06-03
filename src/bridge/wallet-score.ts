export type WalletTier = 'PRECOGNITIVE' | 'SOVEREIGN' | 'EMERGING' | 'Noise';

export interface LayerScores {
  inverse_loss_archaeology: number;
  liquidity_ghost_detection: number;
  irrational_conviction: number;
  cto_meta_reader: number;
  consensus_deviation: number;
}

export interface FiveLayerScore {
  address: string;
  composite: number;
  tier: WalletTier;
  layers: LayerScores;
  red_flags: string[];
  rationale: string;
}

export interface WalletScoreParams {
  address: string;
  tradeHistory: Array<{
    token_in: string;
    token_out: string;
    amount_in: number;
    amount_out: number;
    usd_value: number;
    timestamp: number;
  }>;
  liquidityEvents: Array<{
    pool: string;
    event_type: string;
    sol_delta: number;
    timestamp: number;
  }>;
  holderSnapshot?: {
    holder_count: number;
    top_10_pct: number;
  };
}

const TIER_THRESHOLDS = {
  PRECOGNITIVE: 75,
  SOVEREIGN: 55,
  EMERGING: 35,
} as const;

export function scoreWallet(params: WalletScoreParams): FiveLayerScore {
  const redFlags = detectRedFlags(params);
  if (redFlags.length > 0) {
    return {
      address: params.address,
      composite: 0,
      tier: 'Noise',
      layers: zeroLayers(),
      red_flags: redFlags,
      rationale: `Disqualified: ${redFlags[0]}`,
    };
  }

  const layers: LayerScores = {
    inverse_loss_archaeology: scoreInverseLoss(params),
    liquidity_ghost_detection: scoreLiquidityGhost(params),
    irrational_conviction: scoreConviction(params),
    cto_meta_reader: scoreCtoMeta(params),
    consensus_deviation: scoreConsensusDeviation(params),
  };

  const weights = {
    inverse_loss_archaeology: 0.20,
    liquidity_ghost_detection: 0.25,
    irrational_conviction: 0.20,
    cto_meta_reader: 0.20,
    consensus_deviation: 0.15,
  };

  const composite = Object.entries(layers).reduce((sum, [k, v]) => sum + v * (weights as Record<string, number>)[k], 0);

  const tier: WalletTier =
    composite >= TIER_THRESHOLDS.PRECOGNITIVE ? 'PRECOGNITIVE'
    : composite >= TIER_THRESHOLDS.SOVEREIGN ? 'SOVEREIGN'
    : composite >= TIER_THRESHOLDS.EMERGING ? 'EMERGING'
    : 'Noise';

  return {
    address: params.address,
    composite: Math.round(composite * 100) / 100,
    tier,
    layers,
    red_flags: [],
    rationale: buildRationale(layers, tier),
  };
}

function detectRedFlags(params: WalletScoreParams): string[] {
  const flags: string[] = [];
  if (params.tradeHistory.length === 0) return flags;

  const recent = params.tradeHistory.filter((t) => Date.now() / 1000 - t.timestamp < 86400);
  if (recent.length > 50) flags.push('bot_like_frequency');
  const avgSize = params.tradeHistory.reduce((s, t) => s + Math.abs(t.usd_value), 0) / params.tradeHistory.length;
  if (avgSize < 10 && params.tradeHistory.length > 20) flags.push('dust_volume');
  const wins = params.tradeHistory.filter((t) => t.usd_value > 0).length;
  if (params.tradeHistory.length > 10 && wins / params.tradeHistory.length < 0.1) flags.push('persistent_loser');

  return flags;
}

function zeroLayers(): LayerScores {
  return { inverse_loss_archaeology: 0, liquidity_ghost_detection: 0, irrational_conviction: 0, cto_meta_reader: 0, consensus_deviation: 0 };
}

function scoreInverseLoss(p: WalletScoreParams): number {
  if (p.tradeHistory.length < 3) return 0;
  const pnl = p.tradeHistory.map((t) => t.usd_value);
  const avg = pnl.reduce((a, b) => a + b, 0) / pnl.length;
  const std = Math.sqrt(pnl.reduce((s, v) => s + (v - avg) ** 2, 0) / pnl.length);
  return Math.max(0, Math.min(100, 50 + (avg / (std || 1)) * 20));
}

function scoreLiquidityGhost(p: WalletScoreParams): number {
  const liqImpact = p.liquidityEvents.filter((e) => e.event_type === 'remove').length;
  const total = p.liquidityEvents.length || 1;
  return Math.max(0, 100 - (liqImpact / total) * 200);
}

function scoreConviction(p: WalletScoreParams): number {
  const holds = p.tradeHistory.filter((t) => t.amount_out > 0 && t.amount_in > 0).length;
  const total = p.tradeHistory.length || 1;
  return Math.min(100, (holds / total) * 80 + 20);
}

function scoreCtoMeta(_p: WalletScoreParams): number {
  return 50;
}

function scoreConsensusDeviation(_p: WalletScoreParams): number {
  return 50;
}

function buildRationale(layers: LayerScores, tier: WalletTier): string {
  const top = Object.entries(layers).sort((a, b) => b[1] - a[1])[0];
  return `Tier ${tier}: strongest signal from ${top[0]} (${Math.round(top[1])})`;
}
