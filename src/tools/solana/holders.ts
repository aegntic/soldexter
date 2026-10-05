import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getTokenHolders as fetchHolders } from '../../providers/helius';
import { featureState } from '../../soldextra/registry';
import { getGmgnClient } from '../../providers/gmgn';

export const getTokenHoldersTool = new DynamicStructuredTool({
  name: 'get_token_holders',
  description:
    'Top holders of a Solana token. Uses Helius when that feature is active, otherwise GMGN OpenAPI top holders. ' +
    'The public RPC disables getTokenLargestAccounts, so that path is reported as unverifiable instead of a fake distribution.',
  schema: z.object({
    mint: z.string().describe('Token mint address'),
    top: z.number().optional().default(20).describe('Number of top holders'),
  }),
  func: async ({ mint, top }) => {
    const helius = featureState('helius');
    if (helius.active) {
      try {
        const holders = await fetchHolders(mint, top);
        return JSON.stringify({ source: 'helius', total_returned: holders.length, holders }, null, 2);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `Error fetching token holders from Helius: ${message}`;
      }
    }

    const gmgn = featureState('gmgn_query');
    if (!gmgn.active) {
      return `unverifiable (holder concentration: ${helius.unavailableReason}; ${gmgn.unavailableReason}; public RPC disables getTokenLargestAccounts)`;
    }
    try {
      const data = await getGmgnClient().get('/v1/market/token_top_holders', { chain: 'sol', address: mint, limit: top });
      return JSON.stringify({ source: 'GET https://openapi.gmgn.ai/v1/market/token_top_holders', holders: data }, null, 2);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `unverifiable (holder concentration: ${message})`;
    }
  },
});