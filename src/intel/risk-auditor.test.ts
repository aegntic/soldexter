import { describe, expect, test } from 'bun:test';
import { auditTokenRisk, detectFundingBundler, formatRiskReport, isProtocolHolder } from './risk-auditor.js';
import { PUMP_MAYHEM_AGENT } from './programs.js';

const AS_OF = '2026-10-03T03:33:07Z';

describe('auditTokenRisk', () => {
  test('flags the listener honeypot: freeze authority, mint authority, and creator-held LP', () => {
    const report = auditTokenRisk({
      mint: '3cai3HeS9zSJbzgMkKfcqx5a7uwpzNeLnXrB65dZQk9T',
      as_of_utc: AS_OF,
      name: 'Example',
      symbol: 'EX',
      uri: 'https://example.invalid/meta.json',
      mint_authority: 'mint-auth',
      freeze_authority: 'freeze-auth',
      token2022: { transfer_fee_pct: 0 },
      top10_pct_ex_pool: 20,
      creator_pct: 4,
      lp_locked_pct: 0,
      lp_held_by_creator: true,
      creator_signature_count: 40,
      creator_launch_count: 1,
      sell_route_available: true,
      funding_edges: [],
      suspicious_instructions: [],
      sources: [
        { check: 'freeze_authority', source: 'public RPC getAccountInfo', as_of_utc: AS_OF },
        { check: 'mint_authority', source: 'public RPC getAccountInfo', as_of_utc: AS_OF },
        { check: 'lp_owner', source: 'public RPC', as_of_utc: AS_OF },
      ],
    });
    expect(report.severity).toBe('HIGH');
    expect(report.loud.join(' ')).toContain('HONEYPOT');
    expect(report.flags.map((flag) => flag.code)).toEqual(expect.arrayContaining([
      'MINT_AUTHORITY_SET',
      'FREEZE_AUTHORITY_SET',
      'LP_HELD_BY_CREATOR',
      'LP_UNLOCKED',
    ]));
    expect(formatRiskReport(report)).toContain('Do not buy');
  });

  test('loud-flags the CypherAid / ALREADY CLAIMED bait pattern', () => {
    const report = auditTokenRisk({
      mint: 'HiehpK6UM7wEcUNwK9PTseHGDq9rQwuEGMPA7AUCTVTz',
      as_of_utc: '2026-10-03T03:31:43Z',
      name: 'ALREADY CLAIMED CHECK WEB',
      symbol: 'CypherAid',
      uri: 'https://claim.example',
      mint_authority: null,
      freeze_authority: null,
      token2022: {},
      funding_edges: [],
      suspicious_instructions: [],
      sources: [{ check: 'metadata', source: 'pump CreateEvent', as_of_utc: '2026-10-03T03:31:43Z' }],
    });
    expect(report.severity).toBe('HIGH');
    expect(report.flags.map((flag) => flag.code)).toContain('FAKE_AIRDROP');
    expect(formatRiskReport(report)).toContain('Do not visit');
  });

  test('flags a non-allowlisted SetAuthority as a drainer', () => {
    const report = auditTokenRisk({
      mint: 'mint',
      as_of_utc: AS_OF,
      name: 'Normal',
      symbol: 'NORM',
      uri: 'ipfs://ok',
      mint_authority: null,
      freeze_authority: null,
      suspicious_instructions: [{ program: 'Drain1111111111111111111111111111111111111', name: 'SetAuthority' }],
      sources: [{ check: 'drainer_ix', source: 'parsed tx', as_of_utc: AS_OF }],
    });
    expect(report.flags.map((flag) => flag.code)).toContain('DRAINER');
    expect(report.loud[0]).toContain('DRAINER');
  });

  test('does not treat an unmeasured check as clean', () => {
    const report = auditTokenRisk({
      mint: 'mint',
      as_of_utc: AS_OF,
      sources: [],
    });
    expect(report.severity).toBe('UNKNOWN');
    expect(report.flags).toHaveLength(0);
    expect(report.unverifiable.map((row) => row.check)).toContain('freeze_authority');
    expect(report.unverifiable.map((row) => row.check)).toContain('funding_graph');
  });
});

describe('detectFundingBundler', () => {
  test('detects a shared funder with identical priority fees', () => {
    const result = detectFundingBundler([
      { wallet: 'a', funder: 'dev', hops: 1, mint: 'm', priority_fee_lamports: 300000 },
      { wallet: 'b', funder: 'dev', hops: 1, mint: 'm', priority_fee_lamports: 300000 },
      { wallet: 'c', funder: 'dev', hops: 2, mint: 'm', priority_fee_lamports: 300000 },
    ]);
    expect(result.detected).toBe(true);
    expect(result.detail).toContain('dev');
  });

  test('detects a same-slot Jito tip group', () => {
    const result = detectFundingBundler([
      { wallet: 'a', funder: 'x', hops: 4, mint: 'm', same_slot_as_peers: true, jito_tip_lamports: 10000 },
      { wallet: 'b', funder: 'y', hops: 4, mint: 'm', same_slot_as_peers: true, jito_tip_lamports: 10000 },
    ]);
    expect(result.detected).toBe(true);
    expect(result.detail).toContain('Jito');
  });

  test('leaves a clean graph unmarked', () => {
    expect(detectFundingBundler([
      { wallet: 'a', funder: 'x', hops: 1, mint: 'm', priority_fee_lamports: 1 },
    ]).detected).toBe(false);
  });
});

describe('isProtocolHolder', () => {
  test('recognises the pump mayhem agent wallet', () => {
    expect(isProtocolHolder(PUMP_MAYHEM_AGENT)).toBe(true);
    expect(isProtocolHolder('not-the-agent')).toBe(false);
  });
});
