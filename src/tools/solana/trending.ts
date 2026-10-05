import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getTrendingTokens as getBirdeyeTrending } from '../../providers/birdeye';
import { getTrendingTokens as getGmgnTrending } from '../../providers/gmgn';
import { featureState } from '../../soldextra/registry';

export const getTrendingTokensTool = new DynamicStructuredTool({
  name: 'get_trending_tokens',
  description:
    'Trending Solana tokens. Prefers GMGN OpenAPI when GMGN_API_KEY is set, then Birdeye when that feature is active. ' +
    'Does not invent prices for a source that is off.',
  schema: z.object({
    timeframe: z.enum(['1h', '4h', '24h']).optional().default('24h'),
    min_liquidity: z.number().optional().default(10000).describe('Minimum liquidity in USD'),
  }),
  func: async ({ timeframe, min_liquidity }) => {
    const notes: string[] = [];
    const gmgn = featureState('gmgn_query');
    if (gmgn.active) {
      try {
        const interval = timeframe === '4h' ? '1h' : timeframe;
        const tokens = await getGmgnTrending(interval, 'volume', [], 20);
        const filtered = tokens.filter((token) => token.liquidity == null || token.liquidity >= min_liquidity);
        if (filtered.length) return JSON.stringify({ source: 'gmgn', tokens: filtered }, null, 2);
        notes.push('GMGN rank returned no rows');
      } catch (error) {
        notes.push(`GMGN trending unverifiable (${error instanceof Error ? error.message : String(error)})`);
      }
    } else {
      notes.push(`GMGN trending unverifiable (${gmgn.unavailableReason})`);
    }

    const birdeye = featureState('birdeye');
    if (birdeye.active) {
      try {
        const tokens = await getBirdeyeTrending(timeframe, min_liquidity, 20);
        if (tokens.length) return JSON.stringify({ source: 'birdeye', tokens }, null, 2);
        notes.push('Birdeye trending returned no rows');
      } catch (error) {
        notes.push(`Birdeye trending unverifiable (${error instanceof Error ? error.message : String(error)})`);
      }
    } else {
      notes.push(`Birdeye trending unverifiable (${birdeye.unavailableReason})`);
    }

    return notes.join('; ');
  },
});
