/**
 * Token risk auditor.
 *
 * Funding-graph bundler detection is rebuilt from the measured pattern
 * (shared funder within two hops, same-slot buys, identical priority fees,
 * Jito tips). It does not copy unlicensed detector code.
 *
 * Loud flags are for drainers, honeypots, and fake-airdrop bait, including
 * the CypherAid / "ALREADY CLAIMED" name pattern from the 2026-10-03 listener.
 */

import { PUMP_MAYHEM_AGENT, TOKEN_PROGRAM_IDS } from './programs.js';

/** pump.fun Mayhem inventory is protocol-owned and is not a holder. */
export function isProtocolHolder(address: string): boolean {
  return address === PUMP_MAYHEM_AGENT;
}

export const RISK_THRESHOLDS = {
  concentratedTop10Pct: 50,
  creatorHeavyPct: 40,
  freshDevSignatures: 5,
  serialLauncherCount: 10,
  honeypotTransferFeePct: 50,
  bundlerMinWallets: 3,
  bundlerMaxHops: 2,
  clusterWalletCount: 5,
} as const;

const CLAIM_BAIT = /already claimed|airdrop|\bclaim\b|\breward\b|connect wallet/i;
const CYPHER_AID = /^cypheraid$/i;

export type RiskSeverity = 'HIGH' | 'MED' | 'LOW' | 'UNKNOWN';

export interface Token2022Flags {
  transfer_hook?: boolean;
  permanent_delegate?: boolean;
  transfer_fee_pct?: number | null;
  default_frozen?: boolean;
  non_transferable?: boolean;
  pausable?: boolean;
}

export interface FundingEdge {
  wallet: string;
  funder: string;
  hops: number;
  mint?: string;
  same_slot_as_peers?: boolean;
  priority_fee_lamports?: number | null;
  jito_tip_lamports?: number | null;
}

export interface SuspiciousInstruction {
  program: string;
  name: string;
}

export interface RiskAuditInput {
  mint: string;
  as_of_utc: string;
  name?: string | null;
  symbol?: string | null;
  uri?: string | null;
  /** undefined = the check did not run. null = measured absent. */
  mint_authority?: string | null;
  freeze_authority?: string | null;
  token2022?: Token2022Flags | null;
  top10_pct_ex_pool?: number | null;
  creator_pct?: number | null;
  /** Holders left out of concentration (pool vaults, mayhem agent). */
  excluded_holder?: string | null;
  lp_locked_pct?: number | null;
  lp_held_by_creator?: boolean | null;
  creator?: string | null;
  creator_signature_count?: number | null;
  creator_launch_count?: number | null;
  /** false = a read-only sell quote found no route. */
  sell_route_available?: boolean | null;
  funding_edges?: FundingEdge[] | null;
  suspicious_instructions?: SuspiciousInstruction[] | null;
  sources: { check: string; source: string; as_of_utc: string }[];
}

export interface RiskFlag {
  code: string;
  detail: string;
  source: string;
  as_of_utc: string;
  loud: boolean;
}

export interface RiskReport {
  mint: string;
  severity: RiskSeverity;
  loud: string[];
  flags: RiskFlag[];
  unverifiable: { check: string; reason: string }[];
  as_of_utc: string;
}

function sourceFor(input: RiskAuditInput, check: string): { source: string; as_of_utc: string } {
  const found = input.sources.find((row) => row.check === check);
  return {
    source: found?.source ?? 'not recorded',
    as_of_utc: found?.as_of_utc ?? input.as_of_utc,
  };
}

/**
 * Shared funder within two hops, plus either a same-slot buy group or an
 * identical priority fee. A Jito tip on a same-slot group of at least two
 * wallets is the same pattern.
 */
export function detectFundingBundler(edges: FundingEdge[]): { detected: boolean; detail: string } {
  const groups = new Map<string, FundingEdge[]>();
  for (const edge of edges) {
    if (edge.hops > RISK_THRESHOLDS.bundlerMaxHops) continue;
    const key = `${edge.funder}|${edge.mint ?? ''}`;
    const list = groups.get(key) ?? [];
    list.push(edge);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    const wallets = new Set(group.map((edge) => edge.wallet));
    if (wallets.size < RISK_THRESHOLDS.bundlerMinWallets) continue;
    const fees = group
      .map((edge) => edge.priority_fee_lamports)
      .filter((fee): fee is number => typeof fee === 'number');
    const identicalFee = fees.length >= RISK_THRESHOLDS.bundlerMinWallets && new Set(fees).size === 1;
    const sameSlot = group.filter((edge) => edge.same_slot_as_peers).length >= RISK_THRESHOLDS.bundlerMinWallets;
    if (identicalFee || sameSlot) {
      return {
        detected: true,
        detail: `${wallets.size} wallets funded by ${group[0].funder} within ${RISK_THRESHOLDS.bundlerMaxHops} hops`,
      };
    }
  }

  const jitoGroups = new Map<string, FundingEdge[]>();
  for (const edge of edges) {
    if (!edge.jito_tip_lamports || edge.jito_tip_lamports <= 0 || !edge.same_slot_as_peers) continue;
    const key = edge.mint ?? edge.funder;
    const list = jitoGroups.get(key) ?? [];
    list.push(edge);
    jitoGroups.set(key, list);
  }
  for (const group of jitoGroups.values()) {
    const wallets = new Set(group.map((edge) => edge.wallet));
    if (wallets.size >= 2) {
      return {
        detected: true,
        detail: `${wallets.size} same-slot buyers paid a Jito tip`,
      };
    }
  }

  return { detected: false, detail: 'no shared-funder or Jito bundle in the supplied edges' };
}

function textBlob(input: RiskAuditInput): string {
  return [input.name, input.symbol, input.uri].filter((part) => part && part.length > 0).join(' ');
}

export function auditTokenRisk(input: RiskAuditInput): RiskReport {
  const flags: RiskFlag[] = [];
  const unverifiable: { check: string; reason: string }[] = [];
  const loud: string[] = [];

  const push = (check: string, code: string, detail: string, isLoud: boolean) => {
    const src = sourceFor(input, check);
    flags.push({ code, detail, source: src.source, as_of_utc: src.as_of_utc, loud: isLoud });
    if (isLoud) loud.push(detail);
  };

  if (input.mint_authority === undefined) {
    unverifiable.push({ check: 'mint_authority', reason: 'mint account was not read' });
  } else if (input.mint_authority) {
    push('mint_authority', 'MINT_AUTHORITY_SET', `mint authority is live (${input.mint_authority})`, false);
  }

  if (input.freeze_authority === undefined) {
    unverifiable.push({ check: 'freeze_authority', reason: 'mint account was not read' });
  } else if (input.freeze_authority) {
    push(
      'freeze_authority',
      'FREEZE_AUTHORITY_SET',
      'HONEYPOT risk: freeze authority is set, so holders can be frozen and sells blocked. Do not buy.',
      true,
    );
  }

  if (input.token2022 === undefined || input.token2022 === null) {
    unverifiable.push({ check: 'token2022', reason: 'Token-2022 extensions were not read' });
  } else {
    const ext = input.token2022;
    if (ext.permanent_delegate) {
      push('token2022', 'PERMANENT_DELEGATE', 'HONEYPOT risk: Token-2022 permanent delegate can move holder tokens', true);
    }
    if (ext.transfer_hook) push('token2022', 'TRANSFER_HOOK', 'Token-2022 transfer hook is set', false);
    if (ext.default_frozen) {
      push('token2022', 'DEFAULT_FROZEN', 'HONEYPOT risk: Token-2022 default account state is frozen', true);
    }
    if (ext.non_transferable) {
      push('token2022', 'NON_TRANSFERABLE', 'HONEYPOT risk: token is non-transferable', true);
    }
    if (typeof ext.transfer_fee_pct === 'number' && ext.transfer_fee_pct > 0) {
      const honeypotFee = ext.transfer_fee_pct >= RISK_THRESHOLDS.honeypotTransferFeePct;
      push(
        'token2022',
        'TRANSFER_FEE',
        honeypotFee
          ? `HONEYPOT risk: transfer fee is ${ext.transfer_fee_pct}%`
          : `Token-2022 transfer fee is ${ext.transfer_fee_pct}%`,
        honeypotFee,
      );
    }
    if (ext.pausable) push('token2022', 'PAUSABLE', 'Token-2022 pausable extension is set', false);
  }

  if (input.sell_route_available === undefined || input.sell_route_available === null) {
    unverifiable.push({ check: 'sell_route', reason: 'no read-only sell quote was requested' });
  } else if (input.sell_route_available === false) {
    push('sell_route', 'NO_SELL_ROUTE', 'HONEYPOT risk: a read-only sell quote found no route', true);
  }

  if (input.top10_pct_ex_pool === undefined || input.top10_pct_ex_pool === null) {
    unverifiable.push({
      check: 'holders',
      reason: 'holder concentration was not measured (public RPC disables getTokenLargestAccounts)',
    });
  } else if (input.top10_pct_ex_pool >= RISK_THRESHOLDS.concentratedTop10Pct) {
    push('holders', 'CONCENTRATED', `top-10 holders excluding pools hold ${input.top10_pct_ex_pool}%`, false);
  }

  if (input.creator_pct === undefined || input.creator_pct === null) {
    unverifiable.push({ check: 'creator_balance', reason: 'creator holding share was not measured' });
  } else if (input.creator_pct >= RISK_THRESHOLDS.creatorHeavyPct) {
    push('creator_balance', 'CREATOR_HEAVY', `creator holds ${input.creator_pct}% of supply`, false);
  }

  if (input.lp_locked_pct === undefined || input.lp_locked_pct === null) {
    unverifiable.push({
      check: 'lp',
      reason: 'LP lock or burn was not measured (at creation the LP is new; re-check later)',
    });
  } else if (input.lp_locked_pct === 0) {
    push('lp', 'LP_UNLOCKED', 'LP locked percent is 0', false);
  }

  if (input.lp_held_by_creator === undefined || input.lp_held_by_creator === null) {
    unverifiable.push({ check: 'lp_owner', reason: 'LP owner was not measured' });
  } else if (input.lp_held_by_creator) {
    push('lp_owner', 'LP_HELD_BY_CREATOR', 'LP tokens are in the creator wallet', false);
  }

  if (input.creator_signature_count === undefined || input.creator_signature_count === null) {
    unverifiable.push({ check: 'dev_history', reason: 'creator signature count was not measured' });
  } else if (input.creator_signature_count <= RISK_THRESHOLDS.freshDevSignatures) {
    push('dev_history', 'FRESH_DEV_WALLET', `creator wallet has ${input.creator_signature_count} signatures`, false);
  }

  if (input.creator_launch_count === undefined || input.creator_launch_count === null) {
    unverifiable.push({ check: 'dev_launches', reason: 'creator launch count was not measured' });
  } else if (input.creator_launch_count >= RISK_THRESHOLDS.serialLauncherCount) {
    push('dev_launches', 'SERIAL_LAUNCHER', `creator launched ${input.creator_launch_count} tokens in the observed set`, false);
  }

  if (input.funding_edges === undefined || input.funding_edges === null) {
    unverifiable.push({ check: 'funding_graph', reason: 'funding graph was not traversed' });
  } else {
    const bundler = detectFundingBundler(input.funding_edges);
    const src = sourceFor(input, 'funding_graph');
    if (bundler.detected) {
      flags.push({
        code: 'BUNDLER',
        detail: bundler.detail,
        source: src.source,
        as_of_utc: src.as_of_utc,
        loud: false,
      });
    }
    const cluster = new Set(
      input.funding_edges.filter((edge) => edge.same_slot_as_peers).map((edge) => edge.wallet),
    );
    if (cluster.size > RISK_THRESHOLDS.clusterWalletCount) {
      flags.push({
        code: 'WALLET_CLUSTER',
        detail: `${cluster.size} wallets bought in the same slot`,
        source: src.source,
        as_of_utc: src.as_of_utc,
        loud: false,
      });
    }
  }

  if (input.suspicious_instructions === undefined || input.suspicious_instructions === null) {
    unverifiable.push({ check: 'drainer_ix', reason: 'instructions were not scanned for SetAuthority or Approve' });
  } else {
    const drainer = input.suspicious_instructions.filter((ix) => {
      const name = ix.name.toLowerCase();
      const dangerous = name === 'setauthority' || name === 'approve';
      return dangerous && !TOKEN_PROGRAM_IDS.has(ix.program);
    });
    if (drainer.length > 0) {
      push(
        'drainer_ix',
        'DRAINER',
        `DRAINER: ${drainer.map((ix) => `${ix.name} via ${ix.program}`).join(', ')}. Do not sign, connect, or visit a claim site.`,
        true,
      );
    }
  }

  const blob = textBlob(input);
  const symbol = input.symbol ?? '';
  if (CYPHER_AID.test(symbol.trim()) || CLAIM_BAIT.test(blob)) {
    push(
      'metadata',
      'FAKE_AIRDROP',
      'FAKE-AIRDROP / claim bait (CypherAid or claim/airdrop wording). Do not visit, connect a wallet, or sign. This is a name-pattern match, not proof of a specific drainer contract.',
      true,
    );
  } else if (input.name === undefined && input.symbol === undefined && input.uri === undefined) {
    unverifiable.push({ check: 'metadata', reason: 'token name, symbol, and uri were not read' });
  }

  const criticalMissing = unverifiable.some((row) => row.check === 'mint_authority' || row.check === 'freeze_authority');
  let severity: RiskSeverity = 'LOW';
  if (loud.length > 0 || (input.creator_pct != null && input.creator_pct >= 50) || (input.mint_authority && input.freeze_authority)) {
    severity = 'HIGH';
  } else if (flags.length > 0) {
    severity = 'MED';
  } else if (criticalMissing) {
    severity = 'UNKNOWN';
  }

  return { mint: input.mint, severity, loud, flags, unverifiable, as_of_utc: input.as_of_utc };
}

export function formatRiskReport(report: RiskReport): string {
  const lines = [
    `MINT: ${report.mint}`,
    `SEVERITY: ${report.severity}`,
    `LOUD: ${report.loud.length ? report.loud.join(' | ') : 'none'}`,
    `FLAGS: ${report.flags.length
      ? report.flags.map((flag) => `${flag.code}: ${flag.detail} (source: ${flag.source}, as_of_utc: ${flag.as_of_utc})`).join('; ')
      : 'none'}`,
    `UNVERIFIABLE: ${report.unverifiable.length
      ? report.unverifiable.map((row) => `${row.check} (${row.reason})`).join('; ')
      : 'none'}`,
    `AS_OF_UTC: ${report.as_of_utc}`,
  ];
  return lines.join('\n');
}
