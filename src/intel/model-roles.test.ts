import { describe, expect, test } from 'bun:test';
import { modelForRole } from './model-roles.js';

describe('modelForRole', () => {
  test('uses the session model for every role by default', () => {
    expect(modelForRole('parse', 'gpt-5.5', {})).toBe('gpt-5.5');
    expect(modelForRole('synthesize', 'gpt-5.5', {})).toBe('gpt-5.5');
    expect(modelForRole('score', 'gpt-5.5', {})).toBe('gpt-5.5');
  });

  test('sends fetch and parse to ollama when cost control is local', () => {
    const env = { SOLDEXTER_COST_CONTROL: 'local', OLLAMA_MODEL: 'llama3.1' };
    expect(modelForRole('fetch', 'gpt-5.5', env)).toBe('ollama:llama3.1');
    expect(modelForRole('parse', 'gpt-5.5', env)).toBe('ollama:llama3.1');
    expect(modelForRole('score', 'gpt-5.5', env)).toBe('gpt-5.5');
    expect(modelForRole('synthesize', 'gpt-5.5', env)).toBe('gpt-5.5');
  });

  test('lets a per-role env override the mode', () => {
    const env = { SOLDEXTER_COST_CONTROL: 'local', SOLDEXTER_MODEL_PARSE: 'ollama:qwen2.5' };
    expect(modelForRole('parse', 'gpt-5.5', env)).toBe('ollama:qwen2.5');
    expect(modelForRole('synthesize', 'claude-sonnet-4-6', { SOLDEXTER_MODEL_SYNTHESIZE: 'claude-opus-4-8' })).toBe('claude-opus-4-8');
  });
});
