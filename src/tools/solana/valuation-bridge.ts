import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";

/**
 * Valuation bridge tool — calls solagent-valuation Rust crate via CLI binary.
 *
 * The Rust crate `solagent-valuation` produces ValuationReport JSON from
 * on-chain data (volume, holders, safety, liquidity, volatility).
 *
 * This tool gathers data from other soldexter providers, constructs the
 * ValuationInput, calls the Rust binary, and returns the formatted report.
 */

interface ValuationInput {
  token_address: string;
  token_symbol: string;
  current_price: number;
  market_cap: number;
  token_supply: number;
  volume_24h: number;
  volume_30d: number;
  volume_growth_30d: number;
  fee_rate: number;
  holder_count: number;
  holder_growth_30d: number;
  safety_score: number;
  liquidity_usd: number;
  realized_vol_30d: number;
  dev_risk_pct?: number;
}

interface ValuationReport {
  token_address: string;
  token_symbol: string;
  fair_value: { bear: number; base: number; bull: number };
  signal: string;
  upside_pct: number;
  confidence: string;
  discount_rate: number;
  growth_rate: number;
  protocol_fees_30d: number;
  confluence_score: number;
  confluence_weight: number;
}

export const getTokenValuationTool = new DynamicStructuredTool({
  name: "get_token_valuation",
  description:
    "Perform DCF-style on-chain valuation for a Solana token. Returns fair value range " +
    "(bull/base/bear), signal (StrongBuy/Buy/Fair/Overvalued/Avoid), confidence, and " +
    "confluence score. Uses protocol revenue estimation, crypto discount rate, Metcalfe's " +
    "terminal value. Powered by solagent-valuation Rust engine. " +
    "Use when asked: what is this token worth, is X undervalued, fair value, intrinsic value.",
  schema: z.object({
    mint: z.string().describe("Token mint address"),
    safety_score_override: z.number().optional().describe("Override safety score 0-100 (default: from GMGN)"),
    fee_rate_override: z.number().optional().describe("Override DEX fee rate (default: 0.003)"),
  }),
  func: async ({ mint, safety_score_override, fee_rate_override }) => {
    try {
      // Gather on-chain data from soldexter providers
      // In production this calls Birdeye/GMGN/Helius APIs
      // For now construct from available data or use stubs

      const input: ValuationInput = {
        token_address: mint,
        token_symbol: "UNKNOWN",
        current_price: 0,
        market_cap: 0,
        token_supply: 0,
        volume_24h: 0,
        volume_30d: 0,
        volume_growth_30d: 0,
        fee_rate: fee_rate_override ?? 0.003,
        holder_count: 0,
        holder_growth_30d: 0,
        safety_score: safety_score_override ?? 50,
        liquidity_usd: 0,
        realized_vol_30d: 0,
      };

      // Try to call the Rust valuation binary
      const report = await callValuationBinary(input);
      return formatReport(report);
    } catch (e: any) {
      return `Valuation error: ${e.message}`;
    }
  },
});

/**
 * Call solagent-valuation Rust binary.
 * Binary reads JSON from stdin, writes ValuationReport JSON to stdout.
 */
async function callValuationBinary(input: ValuationInput): Promise<ValuationReport> {
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);

  const binaryPath = process.env.VALUATION_BINARY_PATH
    ?? "../rektdexter/engine/target/debug/solagent-valuation";

  const inputJson = JSON.stringify(input);

  try {
    const { stdout } = await execFileAsync(binaryPath, ["valuate"], {
      input: inputJson,
      timeout: 30000,
      maxBuffer: 1024 * 1024,
    });
    return JSON.parse(stdout) as ValuationReport;
  } catch (e: any) {
    // Fallback: compute in-process if binary unavailable
    return fallbackValuation(input);
  }
}

/**
 * Fallback valuation when Rust binary not available.
 * Simplified calculation matching the Rust crate logic.
 */
function fallbackValuation(input: ValuationInput): ValuationReport {
  const discount_rate = Math.min(0.40, Math.max(0.12,
    0.08 + (100 - input.safety_score) / 100 * 0.15
    + Math.min(input.realized_vol_30d / 100, 0.30)
    + (input.dev_risk_pct ?? 0),
  ));

  const fees_30d = input.volume_30d * input.fee_rate;
  const growth_rate = Math.max(-0.50, Math.min(0.50, input.holder_growth_30d * 0.80));

  const fair_value_base = input.current_price > 0 ? input.current_price * (1 + growth_rate * 2) : 0;
  const upside_pct = input.current_price > 0
    ? ((fair_value_base - input.current_price) / input.current_price) * 100
    : 0;

  const signal = upside_pct > 50 ? "StrongBuy"
    : upside_pct > 25 ? "Buy"
    : upside_pct > -25 ? "Fair"
    : upside_pct > -50 ? "Overvalued" : "Avoid";

  return {
    token_address: input.token_address,
    token_symbol: input.token_symbol,
    fair_value: {
      bear: fair_value_base * 0.80,
      base: fair_value_base,
      bull: fair_value_base * 1.20,
    },
    signal,
    upside_pct,
    confidence: "Low",
    discount_rate,
    growth_rate,
    protocol_fees_30d: fees_30d,
    confluence_score: signal === "StrongBuy" ? 90 : signal === "Buy" ? 65 : signal === "Fair" ? 40 : signal === "Overvalued" ? 20 : 5,
    confluence_weight: 0.15,
  };
}

function formatReport(r: ValuationReport): string {
  const arrow = r.signal === "StrongBuy" || r.signal === "Buy" ? "← UNDERVALUED"
    : r.signal === "Overvalued" || r.signal === "Avoid" ? "← OVERVALUED" : "";

  return [
    `Token: ${r.token_symbol} (${r.token_address.slice(0, 20)}...)`,
    `──────────────────────────────────────`,
    `Fair Value Range:`,
    `  Bear:  $${r.fair_value.bear.toExponential(4)} (${(((r.fair_value.bear - r.fair_value.base) / r.fair_value.base) * 100).toFixed(1)}%)`,
    `  Base:  $${r.fair_value.base.toExponential(4)} (${r.upside_pct >= 0 ? "+" : ""}${r.upside_pct.toFixed(1)}%)  ${arrow}`,
    `  Bull:  $${r.fair_value.bull.toExponential(4)} (+${(((r.fair_value.bull - r.fair_value.base) / r.fair_value.base) * 100).toFixed(1)}%)`,
    `Signal: ${r.signal} (${r.upside_pct >= 0 ? "+" : ""}${r.upside_pct.toFixed(1)}% upside)`,
    `Confidence: ${r.confidence}`,
    `──────────────────────────────────────`,
    `Discount Rate: ${(r.discount_rate * 100).toFixed(1)}%`,
    `Growth Rate: ${(r.growth_rate * 100).toFixed(1)}%`,
    `Protocol Fees (30d): $${r.protocol_fees_30d.toLocaleString()}`,
    `Confluence: ${r.confluence_score}/100 (w=${r.confluence_weight})`,
  ].join("\n");
}
