import { existsSync, readFileSync, writeFileSync } from 'fs';
import { config } from 'dotenv';
import { getProviderById, PROVIDERS } from '@/providers';

// Load .env on module import
config({ quiet: true });

export function getApiKeyNameForProvider(providerId: string): string | undefined {
  return getProviderById(providerId)?.apiKeyEnvVar;
}

export function getProviderDisplayName(providerId: string): string {
  return getProviderById(providerId)?.displayName ?? providerId;
}

export function checkApiKeyExistsForProvider(providerId: string): boolean {
  const apiKeyName = getApiKeyNameForProvider(providerId);
  if (!apiKeyName) return true;
  return checkApiKeyExists(apiKeyName);
}

export function checkApiKeyExists(apiKeyName: string): boolean {
  const value = process.env[apiKeyName];
  if (value && value.trim() && !value.trim().startsWith('your-')) {
    return true;
  }

  // Also check .env file directly
  if (existsSync('.env')) {
    const envContent = readFileSync('.env', 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key.trim() === apiKeyName) {
          const val = valueParts.join('=').trim();
          if (val && !val.startsWith('your-')) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

export function saveApiKeyToEnv(apiKeyName: string, apiKeyValue: string): boolean {
  try {
    let lines: string[] = [];
    let keyUpdated = false;

    if (existsSync('.env')) {
      const existingContent = readFileSync('.env', 'utf-8');
      const existingLines = existingContent.split('\n');

      for (const line of existingLines) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('#')) {
          lines.push(line);
        } else if (stripped.includes('=')) {
          const key = stripped.split('=')[0].trim();
          if (key === apiKeyName) {
            lines.push(`${apiKeyName}=${apiKeyValue}`);
            keyUpdated = true;
          } else {
            lines.push(line);
          }
        } else {
          lines.push(line);
        }
      }

      if (!keyUpdated) {
        if (lines.length > 0 && !lines[lines.length - 1].endsWith('\n')) {
          lines.push('');
        }
        lines.push(`${apiKeyName}=${apiKeyValue}`);
      }
    } else {
      lines.push('# LLM API Keys');
      lines.push(`${apiKeyName}=${apiKeyValue}`);
    }

    writeFileSync('.env', lines.join('\n'));

    // Reload environment variables
    config({ override: true, quiet: true });

    return true;
  } catch {
    return false;
  }
}

export function saveApiKeyForProvider(providerId: string, apiKey: string): boolean {
  const apiKeyName = getApiKeyNameForProvider(providerId);
  if (!apiKeyName) return false;
  return saveApiKeyToEnv(apiKeyName, apiKey);
}

export type SearchProviderId = 'exa' | 'perplexity' | 'tavily' | 'langsearch';

export const SEARCH_PROVIDERS: Record<SearchProviderId, { displayName: string; apiKeyEnvVar: string }> = {
  exa: { displayName: 'Exa', apiKeyEnvVar: 'EXASEARCH_API_KEY' },
  perplexity: { displayName: 'Perplexity', apiKeyEnvVar: 'PERPLEXITY_API_KEY' },
  tavily: { displayName: 'Tavily', apiKeyEnvVar: 'TAVILY_API_KEY' },
  langsearch: { displayName: 'LangSearch', apiKeyEnvVar: 'LANGSEARCH_API_KEY' },
};

export function getSearchProviderDisplayName(providerId: SearchProviderId): string {
  return SEARCH_PROVIDERS[providerId].displayName;
}

export function getApiKeyNameForSearchProvider(providerId: SearchProviderId): string {
  return SEARCH_PROVIDERS[providerId].apiKeyEnvVar;
}

export function checkApiKeyForSearchProvider(providerId: SearchProviderId): boolean {
  return checkApiKeyExists(SEARCH_PROVIDERS[providerId].apiKeyEnvVar);
}

export function saveApiKeyForSearchProvider(providerId: SearchProviderId, apiKey: string): boolean {
  return saveApiKeyToEnv(SEARCH_PROVIDERS[providerId].apiKeyEnvVar, apiKey);
}

// =====================================================
// CORE SETUP WALKTHROUGH METADATA — value hooks for initial setup
// These power the guided, high-value onboarding experience.
// The goal: during setup the user sees immediate "this is worth it" signals.
// =====================================================

export interface CoreSetupItem {
  envVar: string;
  displayName: string;
  /** Strong value/attention hook shown to user during setup. Makes the effort feel high-ROI. */
  valueHook: string;
  /** Short "where to get + what it unlocks" instruction. */
  howToGet: string;
  /** Whether this is satisfied by choosing any one LLM provider. */
  isLLMGroup?: boolean;
}

/**
 * The minimal set of credentials that turn Soldexter from "chat toy" into a high-edge
 * Solana research & trading intelligence machine. Order here = recommended setup order.
 */
export const CORE_SETUP_ITEMS: CoreSetupItem[] = [
  {
    envVar: 'HELIUS_API_KEY',
    displayName: 'Helius',
    valueHook:
      'THE on-chain foundation. Helius unlocks real-time DAS queries, parsed tx history, holder lists, ' +
      'wallet labels, and enhanced transaction decoding. With this you can ask "which wallets bought TOKEN ' +
      'in the first 5 minutes and are still holding?" and get labeled, actionable data in seconds instead of hours of manual scanning. ' +
      'This is 80% of what makes Soldexter feel like having a full research desk inside your terminal.',
    howToGet:
      'Free tier at https://helius.xyz (or https://dashboard.helius.dev). Create a project → copy the API key. ' +
      'Paste it here. (Most users get their first on-chain signal within 30s of adding this key.)',
  },
  {
    envVar: 'BIRDEYE_API_KEY',
    displayName: 'Birdeye',
    valueHook:
      'Live prices, volume, liquidity, candles, trending, and wallet P&L. Birdeye turns raw on-chain events ' +
      'into tradable intelligence (is liquidity drying up? is this token actually gaining holders or just bot activity?). ' +
      'Combined with Helius it powers the smart-money hunter, trending filters, and accurate valuation inputs. ' +
      'Without it the agent is guessing on market context.',
    howToGet:
      'Sign up at https://birdeye.so (free tier generous for agents). Go to API → generate key. ' +
      'Enables instant "show me tokens with real momentum right now" queries.',
  },
  {
    envVar: 'LLM_API_KEY',
    displayName: 'LLM Provider (OpenAI / Anthropic / xAI / etc.)',
    valueHook:
      'The brain. Soldexter plans, reasons, cross-references tool results, and writes the final intelligence report. ' +
      'A strong model (Claude 3.5/4, GPT-4o, Grok, etc.) is what makes the multi-step research feel magical instead of scripted. ' +
      'You can use local Ollama too for zero-cost private runs. This is the "agent" part of the intelligence agent.',
    howToGet:
      'Pick one: OpenAI (platform.openai.com), Anthropic (console.anthropic.com), xAI, DeepSeek, Google, OpenRouter, or run Ollama locally. ' +
      'Any one is enough. We\'ll let you choose during setup.',
    isLLMGroup: true,
  },
];

export function getCoreSetupItems(): CoreSetupItem[] {
  return CORE_SETUP_ITEMS;
}

export function getMissingCoreSetupItems(): CoreSetupItem[] {
  return CORE_SETUP_ITEMS.filter((item) => {
    if (item.isLLMGroup) {
      // Any LLM provider with a valid key (or ollama which needs none)
      const hasLLM = PROVIDERS.some((p) => {
        if (!p.apiKeyEnvVar) return true; // ollama etc.
        return checkApiKeyExists(p.apiKeyEnvVar);
      });
      return !hasLLM;
    }
    return !checkApiKeyExists(item.envVar);
  });
}

export function isCoreSetupComplete(): boolean {
  return getMissingCoreSetupItems().length === 0;
}

/** Returns a ready-to-paste rich description for use in setup screens. */
export function getSetupValueHook(envVar: string): string {
  const item = CORE_SETUP_ITEMS.find((i) => i.envVar === envVar || (i.isLLMGroup && envVar.includes('LLM')));
  return item ? item.valueHook : 'This key unlocks additional capabilities.';
}

export function getSetupHowToGet(envVar: string): string {
  const item = CORE_SETUP_ITEMS.find((i) => i.envVar === envVar || (i.isLLMGroup && envVar.includes('LLM')));
  return item ? item.howToGet : 'Check the provider dashboard.';
}
