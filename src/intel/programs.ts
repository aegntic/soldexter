/**
 * Program ids checked against official docs on 2026-10-03.
 * Meteora DLMM is the corrected id (…YuVaPwxo). The shorter id ending
 * …DgV7v is rejected by the RPC.
 */

export const PROGRAMS = {
  pumpfun: '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
  raydiumAmmV4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
  raydiumCpmm: 'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C',
  raydiumLaunchLab: 'LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj',
  meteoraDlmm: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  meteoraDammV2: 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG',
  pumpSwap: 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA',
  jupiterV6: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
} as const;

export const DEX_PROGRAM_IDS = new Set<string>(Object.values(PROGRAMS));

export const TOKEN_PROGRAM_IDS = new Set<string>([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]);

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

/** pump.fun Mayhem Mode agent wallet. Protocol inventory, not a holder. */
export const PUMP_MAYHEM_AGENT = 'BwWK17cbHxwWBKZkUYvzxLcNQ1YVyaFezduWbtm2de6s';

export const PUBLIC_RPC_URL = 'https://api.mainnet-beta.solana.com';
