import { resolveProvider } from '../providers.js';

/**
 * Cost control for the agent loop.
 *
 * Data pulling and parsing can run on a cheap or local model. Scoring and
 * synthesis stay on the session model unless overridden. With no env set,
 * every role uses the session model, so existing setups keep their behavior.
 *
 * SOLDEXTER_COST_CONTROL=local  fetch + parse use Ollama (OLLAMA_MODEL or llama3.2)
 * SOLDEXTER_COST_CONTROL=fast   fetch + parse use the provider fast model
 *
 * Per-role overrides always win:
 *   SOLDEXTER_MODEL_FETCH, SOLDEXTER_MODEL_PARSE,
 *   SOLDEXTER_MODEL_SCORE, SOLDEXTER_MODEL_SYNTHESIZE
 */

export type ModelRole = 'fetch' | 'parse' | 'score' | 'synthesize';

const ROLE_ENV: Record<ModelRole, string> = {
  fetch: 'SOLDEXTER_MODEL_FETCH',
  parse: 'SOLDEXTER_MODEL_PARSE',
  score: 'SOLDEXTER_MODEL_SCORE',
  synthesize: 'SOLDEXTER_MODEL_SYNTHESIZE',
};

const GATHER_ROLES = new Set<ModelRole>(['fetch', 'parse']);

export function modelForRole(
  role: ModelRole,
  sessionModel: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const override = env[ROLE_ENV[role]]?.trim();
  if (override) return override;

  if (!GATHER_ROLES.has(role)) return sessionModel;

  const mode = env.SOLDEXTER_COST_CONTROL?.trim().toLowerCase();
  switch (mode) {
    case 'local': {
      const name = env.OLLAMA_MODEL?.trim() || 'llama3.2';
      return name.startsWith('ollama:') ? name : `ollama:${name}`;
    }
    case 'fast':
      return resolveProvider(sessionModel).fastModel ?? sessionModel;
    case undefined:
    case '':
      return sessionModel;
    default:
      return sessionModel;
  }
}

export function gatherModel(sessionModel: string, env: NodeJS.ProcessEnv = process.env): string {
  return modelForRole('parse', sessionModel, env);
}

export function synthesisModel(sessionModel: string, env: NodeJS.ProcessEnv = process.env): string {
  return modelForRole('synthesize', sessionModel, env);
}
