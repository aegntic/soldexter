import { describe, expect, test } from 'bun:test';
import { featureState, featureTier, listFeatures, soldextraEnabled } from './registry.js';

describe('soldextra registry', () => {
  test('defaults paid-key features to soldextra and the rest to core', () => {
    for (const feature of listFeatures()) {
      const tier = featureTier(feature.id);
      expect(tier).toBe(feature.requiresPaidKey ? 'soldextra' : 'core');
    }
    expect(featureTier('gmgn_query')).toBe('core');
    expect(featureTier('public_rpc')).toBe('core');
    expect(featureTier('x_api')).toBe('soldextra');
    expect(featureTier('solscan_pro')).toBe('soldextra');
    expect(featureTier('helius_paid')).toBe('soldextra');
  });

  test('keeps soldextra off unless the flag and key are both set', () => {
    expect(soldextraEnabled({})).toBe(false);
    expect(featureState('x_api', { X_BEARER_TOKEN: 'paid' }).active).toBe(false);
    expect(featureState('x_api', { X_BEARER_TOKEN: 'paid', SOLDEXTRA_ENABLED: 'true' }).active).toBe(true);
    expect(featureState('x_api', { SOLDEXTRA_ENABLED: 'true' }).active).toBe(false);
    expect(featureState('gmgn_query', {}).unavailableReason).toContain('GMGN_API_KEY');
    expect(featureState('gmgn_query', { GMGN_API_KEY: 'free' }).active).toBe(true);
    expect(featureState('dexscreener', {}).active).toBe(true);
  });
});
