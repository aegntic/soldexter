import { StructuredToolInterface, DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { scoreWallet } from '../bridge/index.js';
import { exaSearch, perplexitySearch, tavilySearch, langSearch, WEB_SEARCH_DESCRIPTION, xSearchTool, X_SEARCH_DESCRIPTION } from './search/index.js';
import { createWebSearchTool, type WebSearchProvider } from './search/web-search.js';
import { getSetting } from '../utils/config.js';
import type { SearchProviderId } from '../utils/env.js';
import { skillTool, SKILL_TOOL_DESCRIPTION } from './skill.js';
import { webFetchTool, WEB_FETCH_DESCRIPTION } from './fetch/web-fetch.js';
import { browserTool, BROWSER_DESCRIPTION } from './browser/browser.js';
import { readFileTool, READ_FILE_DESCRIPTION } from './filesystem/read-file.js';
import { writeFileTool, WRITE_FILE_DESCRIPTION } from './filesystem/write-file.js';
import { editFileTool, EDIT_FILE_DESCRIPTION } from './filesystem/edit-file.js';
import { heartbeatTool, HEARTBEAT_TOOL_DESCRIPTION } from './heartbeat/heartbeat-tool.js';
import { cronTool, CRON_TOOL_DESCRIPTION } from './cron/cron-tool.js';
import { memoryGetTool, MEMORY_GET_DESCRIPTION, memorySearchTool, MEMORY_SEARCH_DESCRIPTION, memoryUpdateTool, MEMORY_UPDATE_DESCRIPTION } from './memory/index.js';
import { discoverSkills } from '../skills/index.js';
import { createSpawnSubagent, SPAWN_SUBAGENT_DESCRIPTION } from './subagent/spawn-subagent.js';
import { getTokenInfoTool, getDexDataTool, getWalletActivityTool, decodeTransactionTool, getTrendingTokensTool, getTokenHoldersTool, getTokenSecurityTool, getGMGNTrendingTool, getGMGNTrenchesTool, getSmartMoneyTool, getKolTool, getPortfolioTool, getWalletActivityGMGNTool } from './solana/index.js';

/**
 * A registered tool with its rich description for system prompt injection.
 */
export interface RegisteredTool {
  /** Tool name (must match the tool's name property) */
  name: string;
  /** The actual tool instance */
  tool: StructuredToolInterface;
  /** Rich description for system prompt (includes when to use, when not to use, etc.) */
  description: string;
  /** 1-2 sentence description for token-optimized system prompts. */
  compactDescription: string;
  /** Whether this tool can safely execute concurrently with other concurrent-safe tools. */
  concurrencySafe: boolean;
}

const scoreWalletTool = new DynamicStructuredTool({
  name: 'score_wallet',
  description:
    'Score a wallet using 5-layer alpha model (Inverse Loss, Liquidity Ghost, Conviction, CTO Meta, Consensus). ' +
    'Returns tier (PRECOGNITIVE/SOVEREIGN/EMERGING/Noise), composite score, and rationale. ' +
    'Use after gathering wallet activity.',
  schema: z.object({
    address: z.string().describe('Solana wallet address'),
  }),
  func: async ({ address }) => {
    return `Wallet scoring requires trade history and liquidity event data for ${address}. ` +
      `Please gather wallet activity first using get_wallet_activity or get_gmgn_wallet_activity, ` +
      `then call score_wallet again with the full trade history and liquidity events.`;
  },
});

/**
 * Get all registered tools with their descriptions.
 * Conditionally includes tools based on environment configuration.
 *
 * @param model - The model name (needed for tools that require model-specific configuration)
 * @returns Array of registered tools
 */
export function getToolRegistry(model: string): RegisteredTool[] {
  const tools: RegisteredTool[] = [
    {
      name: 'spawn_subagent',
      tool: createSpawnSubagent(model),
      description: SPAWN_SUBAGENT_DESCRIPTION,
      compactDescription: 'Delegate a focused sub-task to an isolated subagent. Emit multiple calls in one turn to run independent sub-tasks in parallel.',
      concurrencySafe: true,
    },
    {
      name: 'web_fetch',
      tool: webFetchTool,
      description: WEB_FETCH_DESCRIPTION,
      compactDescription: 'Fetch and extract content from a URL as markdown. Use when you need full article text beyond headlines.',
      concurrencySafe: true,
    },
    {
      name: 'browser',
      tool: browserTool,
      description: BROWSER_DESCRIPTION,
      compactDescription: 'JavaScript-rendered pages and interactive navigation. Actions: navigate, snapshot, act, read, close.',
      concurrencySafe: true,
    },
    {
      name: 'read_file',
      tool: readFileTool,
      description: READ_FILE_DESCRIPTION,
      compactDescription: 'Read a local file by path. Returns file content as text.',
      concurrencySafe: true,
    },
    {
      name: 'write_file',
      tool: writeFileTool,
      description: WRITE_FILE_DESCRIPTION,
      compactDescription: 'Create or overwrite a file. Requires user approval.',
      concurrencySafe: false,
    },
    {
      name: 'edit_file',
      tool: editFileTool,
      description: EDIT_FILE_DESCRIPTION,
      compactDescription: 'Edit a file by replacing text. Requires user approval.',
      concurrencySafe: false,
    },
    {
      name: 'heartbeat',
      tool: heartbeatTool,
      description: HEARTBEAT_TOOL_DESCRIPTION,
      compactDescription: 'View or update the periodic heartbeat checklist (.dexter/HEARTBEAT.md).',
      concurrencySafe: true,
    },
    {
      name: 'cron',
      tool: cronTool,
      description: CRON_TOOL_DESCRIPTION,
      compactDescription: 'Manage scheduled cron jobs (create, list, update, delete).',
      concurrencySafe: true,
    },
    {
      name: 'memory_search',
      tool: memorySearchTool,
      description: MEMORY_SEARCH_DESCRIPTION,
      compactDescription: 'Search persistent memory and past conversations for stored facts and preferences.',
      concurrencySafe: true,
    },
    {
      name: 'memory_get',
      tool: memoryGetTool,
      description: MEMORY_GET_DESCRIPTION,
      compactDescription: 'Read specific memory file sections by line range.',
      concurrencySafe: true,
    },
    {
      name: 'memory_update',
      tool: memoryUpdateTool,
      description: MEMORY_UPDATE_DESCRIPTION,
      compactDescription: 'Add, edit, or delete persistent memory entries.',
      concurrencySafe: false,
    },
    // Solana-native tools
    {
      name: 'get_token_info',
      tool: getTokenInfoTool,
      description: 'Get Solana token metadata, supply, freeze authority, creation date, pump.fun flag. Essential first check for any token analysis.',
      compactDescription: 'Token metadata, supply, freeze authority, age, creator address.',
      concurrencySafe: true,
    },
    {
      name: 'get_dex_data',
      tool: getDexDataTool,
      description: 'Get DEX trading data: price, volume, liquidity, price changes, transaction counts. Source: Birdeye. Use for market analysis and liquidity checks.',
      compactDescription: 'Token price, volume, liquidity, price changes, DEX pair info.',
      concurrencySafe: true,
    },
    {
      name: 'get_wallet_activity',
      tool: getWalletActivityTool,
      description: 'Get recent transactions for a Solana wallet. Parsed swaps with token amounts, program identification. Use to track what wallets are doing.',
      compactDescription: 'Wallet transaction history: swaps, transfers, amounts, programs.',
      concurrencySafe: true,
    },
    {
      name: 'decode_transaction',
      tool: decodeTransactionTool,
      description: 'Decode a Solana transaction by signature. Full breakdown: program, inner instructions, token transfers, account changes. For forensic analysis.',
      compactDescription: 'Full transaction decode: programs, transfers, account changes, fees.',
      concurrencySafe: true,
    },
    {
      name: 'get_trending_tokens',
      tool: getTrendingTokensTool,
      description: 'Get trending Solana tokens by volume/momentum. Returns price, market cap, volume, liquidity. For market overview and momentum plays.',
      compactDescription: 'Trending tokens with price, volume, liquidity, momentum data.',
      concurrencySafe: true,
    },
    {
      name: 'get_token_holders',
      tool: getTokenHoldersTool,
      description: 'Get top holders of a Solana token with labels. Check concentration risk, whale presence, distribution health.',
      compactDescription: 'Top token holders with balances, supply %, and wallet labels.',
      concurrencySafe: true,
    },
    // GMGN tools — advanced risk, smart money, trenches
    {
      name: 'get_token_security',
      tool: getTokenSecurityTool,
      description: 'Deep token security from GMGN: honeypot check, rug ratio, buy/sell tax, sniper count, insider hold rate, bundler activity, fresh wallet rate, smart degen/renowned holders, bluechip owner %, lock info, creator track record. Essential risk check.',
      compactDescription: 'GMGN token security: honeypot, rug ratio, tax, snipers, insider/bundler risk, lock status.',
      concurrencySafe: true,
    },
    {
      name: 'get_gmgn_trending',
      tool: getGMGNTrendingTool,
      description: 'Trending Solana tokens from GMGN. Rank by volume, market cap, smart money, holders. Includes sniper count, smart degen/renowned stats, honeypot filter. More granular than Birdeye.',
      compactDescription: 'GMGN trending tokens with smart money data, sniper counts, and risk filters.',
      concurrencySafe: true,
    },
    {
      name: 'get_gmgn_trenches',
      tool: getGMGNTrenchesTool,
      description: 'New token launches from GMGN trenches — Pump.fun, letsbonk, bonkers, moonshot, ray_launchpad. Track new creations, near-completion bonding curves, and completed tokens. For finding launches before DEX listing.',
      compactDescription: 'New token launches: Pump.fun, bonding curve stage, platform, holder counts.',
      concurrencySafe: true,
    },
    {
      name: 'get_smart_money',
      tool: getSmartMoneyTool,
      description: 'Recent smart money trades from GMGN. See what profitable wallets are buying/selling. Token, amount, price, tx hash. Follow smart money into (or out of) positions.',
      compactDescription: 'Smart money buy/sell trades with token, amount, wallet, and tx hash.',
      concurrencySafe: true,
    },
    {
      name: 'get_kol_trades',
      tool: getKolTool,
      description: 'KOL (Key Opinion Leader) trades from GMGN. Track influencer buys/sells to detect narrative shifts and early adoption.',
      compactDescription: 'KOL/influencer trades: what notable traders are buying or selling.',
      concurrencySafe: true,
    },
    {
      name: 'get_gmgn_portfolio',
      tool: getPortfolioTool,
      description: 'Wallet portfolio from GMGN with full PnL: unrealized/realized profit per token, avg buy price, current value. Better PnL tracking than Helius for wallet analysis.',
      compactDescription: 'Wallet holdings with unrealized/realized PnL, avg buy price, current value.',
      concurrencySafe: true,
    },
    {
      name: 'get_gmgn_wallet_activity',
      tool: getWalletActivityGMGNTool,
      description: 'Wallet trade history from GMGN. Individual buy/sell trades with token, amounts, prices, timestamps. Complements Helius activity with GMGN smart labeling.',
      compactDescription: 'GMGN wallet trade history with smart labeling and degen classification.',
      concurrencySafe: true,
    },
    {
      name: 'score_wallet',
      tool: scoreWalletTool,
      description: 'Score a wallet using 5-layer alpha model (Inverse Loss, Liquidity Ghost, Conviction, CTO Meta, Consensus). Returns tier (PRECOGNITIVE/SOVEREIGN/EMERGING/Noise), composite score, and rationale. Use after gathering wallet activity.',
      compactDescription: '5-layer wallet alpha score: tier, composite score, and layer breakdown.',
      concurrencySafe: true,
    },
  ];

  // Build web_search as a fallback chain over whichever providers have keys configured.
  // The user's preferred provider (set via /search) is tried first; the others act as fallbacks.
  const allWebSearchProviders: WebSearchProvider[] = [];
  if (process.env.EXASEARCH_API_KEY) {
    allWebSearchProviders.push({ id: 'exa', name: 'Exa', tool: exaSearch });
  }
  if (process.env.PERPLEXITY_API_KEY) {
    allWebSearchProviders.push({ id: 'perplexity', name: 'Perplexity', tool: perplexitySearch });
  }
  if (process.env.TAVILY_API_KEY) {
    allWebSearchProviders.push({ id: 'tavily', name: 'Tavily', tool: tavilySearch });
  }
  if (process.env.LANGSEARCH_API_KEY) {
    allWebSearchProviders.push({ id: 'langsearch', name: 'LangSearch', tool: langSearch });
  }

  if (allWebSearchProviders.length > 0) {
    const preferred = getSetting<SearchProviderId | undefined>('webSearchPreferredProvider', undefined);
    const orderedProviders = preferred
      ? [
          ...allWebSearchProviders.filter((p) => p.id === preferred),
          ...allWebSearchProviders.filter((p) => p.id !== preferred),
        ]
      : allWebSearchProviders;

    tools.push({
      name: 'web_search',
      tool: createWebSearchTool(orderedProviders),
      description: WEB_SEARCH_DESCRIPTION,
      compactDescription: 'Search the web for current information. Returns titles, URLs, and snippets.',
      concurrencySafe: true,
    });
  }

  if (process.env.X_BEARER_TOKEN) {
    tools.push({
      name: 'x_search',
      tool: xSearchTool,
      description: X_SEARCH_DESCRIPTION,
      compactDescription: 'Search X/Twitter for tweets, profiles, and threads.',
      concurrencySafe: true,
    });
  }

  const availableSkills = discoverSkills();
  if (availableSkills.length > 0) {
    tools.push({
      name: 'skill',
      tool: skillTool,
      description: SKILL_TOOL_DESCRIPTION,
      compactDescription: 'Invoke a specialized skill workflow (e.g., DCF valuation).',
      concurrencySafe: false,
    });
  }

  return tools;
}

/**
 * Build a name → concurrencySafe map for the tool executor.
 */
export function getToolConcurrencyMap(model: string): Map<string, boolean> {
  return new Map(getToolRegistry(model).map(t => [t.name, t.concurrencySafe]));
}

/**
 * Get just the tool instances for binding to the LLM.
 *
 * @param model - The model name
 * @returns Array of tool instances
 */
export function getTools(model: string): StructuredToolInterface[] {
  return getToolRegistry(model).map((t) => t.tool);
}

/**
 * Build the tool descriptions section for the system prompt.
 * Formats each tool's rich description with a header.
 *
 * @param model - The model name
 * @returns Formatted string with all tool descriptions
 */
/**
 * Build compact tool descriptions for token-optimized system prompts.
 * Uses 1-2 sentence descriptions instead of full multi-paragraph ones.
 * The LLM already has full tool schemas via bindTools().
 */
export function buildCompactToolDescriptions(model: string): string {
  return getToolRegistry(model)
    .map((t) => `- **${t.name}**: ${t.compactDescription}`)
    .join('\n');
}
