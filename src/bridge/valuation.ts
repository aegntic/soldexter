type ValuationSignal = 'StrongBuy' | 'Buy' | 'Fair' | 'Overvalued' | 'Avoid';

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
}

interface ValuationReport {
  fair_value: { bear: number; base: number; bull: number };
  discount_rate: number;
  growth_rate: number;
  enterprise_value: number;
  terminal_value: number;
  confidence: 'High' | 'Medium' | 'Low';
  signal: ValuationSignal;
  upside_pct: number;
  confluence_weight: number;
  valuation_timestamp: Date;
}

const VALUATION_BIN = process.env.SOLAGENT_VALUATION_BIN || '../rektdexter/engine/target/debug/solagent_valuation';

export interface TokenValuationParams {
  token_address: string;
  token_symbol: string;
  current_price: number;
  market_cap: number;
  token_supply: number;
  volume_24h: number;
  volume_30d?: number;
  volume_growth_30d?: number;
  fee_rate: number;
  holder_count: number;
  holder_growth_30d?: number;
  safety_score: number;
  liquidity_usd: number;
  realized_vol_30d?: number;
}

export interface TokenValuationResult {
  fair_value: { bear: number; base: number; bull: number };
  discount_rate: number;
  growth_rate: number;
  enterprise_value: number;
  terminal_value: number;
  confidence: 'High' | 'Medium' | 'Low';
  signal: ValuationSignal;
  upside_pct: number;
  confluence_weight: number;
  timestamp: string;
}

export async function valuateToken(params: TokenValuationParams): Promise<TokenValuationResult> {
  const input: ValuationInput = {
    token_address: params.token_address,
    token_symbol: params.token_symbol,
    current_price: params.current_price,
    market_cap: params.market_cap,
    token_supply: params.token_supply,
    volume_24h: params.volume_24h,
    volume_30d: params.volume_30d ?? params.volume_24h * 30,
    volume_growth_30d: params.volume_growth_30d ?? 0,
    fee_rate: params.fee_rate,
    holder_count: params.holder_count,
    holder_growth_30d: params.holder_growth_30d ?? 0,
    safety_score: params.safety_score,
    liquidity_usd: params.liquidity_usd,
    realized_vol_30d: params.realized_vol_30d ?? 0,
  };

  try {
    const result = await callValuationBinary(input);
    return result;
  } catch (err) {
    console.error('solagent_valuation binary failed, falling back to TS implementation:', err);
    return fallbackValuation(input);
  }
}

async function callValuationBinary(input: ValuationInput): Promise<TokenValuationResult> {
  const { spawn } = await import('node:child_process');
  const proc = spawn(VALUATION_BIN, ['--json'], { stdio: ['pipe', 'pipe', 'pipe'] });

  const stdout: string[] = [];
  const stderr: string[] = [];

  proc.stdout.on('data', (d) => stdout.push(d.toString()));
  proc.stderr.on('data', (d) => stderr.push(d.toString()));

  const exit = await new Promise<{ code: number | null }>((resolve) => {
    proc.on('close', (code) => resolve({ code }));
  });

  if (exit.code !== 0) {
    throw new Error(`solagent_valuation exited ${exit.code}: ${stderr.join('')}`);
  }

  const report: ValuationReport = JSON.parse(stdout.join(''));
  return mapReport(report);
}

function mapReport(r: ValuationReport): TokenValuationResult {
  return {
    fair_value: r.fair_value,
    discount_rate: r.discount_rate,
    growth_rate: r.growth_rate,
    enterprise_value: r.enterprise_value,
    terminal_value: r.terminal_value,
    confidence: r.confidence,
    signal: r.signal,
    upside_pct: r.upside_pct,
    confluence_weight: r.confluence_weight,
    timestamp: r.valuation_timestamp.toISOString(),
  };
}

function fallbackValuation(input: ValuationInput): TokenValuationResult {
  const discountRate = 0.15;
  const growth = Math.max(0.05, Math.min(0.40, input.fee_rate * 50));
  const baseFair = (input.volume_24h * 365 * input.fee_rate * 0.8) / (discountRate - growth);
  const bear = baseFair * 0.6;
  const bull = baseFair * 1.4;
  const signal: ValuationSignal = input.safety_score > 0.7 ? 'StrongBuy' : input.safety_score > 0.4 ? 'Buy' : 'Fair';

  return {
    fair_value: { bear, base: baseFair, bull },
    discount_rate: discountRate,
    growth_rate: growth,
    enterprise_value: baseFair,
    terminal_value: baseFair * 0.5,
    confidence: 'Medium',
    signal,
    upside_pct: ((baseFair - input.market_cap) / input.market_cap) * 100,
    confluence_weight: 0.15,
    timestamp: new Date().toISOString(),
  };
}
