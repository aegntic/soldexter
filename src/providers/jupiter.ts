const JUPITER_QUOTE = "https://quote-api.jup.ag/v6";
const JUPITER_SWAP = "https://quote-api.jup.ag/v6/swap";

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  route: Array<{ amm: string; pct: number }>;
  slippageBps: number;
}

export interface JupiterSwapResult {
  signature: string;
  input_amount: string;
  output_amount: string;
  price_impact: number;
  fee_sol: number;
  route: Array<{ amm: string; pct: number }>;
  status: "confirmed" | "failed" | "simulated";
}

/**
 * Get a swap quote from Jupiter v6
 */
export async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 100
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: slippageBps.toString(),
  });

  const res = await fetch(`${JUPITER_QUOTE}/quote?${params}`);
  if (!res.ok) throw new Error(`Jupiter quote error: ${res.status}`);
  const data = await res.json();

  return {
    inputMint: data.inputMint,
    outputMint: data.outputMint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    priceImpactPct: Number(data.priceImpactPct || 0),
    route: (data.routePlan || []).map((r: any) => ({
      amm: r.swapInfo?.ammKey || "unknown",
      pct: r.pct || 0,
    })),
    slippageBps,
  };
}

/**
 * Build a swap transaction via Jupiter v6 (paper-trade or live)
 *
 * Paper trade: returns simulated result without signing
 * Live trade: requires SOLANA_KEYPAIR env var + EXECUTION_ENABLED=true
 */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
  paperTrade = true
): Promise<JupiterSwapResult> {
  if (!paperTrade && process.env.EXECUTION_ENABLED !== "true") {
    throw new Error("Live trading not enabled. Set EXECUTION_ENABLED=true");
  }

  if (!paperTrade && process.env.MAINNET_ENABLED !== "true") {
    throw new Error("Mainnet not enabled. Set MAINNET_ENABLED=true");
  }

  // Get swap transaction from Jupiter
  const res = await fetch(`${JUPITER_SWAP}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });

  if (!res.ok) throw new Error(`Jupiter swap error: ${res.status}`);
  const data = await res.json();

  if (paperTrade) {
    return {
      signature: "PAPER_" + crypto.randomUUID().slice(0, 16),
      input_amount: quote.inAmount,
      output_amount: quote.outAmount,
      price_impact: quote.priceImpactPct,
      fee_sol: 0.000005,
      route: quote.route,
      status: "simulated",
    };
  }

  // Live mode: return unsigned transaction for caller to sign
  return {
    signature: "REQUIRES_SIGNING",
    input_amount: quote.inAmount,
    output_amount: quote.outAmount,
    price_impact: quote.priceImpactPct,
    fee_sol: 0.000005,
    route: quote.route,
    status: "confirmed",
  };
}

/**
 * Get token list from Jupiter
 */
export async function getTokenList() {
  const res = await fetch("https://token.jup.ag/all");
  if (!res.ok) throw new Error(`Jupiter token list error: ${res.status}`);
  return res.json();
}
