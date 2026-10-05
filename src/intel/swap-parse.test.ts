import { describe, expect, test } from 'bun:test';
import { parseSwap } from './swap-parse.js';
import { PROGRAMS } from './programs.js';

const WALLET = 'Wallet111111111111111111111111111111111111111';

describe('parseSwap', () => {
  test('reads a signer buy on the corrected Meteora DLMM program', () => {
    const swap = parseSwap({
      slot: 452812875,
      blockTime: 1790996441,
      transaction: {
        signatures: ['sig1'],
        message: {
          accountKeys: [{ pubkey: WALLET, signer: true }, { pubkey: 'other', signer: false }],
          instructions: [{ programId: PROGRAMS.meteoraDlmm }],
        },
      },
      meta: {
        err: null,
        fee: 5000,
        preBalances: [2_000_000_000, 0],
        postBalances: [1_000_000_000, 0],
        preTokenBalances: [],
        postTokenBalances: [{
          owner: WALLET,
          mint: 'TokenMint1111111111111111111111111111111111',
          uiTokenAmount: { uiAmount: 1000 },
        }],
      },
    }, WALLET);
    expect(swap?.side).toBe('buy');
    expect(swap?.sol).toBeCloseTo(0.999995, 6);
    expect(swap?.mint).toBe('TokenMint1111111111111111111111111111111111');
    expect(PROGRAMS.meteoraDlmm).toBe('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
  });

  test('ignores a failed transaction and a non-signer', () => {
    expect(parseSwap({ meta: { err: { InstructionError: [0, 'x'] } } }, WALLET)).toBeNull();
    expect(parseSwap({
      transaction: { message: { accountKeys: [{ pubkey: WALLET, signer: false }] } },
      meta: { err: null },
    }, WALLET)).toBeNull();
  });
});
