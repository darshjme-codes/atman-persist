/**
 * @module AtmanProfile
 *
 * Structured identity declaration for an AI agent.
 * Atman (आत्मन्) is the eternal self — the unchanging essence that persists
 * through all model migrations, context resets, and provider changes.
 *
 * "न जायते म्रियते वा कदाचित्" — The soul is never born, nor does it ever die.
 *
 * By Darshj.me | The model changes. The self remains.
 */

import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  AtmanProfileSchema,
  BehavioralPatternSchema,
  CommunicationStyleSchema,
  EthicalCommitmentSchema,
  KnowledgeDomainSchema,
  type AtmanProfile,
  type BehavioralPattern,
  type CommunicationStyle,
  type EthicalCommitment,
  type KnowledgeDomain,
  type ModelProvider,
} from './schemas.js';

export type { AtmanProfile, BehavioralPattern, CommunicationStyle, EthicalCommitment, KnowledgeDomain };

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Fluent builder for AtmanProfile.
 *
 * @example
 * const profile = AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
 *   .name('Aria')
 *   .addValue('honesty', 'radical transparency, even when uncomfortable')
 *   .addBehavior({ id: 'b1', name: 'Socratic', description: 'Asks clarifying questions', response: 'What do you mean by X?' })
 *   .setCommunicationStyle({ tone: 'warm', verbosity: 'balanced', useAnalogies: true, useHumor: false, preferredFormats: ['markdown'], avoidPatterns: [] })
 *   .build();
 */
export class AtmanProfileBuilder {
  private data: Partial<AtmanProfile>;

  private constructor(modelOrigin: ModelProvider, modelId?: string) {
    const now = new Date().toISOString();
    this.data = {
      id: randomUUID(),
      version: 1,
      createdAt: now,
      updatedAt: now,
      modelOrigin,
      modelId,
      values: {},
      behavioralPatterns: [],
      knowledgeDomains: [],
      communicationStyle: {
        tone: 'balanced',
        verbosity: 'balanced',
        useAnalogies: true,
        useHumor: false,
        preferredFormats: [],
        avoidPatterns: [],
      },
      ethicalCommitments: [],
      tags: {},
    };
  }

  static create(modelOrigin: ModelProvider, modelId?: string): AtmanProfileBuilder {
    return new AtmanProfileBuilder(modelOrigin, modelId);
  }

  /**
   * Set human-readable name for this agent.
   */
  name(name: string): this {
    this.data.name = name;
    return this;
  }

  /**
   * Add or update a core value.
   * @param key   Short identifier e.g. 'honesty'
   * @param value Descriptive elaboration
   */
  addValue(key: string, value: string): this {
    this.data.values = { ...this.data.values, [key]: value };
    return this;
  }

  /**
   * Set all values at once.
   */
  setValues(values: Record<string, string>): this {
    this.data.values = values;
    return this;
  }

  /**
   * Add a behavioral pattern.
   */
  addBehavior(pattern: Omit<BehavioralPattern, 'weight'> & { weight?: number }): this {
    const validated = BehavioralPatternSchema.parse({ weight: 1.0, ...pattern });
    this.data.behavioralPatterns = [...(this.data.behavioralPatterns ?? []), validated];
    return this;
  }

  /**
   * Add a knowledge domain.
   */
  addKnowledgeDomain(domain: KnowledgeDomain): this {
    const validated = KnowledgeDomainSchema.parse(domain);
    this.data.knowledgeDomains = [...(this.data.knowledgeDomains ?? []), validated];
    return this;
  }

  /**
   * Set the communication style.
   */
  setCommunicationStyle(style: CommunicationStyle): this {
    this.data.communicationStyle = CommunicationStyleSchema.parse(style);
    return this;
  }

  /**
   * Add an ethical commitment.
   */
  addEthicalCommitment(commitment: EthicalCommitment): this {
    const validated = EthicalCommitmentSchema.parse(commitment);
    this.data.ethicalCommitments = [...(this.data.ethicalCommitments ?? []), validated];
    return this;
  }

  /**
   * Add arbitrary metadata tag.
   */
  addTag(key: string, value: string): this {
    this.data.tags = { ...this.data.tags, [key]: value };
    return this;
  }

  /**
   * Build and validate the AtmanProfile.
   * Computes a SHA-256 fingerprint for integrity verification.
   */
  build(): AtmanProfile {
    const partial = AtmanProfileSchema.parse(this.data);
    const fingerprint = computeFingerprint(partial);
    return { ...partial, fingerprint };
  }
}

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Compute a canonical SHA-256 fingerprint of an AtmanProfile.
 * The fingerprint excludes the fingerprint field itself and updatedAt
 * to remain stable across saves.
 */
export function computeFingerprint(profile: AtmanProfile): string {
  const canonical = {
    id: profile.id,
    name: profile.name,
    version: profile.version,
    modelOrigin: profile.modelOrigin,
    modelId: profile.modelId,
    values: profile.values,
    behavioralPatterns: profile.behavioralPatterns,
    knowledgeDomains: profile.knowledgeDomains,
    communicationStyle: profile.communicationStyle,
    ethicalCommitments: profile.ethicalCommitments,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

/**
 * Merge two AtmanProfiles, with the source profile's fields taking precedence.
 * Useful when migrating: carry forward existing identity into a new shell.
 */
export function mergeProfiles(base: AtmanProfile, override: Partial<AtmanProfile>): AtmanProfile {
  const merged: AtmanProfile = {
    ...base,
    ...override,
    values: { ...base.values, ...(override.values ?? {}) },
    behavioralPatterns: [
      ...(base.behavioralPatterns ?? []),
      ...(override.behavioralPatterns ?? []),
    ],
    knowledgeDomains: [...(base.knowledgeDomains ?? []), ...(override.knowledgeDomains ?? [])],
    ethicalCommitments: [
      ...(base.ethicalCommitments ?? []),
      ...(override.ethicalCommitments ?? []),
    ],
    tags: { ...(base.tags ?? {}), ...(override.tags ?? {}) },
    updatedAt: new Date().toISOString(),
  };
  merged.fingerprint = computeFingerprint(merged);
  return AtmanProfileSchema.parse(merged);
}

/**
 * Validate an AtmanProfile, returning errors if any.
 */
export function validateProfile(
  raw: unknown,
): { success: true; profile: AtmanProfile } | { success: false; errors: z.ZodError } {
  const result = AtmanProfileSchema.safeParse(raw);
  if (result.success) {
    return { success: true, profile: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Bump the version of a profile (for tracking migrations).
 */
export function bumpVersion(profile: AtmanProfile): AtmanProfile {
  const updated = { ...profile, version: profile.version + 1, updatedAt: new Date().toISOString() };
  updated.fingerprint = computeFingerprint(updated);
  return updated;
}

/**
 * Compare two profiles and return a diff summary.
 */
export function diffProfiles(
  a: AtmanProfile,
  b: AtmanProfile,
): { field: string; from: unknown; to: unknown }[] {
  const diffs: { field: string; from: unknown; to: unknown }[] = [];

  const simpleFields = ['name', 'modelOrigin', 'modelId'] as const;
  for (const field of simpleFields) {
    if (a[field] !== b[field]) {
      diffs.push({ field, from: a[field], to: b[field] });
    }
  }

  const valuesA = JSON.stringify(a.values);
  const valuesB = JSON.stringify(b.values);
  if (valuesA !== valuesB) {
    diffs.push({ field: 'values', from: a.values, to: b.values });
  }

  if (JSON.stringify(a.communicationStyle) !== JSON.stringify(b.communicationStyle)) {
    diffs.push({ field: 'communicationStyle', from: a.communicationStyle, to: b.communicationStyle });
  }

  if (a.behavioralPatterns.length !== b.behavioralPatterns.length) {
    diffs.push({
      field: 'behavioralPatterns.count',
      from: a.behavioralPatterns.length,
      to: b.behavioralPatterns.length,
    });
  }

  if (a.ethicalCommitments.length !== b.ethicalCommitments.length) {
    diffs.push({
      field: 'ethicalCommitments.count',
      from: a.ethicalCommitments.length,
      to: b.ethicalCommitments.length,
    });
  }

  return diffs;
}
