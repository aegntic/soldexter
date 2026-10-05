import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getDexData as fetchBirdeye } from '../../providers/birdeye';
import { getDexScreenerMarket, getJupiterPrice } from '../../providers/free-market';
import { featureState } from '../../soldextra/registry';
import { isMeasured } from '../../intel/sourced';

export const getDexDataTool = new DynamicStructuredTool({
  name: 'get_dex_data',
  description:
    'DEX price, liquidity, and market cap. Uses DexScreener and Jupiter price with no key. ' +
    'Birdeye is included only when that feature is active. Missing fields stay unverifiable.',
  schema: z.object({
    mint: z.string().describe('Token mint address'),
  }),
  func: async ({ mint }) => {
    const dex = await getDexScreenerMarket(mint);
    const jupiter = await getJupiterPrice(mint);
    const birdeyeState = featureState('birdeye');
    let birdeye: unknown = birdeyeState.active ? null : `unverifiable (${birdeyeState.unavailableReason})`;
    if (birdeyeState.active) {
      try {
        birdeye = await fetchBirdeye(mint);
      } catch (error) {
        birdeye = `unverifiable (${error instanceof Error ? error.message : String(error)})`;
      }
    }
    return JSON.stringify({
      mint,
      price_usd: isMeasured(jupiter) ? jupiter : dex.price_usd,
      dexscreener: dex,
      birdeye,
    }, null, 2);
  },
});
