import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { getTokenInfo as fetchTokenInfo } from '../../providers/helius';
import { getMintAccount } from '../../providers/free-market';
import { featureState } from '../../soldextra/registry';
import { isMeasured } from '../../intel/sourced';

export const getTokenInfoTool = new DynamicStructuredTool({
  name: 'get_token_info',
  description:
    'Token mint account: supply, decimals, mint authority, freeze authority, Token-2022 extension names. ' +
    'Uses Helius when that feature is active, otherwise the public RPC. Unmeasured fields stay unverifiable.',
  schema: z.object({
    mint: z.string().describe('Solana token mint address (base58)'),
  }),
  func: async ({ mint }) => {
    const helius = featureState('helius');
    if (helius.active) {
      try {
        const info = await fetchTokenInfo(mint);
        const flags: string[] = [];
        if (info.pump_fun_flag) flags.push('PUMP.FUN TOKEN');
        if (info.freeze_authority) flags.push('FREEZE AUTHORITY ACTIVE');
        if (info.is_mutable) flags.push('METADATA MUTABLE');
        return JSON.stringify({ ...info, risk_flags: flags.length ? flags : undefined, source: 'helius' }, null, 2);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const fallback = await getMintAccount(mint);
        if (isMeasured(fallback)) {
          return JSON.stringify({
            ...fallback.value,
            source: fallback.source,
            as_of_utc: fallback.as_of_utc,
            helius_error: message,
            holder_count: 'unverifiable (not in the mint account)',
          }, null, 2);
        }
        return `Error fetching token info: ${message}; ${fallback.reason}`;
      }
    }

    const account = await getMintAccount(mint);
    if (!isMeasured(account)) {
      return `Error fetching token info: ${helius.unavailableReason}; ${account.reason}`;
    }
    return JSON.stringify({
      ...account.value,
      source: account.source,
      as_of_utc: account.as_of_utc,
      holder_count: 'unverifiable (public RPC getTokenLargestAccounts is disabled)',
      helius: `unverifiable (${helius.unavailableReason})`,
    }, null, 2);
  },
});
