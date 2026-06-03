import { z } from "zod";

// Input schemas
export const GetTokenInfoSchema = z.object({
  mint: z.string().describe("Solana token mint address"),
});

export const GetWalletActivitySchema = z.object({
  address: z.string().describe("Solana wallet address"),
  limit: z.number().optional().default(20).describe("Number of transactions to return"),
  type: z.enum(["all", "swaps", "transfers"]).optional().default("all"),
});

export const DecodeTransactionSchema = z.object({
  signature: z.string().describe("Transaction signature"),
});

export const GetTokenHoldersSchema = z.object({
  mint: z.string().describe("Token mint address"),
  top: z.number().optional().default(20).describe("Number of top holders to return"),
});

export const SearchWalletLabelsSchema = z.object({
  address: z.string().describe("Wallet address to look up"),
});

// Response types
export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  holder_count: number;
  top_10_holders_pct: number;
  creation_date: string | null;
  creator_address: string | null;
  metadata_uri: string | null;
  logo_url: string | null;
  freeze_authority: string | null;
  mint_authority: string | null;
  is_mutable: boolean;
  pump_fun_flag: boolean;
}

export interface WalletActivity {
  signature: string;
  block_time: number;
  type: "swap" | "transfer" | "create" | "stake" | "unknown";
  token_in: string | null;
  token_out: string | null;
  amount_in: number | null;
  amount_out: number | null;
  usd_value: number | null;
  fee_sol: number;
  program: string;
}

export interface DecodedTransaction {
  type: string;
  program: string;
  inner_instructions: Array<{ program: string; parsed_data: unknown }>;
  accounts: Array<{ address: string; role: string; pre_balance: number; post_balance: number }>;
  token_transfers: Array<{ from: string; to: string; mint: string; amount: number }>;
  fee_payer: string;
  compute_units: number;
  priority_fee: number;
}

export interface TokenHolder {
  address: string;
  balance: number;
  pct_supply: number;
  first_tx_date: string | null;
  last_tx_date: string | null;
  label: string | null;
}

export interface WalletLabel {
  address: string;
  labels: string[];
  tags: string[];
  known_as: string | null;
  first_seen: string | null;
  risk_flags: string[];
}

// Helper for RPC calls
async function heliusRpc(method: string, params: unknown[]) {
  const base = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY || ""}`;
  const res = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`Helius RPC error: ${json.error.message}`);
  return json.result;
}

// Helper for API calls (non-RPC)
async function heliusApi(path: string) {
  const base = `https://api.helius.xyz/v0${path}`;
  const url = base.includes("?") ? `${base}&api-key=${process.env.HELIUS_API_KEY}` : `${base}?api-key=${process.env.HELIUS_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Helius API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Get token metadata and supply info via DAS API + RPC
 */
export async function getTokenInfo(mint: string): Promise<TokenInfo> {
  // Get metadata via DAS API
  const dasResult = await heliusRpc("getAsset", [{ id: mint }]);

  // Get supply info
  const supplyInfo = await heliusRpc("getTokenSupply", [mint]);

  const metadata = dasResult?.content?.metadata || {};
  const data = dasResult || {};

  // Check for pump.fun
  const pumpFunFlag = data.creators?.some((c: any) => c.address === "CebN5WGQ4jvEPvsVU4EoHEpgzq1VV7AbCfKUrXB2v6Mc") || false;

  return {
    name: metadata.name || "Unknown",
    symbol: metadata.symbol || "UNKNOWN",
    decimals: supplyInfo?.value?.decimals || 0,
    supply: supplyInfo?.value?.amount || "0",
    holder_count: 0, // Requires separate pagination call
    top_10_holders_pct: 0, // Requires holder analysis
    creation_date: data.creation_time ? new Date(data.creation_time * 1000).toISOString() : null,
    creator_address: data.creators?.[0]?.address || null,
    metadata_uri: data.content?.json_uri || null,
    logo_url: data.content?.links?.image || data.content?.files?.[0]?.uri || null,
    freeze_authority: data.authority?.freeze_authority || null,
    mint_authority: data.authority?.mint_authority || null,
    is_mutable: data.mutable ?? true,
    pump_fun_flag: pumpFunFlag,
  };
}

/**
 * Get parsed wallet transaction history
 */
export async function getWalletActivity(address: string, limit = 20, type = "all"): Promise<WalletActivity[]> {
  const sigs = await heliusRpc("getSignaturesForAddress", [address, { limit }]);

  if (!sigs.length) return [];

  // Fetch parsed transactions in batches
  const batch = sigs.slice(0, Math.min(limit, 10)); // Helius limits batch size
  const txs = await heliusRpc("getTransaction", [
    batch.map((s: any) => s.signature),
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
  ]);

  return (txs || [])
    .filter(Boolean)
    .map((tx: any) => parseTransaction(tx, address))
    .filter((a: WalletActivity) => type === "all" || a.type === type);
}

/**
 * Decode a single transaction
 */
export async function decodeTransaction(signature: string): Promise<DecodedTransaction> {
  const tx = await heliusRpc("getTransaction", [
    [signature],
    { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
  ]);

  if (!tx?.[0]) throw new Error(`Transaction not found: ${signature}`);
  return parseDecodedTransaction(tx[0]);
}

/**
 * Get top token holders via getTokenLargestAccounts
 */
export async function getTokenHolders(mint: string, top = 20): Promise<TokenHolder[]> {
  const accounts = await heliusRpc("getTokenLargestAccounts", [mint]);

  return (accounts?.value || []).slice(0, top).map((acct: any) => ({
    address: acct.address,
    balance: Number(acct.amount || 0),
    pct_supply: 0, // Calculated after supply lookup
    first_tx_date: null,
    last_tx_date: null,
    label: null,
  }));
}

/**
 * Search wallet labels via Helius API
 */
export async function searchWalletLabels(address: string): Promise<WalletLabel> {
  try {
    const labels = await heliusApi(`/addresses/${address}/labels`);
    return {
      address,
      labels: labels?.labels || [],
      tags: labels?.tags || [],
      known_as: labels?.name || null,
      first_seen: labels?.first_seen || null,
      risk_flags: labels?.risk_flags || [],
    };
  } catch {
    return { address, labels: [], tags: [], known_as: null, first_seen: null, risk_flags: [] };
  }
}

// Internal parsers
function parseTransaction(tx: any, walletAddress: string): WalletActivity {
  const instructions = tx.transaction?.message?.instructions || [];
  const inner = tx.meta?.innerInstructions || [];

  // Detect swap vs transfer
  const programIds = instructions.map((ix: any) => ix.programId || ix.program);
  const isSwap = programIds.some((p: string) =>
    ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", "JUP4Fb2cqiRUcTHiNQoq61MZwTjZNLQ6THaPwI5UqE"].includes(p) ||
    p?.includes("raydium") || p?.includes("whir") || p?.includes("orca")
  );

  let tokenIn: string | null = null;
  let tokenOut: string | null = null;
  let amountIn: number | null = null;
  let amountOut: number | null = null;

  // Extract from pre/post token balances
  const preBalances = tx.meta?.preTokenBalances || [];
  const postBalances = tx.meta?.postTokenBalances || [];

  for (const post of postBalances) {
    const pre = preBalances.find((p: any) => p.accountIndex === post.accountIndex);
    const diff = Number(post.uiTokenAmount?.amount || 0) - Number(pre?.uiTokenAmount?.amount || 0);
    if (diff > 0) {
      tokenOut = post.mint;
      amountOut = diff;
    } else if (diff < 0) {
      tokenIn = post.mint;
      amountIn = Math.abs(diff);
    }
  }

  return {
    signature: tx.transaction?.signatures?.[0] || "",
    block_time: tx.blockTime || 0,
    type: isSwap ? "swap" : "transfer",
    token_in: tokenIn,
    token_out: tokenOut,
    amount_in: amountIn,
    amount_out: amountOut,
    usd_value: null, // Requires price lookup
    fee_sol: (tx.meta?.fee || 0) / 1e9,
    program: programIds[0] || "unknown",
  };
}

function parseDecodedTransaction(tx: any): DecodedTransaction {
  const instructions = tx.transaction?.message?.instructions || [];
  const innerInstructions = (tx.meta?.innerInstructions || []).map((ii: any) => ({
    program: ii.instructions?.[0]?.program || "unknown",
    parsed_data: ii.instructions?.[0]?.parsed,
  }));

  const accounts = (tx.transaction?.message?.accountKeys || []).map((key: any, i: number) => ({
    address: typeof key === "string" ? key : key.pubkey || key.account || "",
    role: i === 0 ? "fee_payer" : "signer",
    pre_balance: (tx.meta?.preBalances?.[i] || 0) / 1e9,
    post_balance: (tx.meta?.postBalances?.[i] || 0) / 1e9,
  }));

  const tokenTransfers = (tx.meta?.preTokenBalances || []).flatMap((pre: any) => {
    const post = (tx.meta?.postTokenBalances || []).find((p: any) => p.accountIndex === pre.accountIndex);
    if (!post || pre.mint !== post.mint) return [];
    const diff = Number(post.uiTokenAmount?.amount || 0) - Number(pre.uiTokenAmount?.amount || 0);
    if (diff === 0) return [];
    return [{
      from: diff > 0 ? pre.owner || "" : post.owner || "",
      to: diff > 0 ? post.owner || "" : pre.owner || "",
      mint: pre.mint,
      amount: Math.abs(diff),
    }];
  });

  return {
    type: instructions[0]?.parsed?.type || "unknown",
    program: instructions[0]?.programId || instructions[0]?.program || "unknown",
    inner_instructions: innerInstructions,
    accounts,
    token_transfers: tokenTransfers,
    fee_payer: accounts[0]?.address || "",
    compute_units: tx.meta?.computeUnitsConsumed || 0,
    priority_fee: (tx.meta?.fee || 0) / 1e9,
  };
}
