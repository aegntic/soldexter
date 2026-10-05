/**
 * Swap detection from jsonParsed transactions.
 * A swap is a signer wallet, one non-quote token delta, and SOL or WSOL moving
 * the other way, on a known DEX program. Version-1 transactions are accepted
 * by the caller (maxSupportedTransactionVersion: 1).
 */

import { DEX_PROGRAM_IDS, WSOL_MINT } from './programs.js';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const QUOTE_MINTS = new Set([WSOL_MINT, USDC, USDT]);

export interface ParsedSwap {
  signature: string;
  time_utc: string | null;
  slot: number | null;
  mint: string;
  side: 'buy' | 'sell';
  sol: number;
  token_amount: number;
  programs: string[];
}

interface TokenBalance {
  owner?: string;
  mint?: string;
  uiTokenAmount?: { uiAmount?: number | null; uiAmountString?: string };
}

interface ParsedTx {
  slot?: number;
  blockTime?: number | null;
  transaction?: {
    signatures?: string[];
    message?: {
      accountKeys?: Array<string | { pubkey?: string; signer?: boolean }>;
      instructions?: Array<{ programId?: string }>;
    };
  };
  meta?: {
    err?: unknown;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: TokenBalance[];
    postTokenBalances?: TokenBalance[];
    innerInstructions?: Array<{ instructions?: Array<{ programId?: string }> }>;
  };
}

function accountKey(key: string | { pubkey?: string; signer?: boolean }, index: number): { pubkey: string; signer: boolean; index: number } {
  if (typeof key === 'string') return { pubkey: key, signer: index === 0, index };
  return { pubkey: key.pubkey ?? '', signer: Boolean(key.signer), index };
}

function uiAmount(balance: TokenBalance | undefined): number {
  if (!balance?.uiTokenAmount) return 0;
  if (typeof balance.uiTokenAmount.uiAmount === 'number') return balance.uiTokenAmount.uiAmount;
  if (balance.uiTokenAmount.uiAmountString) return Number(balance.uiTokenAmount.uiAmountString);
  return 0;
}

function programIds(tx: ParsedTx): string[] {
  const outer = tx.transaction?.message?.instructions ?? [];
  const inner = (tx.meta?.innerInstructions ?? []).flatMap((group) => group.instructions ?? []);
  return [...outer, ...inner].map((ix) => ix.programId ?? '').filter(Boolean);
}

export function parseSwap(tx: ParsedTx, wallet: string): ParsedSwap | null {
  if (tx.meta?.err) return null;
  const keys = (tx.transaction?.message?.accountKeys ?? []).map(accountKey);
  const walletKey = keys.find((key) => key.pubkey === wallet);
  if (!walletKey?.signer) return null;
  const programs = programIds(tx);
  if (!programs.some((program) => DEX_PROGRAM_IDS.has(program))) return null;

  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];
  const mints = new Set<string>();
  for (const row of [...pre, ...post]) {
    if (row.owner === wallet && row.mint) mints.add(row.mint);
  }

  const deltas: Array<{ mint: string; delta: number }> = [];
  for (const mint of mints) {
    const before = pre.filter((row) => row.owner === wallet && row.mint === mint).reduce((sum, row) => sum + uiAmount(row), 0);
    const after = post.filter((row) => row.owner === wallet && row.mint === mint).reduce((sum, row) => sum + uiAmount(row), 0);
    const delta = after - before;
    if (delta !== 0) deltas.push({ mint, delta });
  }

  const tokenDeltas = deltas.filter((row) => !QUOTE_MINTS.has(row.mint));
  if (tokenDeltas.length !== 1) return null;
  const token = tokenDeltas[0];

  const preLamports = tx.meta?.preBalances?.[walletKey.index] ?? 0;
  const postLamports = tx.meta?.postBalances?.[walletKey.index] ?? 0;
  const fee = tx.meta?.fee ?? 0;
  const nativeSol = (postLamports - preLamports + fee) / 1e9;
  const wsol = deltas.find((row) => row.mint === WSOL_MINT)?.delta ?? 0;
  const solDelta = nativeSol + wsol;
  if (solDelta === 0 || token.delta === 0) return null;
  if (Math.sign(solDelta) === Math.sign(token.delta)) return null;

  const side = token.delta > 0 ? 'buy' : 'sell';
  const time = typeof tx.blockTime === 'number' ? new Date(tx.blockTime * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z') : null;
  return {
    signature: tx.transaction?.signatures?.[0] ?? '',
    time_utc: time,
    slot: typeof tx.slot === 'number' ? tx.slot : null,
    mint: token.mint,
    side,
    sol: Math.abs(solDelta),
    token_amount: Math.abs(token.delta),
    programs,
  };
}
