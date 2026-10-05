/**
 * Soldextra registry — the one place a feature moves between core and soldextra.
 *
 * Default rule (not a pricing table): a feature that cannot run without a paid
 * key starts as soldextra. Everything else starts as core, including no-key
 * public sources and sources that accept a free key. Set `tier` on a row to
 * flip that feature. Do not encode prices here; the split is expected to move.
 */

export type FeatureTier = 'core' | 'soldextra';

export interface FeatureDef {
  /** Stable id. Call sites use this, not a scattered boolean. */
  id: string;
  description: string;
  /** Env var when the feature needs a key. Omit for keyless sources. */
  keyEnv?: string;
  /**
   * True only when the feature cannot be used without a paid key.
   * Drives the default tier. A free signup key is not a paid key.
   */
  requiresPaidKey: boolean;
  /** Explicit flip. When set, this wins over `requiresPaidKey`. */
  tier?: FeatureTier;
}

export const SOLDEXTRA_REGISTRY = [
  {
    id: 'public_rpc',
    description: 'Solana public RPC (api.mainnet-beta.solana.com)',
    requiresPaidKey: false,
  },
  {
    id: 'dexscreener',
    description: 'DexScreener public API',
    requiresPaidKey: false,
  },
  {
    id: 'geckoterminal',
    description: 'GeckoTerminal public API',
    requiresPaidKey: false,
  },
  {
    id: 'rugcheck',
    description: 'RugCheck public summary API',
    requiresPaidKey: false,
  },
  {
    id: 'jupiter_price',
    description: 'Jupiter price API. Quotes and prices only; no swap submission.',
    requiresPaidKey: false,
  },
  {
    id: 'gmgn_query',
    description: 'GMGN OpenAPI read-only queries (token, market, portfolio stats, kol, smartmoney). Free key.',
    keyEnv: 'GMGN_API_KEY',
    requiresPaidKey: false,
  },
  {
    id: 'helius',
    description: 'Helius RPC and DAS on a free key. Optional speed path. Absent key falls back to public RPC.',
    keyEnv: 'HELIUS_API_KEY',
    requiresPaidKey: false,
  },
  {
    id: 'birdeye',
    description: 'Birdeye market data. A free key exists, so the default tier is core. Flip tier to move it.',
    keyEnv: 'BIRDEYE_API_KEY',
    requiresPaidKey: false,
  },
  {
    id: 'solscan_pro',
    description: 'Solscan Pro API. No free tier.',
    keyEnv: 'SOLSCAN_API_KEY',
    requiresPaidKey: true,
  },
  {
    id: 'x_api',
    description: 'X API post and user reads. Pay-per-use.',
    keyEnv: 'X_BEARER_TOKEN',
    requiresPaidKey: true,
  },
  {
    id: 'helius_paid',
    description: 'Helius calls that require a paid plan. Free-plan RPC stays on the helius feature.',
    keyEnv: 'HELIUS_API_KEY',
    requiresPaidKey: true,
  },
] as const satisfies readonly FeatureDef[];

export type FeatureId = (typeof SOLDEXTRA_REGISTRY)[number]['id'];

const BY_ID: Record<FeatureId, FeatureDef> = Object.fromEntries(
  SOLDEXTRA_REGISTRY.map((feature) => [feature.id, feature]),
) as Record<FeatureId, FeatureDef>;

export function listFeatures(): typeof SOLDEXTRA_REGISTRY {
  return SOLDEXTRA_REGISTRY;
}

export function getFeature(id: FeatureId): FeatureDef {
  return BY_ID[id];
}

export function defaultTier(feature: Pick<FeatureDef, 'requiresPaidKey' | 'tier'>): FeatureTier {
  if (feature.tier === 'core' || feature.tier === 'soldextra') return feature.tier;
  return feature.requiresPaidKey ? 'soldextra' : 'core';
}

export function featureTier(id: FeatureId): FeatureTier {
  return defaultTier(getFeature(id));
}

function keyPresent(env: NodeJS.ProcessEnv, keyEnv: string | undefined): boolean {
  if (!keyEnv) return true;
  const value = env[keyEnv];
  return Boolean(value && value.trim() && !value.trim().startsWith('your-'));
}

export function soldextraEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.SOLDEXTRA_ENABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export interface FeatureState {
  id: FeatureId;
  tier: FeatureTier;
  active: boolean;
  /** Set when the feature cannot be called. Safe to show to the user. */
  unavailableReason: string | null;
}

/**
 * A core feature is active when its key (if any) is present.
 * A soldextra feature stays off unless SOLDEXTRA_ENABLED is set and its key is present.
 * Missing data is reported as unverifiable; callers must not fill the field.
 */
export function featureState(id: FeatureId, env: NodeJS.ProcessEnv = process.env): FeatureState {
  const feature = getFeature(id);
  const tier = defaultTier(feature);
  const hasKey = keyPresent(env, feature.keyEnv);

  if (tier === 'soldextra' && !soldextraEnabled(env)) {
    const keyName = feature.keyEnv ?? 'a paid key';
    return {
      id,
      tier,
      active: false,
      unavailableReason: `soldextra feature '${id}' is off (set SOLDEXTRA_ENABLED and ${keyName} to measure this)`,
    };
  }

  if (!hasKey) {
    return {
      id,
      tier,
      active: false,
      unavailableReason: feature.keyEnv
        ? `${feature.keyEnv} is not set`
        : `feature '${id}' is unavailable`,
    };
  }

  return { id, tier, active: true, unavailableReason: null };
}

export function unverifiableReason(id: FeatureId, env: NodeJS.ProcessEnv = process.env): string | null {
  return featureState(id, env).unavailableReason;
}
