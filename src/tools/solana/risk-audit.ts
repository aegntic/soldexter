import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { auditTokenRisk, formatRiskReport, isProtocolHolder, type RiskAuditInput } from '../../intel/risk-auditor.js';
import { utcNow, isMeasured } from '../../intel/sourced.js';
import { featureState } from '../../soldextra/registry.js';
import { getMintAccount, getRugCheckSummary } from '../../providers/free-market.js';
import { getTokenSecurity } from '../../providers/gmgn.js';

export async function collectRiskInput(mint: string, hints?: { name?: string; symbol?: string; uri?: string }): Promise<RiskAuditInput> {
  const asOf = utcNow();
  const input: RiskAuditInput = {
    mint,
    as_of_utc: asOf,
    name: hints?.name,
    symbol: hints?.symbol,
    uri: hints?.uri,
    sources: [],
  };

  const mintAccount = await getMintAccount(mint);
  if (isMeasured(mintAccount)) {
    input.mint_authority = mintAccount.value.mint_authority;
    input.freeze_authority = mintAccount.value.freeze_authority;
    input.sources.push({ check: 'mint_authority', source: mintAccount.source, as_of_utc: mintAccount.as_of_utc });
    input.sources.push({ check: 'freeze_authority', source: mintAccount.source, as_of_utc: mintAccount.as_of_utc });
    const extensions = mintAccount.value.extensions;
    input.token2022 = {
      transfer_hook: extensions.includes('transferHook'),
      permanent_delegate: extensions.includes('permanentDelegate'),
      default_frozen: extensions.includes('defaultAccountState'),
      non_transferable: extensions.includes('nonTransferable'),
      pausable: extensions.includes('pausable'),
    };
    input.sources.push({ check: 'token2022', source: mintAccount.source, as_of_utc: mintAccount.as_of_utc });
  }

  if (featureState('rugcheck').active) {
    const rug = await getRugCheckSummary(mint);
    if (isMeasured(rug.lp_locked_pct)) {
      input.lp_locked_pct = rug.lp_locked_pct.value;
      input.sources.push({ check: 'lp', source: rug.lp_locked_pct.source, as_of_utc: rug.lp_locked_pct.as_of_utc });
    }
  }

  if (featureState('gmgn_query').active) {
    try {
      const security = await getTokenSecurity(mint);
      if (security.is_honeypot === true && input.freeze_authority == null) {
        input.sell_route_available = false;
        input.sources.push({
          check: 'sell_route',
          source: 'GET https://openapi.gmgn.ai/v1/token/security is_honeypot',
          as_of_utc: asOf,
        });
      }
      input.sources.push({ check: 'gmgn_security', source: 'GET https://openapi.gmgn.ai/v1/token/security', as_of_utc: asOf });
    } catch {
      // Security fields stay unverifiable. The mint-account checks still stand.
    }
  }

  return input;
}

export const auditTokenRiskTool = new DynamicStructuredTool({
  name: 'audit_token_risk',
  description:
    'Risk-audit a Solana mint: mint and freeze authority, Token-2022 extensions, LP status, holder and creator concentration when measured, ' +
    'funding-graph bundler clues, and loud flags for drainers, honeypots, and fake-airdrop bait (including CypherAid / ALREADY CLAIMED). ' +
    'Unmeasured checks stay unverifiable. Does not connect a wallet or sign.',
  schema: z.object({
    mint: z.string().describe('Token mint address'),
    name: z.string().optional().describe('Token name if already known'),
    symbol: z.string().optional().describe('Token symbol if already known'),
    uri: z.string().optional().describe('Metadata URI if already known'),
  }),
  func: async ({ mint, name, symbol, uri }) => {
    const input = await collectRiskInput(mint, { name, symbol, uri });
    if (input.creator && isProtocolHolder(input.creator)) {
      input.creator_pct = null;
    }
    return formatRiskReport(auditTokenRisk(input));
  },
});
