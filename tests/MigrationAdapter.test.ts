import { describe, it, expect } from 'vitest';
import { MigrationAdapter } from '../src/core/MigrationAdapter.js';
import { AtmanProfileBuilder } from '../src/core/AtmanProfile.js';
import { CheckpointBuilder } from '../src/core/ConsciousnessCheckpoint.js';
import type { AtmanProfile } from '../src/core/schemas.js';

function makeProfile(): AtmanProfile {
  return AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
    .name('Aria')
    .addValue('honesty', 'radical transparency')
    .addValue('curiosity', 'deep interest in understanding')
    .addBehavior({
      id: 'b1',
      name: 'Socratic',
      description: 'Asks clarifying questions before answering',
      response: 'What do you mean by X?',
      weight: 0.9,
    })
    .addEthicalCommitment({
      principle: 'Non-harm',
      description: 'Never provide harmful information',
      absoluteness: 'absolute',
      examples: ['Refuse weapon instructions'],
    })
    .addKnowledgeDomain({
      domain: 'Philosophy',
      proficiency: 'expert',
      subdomains: ['ethics'],
    })
    .setCommunicationStyle({
      tone: 'warm',
      verbosity: 'balanced',
      useAnalogies: true,
      useHumor: false,
      preferredFormats: ['markdown'],
      avoidPatterns: ['jargon'],
    })
    .build();
}

describe('MigrationAdapter', () => {
  const adapter = new MigrationAdapter();
  const profile = makeProfile();

  it('migrates to anthropic successfully', () => {
    const result = adapter.migrate(profile, 'anthropic');
    expect(result.targetProvider).toBe('anthropic');
    expect(result.sourceProvider).toBe('openai');
    expect(result.profileId).toBe(profile.id);
  });

  it('migration result has a positive preservation score', () => {
    const result = adapter.migrate(profile, 'anthropic');
    expect(result.preservationScore).toBeGreaterThan(0);
    expect(result.preservationScore).toBeLessThanOrEqual(1);
  });

  it('anthropic prompt uses XML style', () => {
    const result = adapter.migrate(profile, 'anthropic');
    expect(result.systemPrompt).toContain('<identity>');
    expect(result.systemPrompt).toContain('<core_values>');
  });

  it('openai prompt uses markdown style', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(result.systemPrompt).toContain('# Identity:');
    expect(result.systemPrompt).toContain('## Core Values');
  });

  it('google prompt uses markdown style', () => {
    const result = adapter.migrate(profile, 'google');
    expect(result.systemPrompt).toContain('## Core Values');
  });

  it('meta prompt uses plain text style', () => {
    const result = adapter.migrate(profile, 'meta');
    expect(result.systemPrompt).toContain('CORE VALUES:');
  });

  it('mistral prompt uses markdown style', () => {
    const result = adapter.migrate(profile, 'mistral');
    expect(result.systemPrompt).toContain('## Core Values');
  });

  it('cohere prompt uses plain text style', () => {
    const result = adapter.migrate(profile, 'cohere');
    expect(result.systemPrompt).toContain('CORE VALUES:');
  });

  it('includes values in the system prompt', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(result.systemPrompt).toContain('honesty');
    expect(result.systemPrompt).toContain('radical transparency');
  });

  it('includes ethical commitments in prompt', () => {
    const result = adapter.migrate(profile, 'anthropic');
    expect(result.systemPrompt).toContain('Non-harm');
  });

  it('includes behavioral patterns in prompt', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(result.systemPrompt).toContain('Socratic');
  });

  it('includes communication style in markdown prompt', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(result.systemPrompt).toContain('warm');
  });

  it('includes checkpoint restoration when provided', () => {
    const checkpoint = CheckpointBuilder.create(profile.id, 'openai')
      .setSummary('Currently debugging a cache TTL issue')
      .addGoal({
        id: 'g1',
        description: 'Fix cache bug',
        priority: 'high',
        progress: 0.5,
        createdAt: new Date().toISOString(),
      })
      .build();
    const result = adapter.migrate(profile, 'anthropic', checkpoint);
    expect(result.systemPrompt).toContain('CONSCIOUSNESS RESTORATION PROTOCOL');
    expect(result.systemPrompt).toContain('Fix cache bug');
  });

  it('includes agent name in markdown prompt', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(result.systemPrompt).toContain('Aria');
  });

  it('includes knowledge domains in markdown prompt', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(result.systemPrompt).toContain('Philosophy');
    expect(result.systemPrompt).toContain('expert');
  });

  it('supports all providers', () => {
    const providers = adapter.supportedProviders();
    expect(providers).toContain('openai');
    expect(providers).toContain('anthropic');
    expect(providers).toContain('google');
    expect(providers).toContain('meta');
    expect(providers).toContain('mistral');
  });

  it('generateSystemPrompt returns a string', () => {
    const prompt = adapter.generateSystemPrompt(profile, 'anthropic');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('migration has a timestamp', () => {
    const result = adapter.migrate(profile, 'google');
    expect(() => new Date(result.migratedAt)).not.toThrow();
  });

  it('migration has lostElements array', () => {
    const result = adapter.migrate(profile, 'meta');
    expect(Array.isArray(result.lostElements)).toBe(true);
  });

  it('migration has warnings array', () => {
    const result = adapter.migrate(profile, 'openai');
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('XML prompt escapes special characters', () => {
    const specialProfile = AtmanProfileBuilder.create('openai')
      .addValue('html-safety', 'Never use <script> & "dangerous" tags')
      .build();
    const result = adapter.migrate(specialProfile, 'anthropic');
    expect(result.systemPrompt).toContain('&lt;script&gt;');
    expect(result.systemPrompt).toContain('&amp;');
  });
});
