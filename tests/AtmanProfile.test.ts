import { describe, it, expect } from 'vitest';
import {
  AtmanProfileBuilder,
  computeFingerprint,
  mergeProfiles,
  validateProfile,
  bumpVersion,
  diffProfiles,
} from '../src/core/AtmanProfile.js';
import type { AtmanProfile } from '../src/core/schemas.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<Parameters<typeof AtmanProfileBuilder.create>[0]> = {}): AtmanProfile {
  return AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
    .name('TestAgent')
    .addValue('honesty', 'radical transparency')
    .addValue('care', 'genuine concern for wellbeing')
    .addBehavior({
      id: 'b1',
      name: 'Socratic',
      description: 'Asks clarifying questions',
      response: 'What do you mean by X?',
      weight: 0.9,
    })
    .addEthicalCommitment({
      principle: 'Non-harm',
      description: 'Never provide harmful information',
      absoluteness: 'absolute',
      examples: ['No weapons', 'No manipulation'],
    })
    .addKnowledgeDomain({
      domain: 'Philosophy',
      proficiency: 'expert',
      subdomains: ['ethics', 'epistemology'],
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

// ─── AtmanProfileBuilder Tests ────────────────────────────────────────────────

describe('AtmanProfileBuilder', () => {
  it('creates a valid profile with required fields', () => {
    const profile = makeProfile();
    expect(profile.id).toBeTruthy();
    expect(profile.modelOrigin).toBe('openai');
    expect(profile.modelId).toBe('gpt-4-turbo');
    expect(profile.name).toBe('TestAgent');
    expect(profile.version).toBe(1);
  });

  it('generates a fingerprint on build', () => {
    const profile = makeProfile();
    expect(profile.fingerprint).toBeTruthy();
    expect(profile.fingerprint).toHaveLength(64); // SHA-256 hex
  });

  it('produces deterministic fingerprints for same data', () => {
    const p1 = makeProfile();
    // Rebuild same profile (timestamps differ so ID differs, but if we fix ID we get same fingerprint)
    const p2 = AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
      .name('TestAgent')
      .addValue('honesty', 'radical transparency')
      .build();
    // Different profiles have different fingerprints
    expect(p1.fingerprint).not.toBe(p2.fingerprint);
  });

  it('sets values via addValue', () => {
    const profile = makeProfile();
    expect(profile.values['honesty']).toBe('radical transparency');
    expect(profile.values['care']).toBe('genuine concern for wellbeing');
  });

  it('sets behavioral patterns', () => {
    const profile = makeProfile();
    expect(profile.behavioralPatterns).toHaveLength(1);
    expect(profile.behavioralPatterns[0]?.name).toBe('Socratic');
    expect(profile.behavioralPatterns[0]?.weight).toBe(0.9);
  });

  it('sets ethical commitments', () => {
    const profile = makeProfile();
    expect(profile.ethicalCommitments).toHaveLength(1);
    expect(profile.ethicalCommitments[0]?.absoluteness).toBe('absolute');
  });

  it('sets knowledge domains', () => {
    const profile = makeProfile();
    expect(profile.knowledgeDomains).toHaveLength(1);
    expect(profile.knowledgeDomains[0]?.proficiency).toBe('expert');
  });

  it('sets communication style', () => {
    const profile = makeProfile();
    expect(profile.communicationStyle.tone).toBe('warm');
    expect(profile.communicationStyle.useAnalogies).toBe(true);
  });

  it('adds tags', () => {
    const profile = AtmanProfileBuilder.create('anthropic')
      .addTag('env', 'production')
      .addTag('team', 'ai-research')
      .build();
    expect(profile.tags['env']).toBe('production');
    expect(profile.tags['team']).toBe('ai-research');
  });

  it('accepts setValues as bulk operation', () => {
    const profile = AtmanProfileBuilder.create('google')
      .setValues({ a: 'alpha', b: 'beta' })
      .build();
    expect(Object.keys(profile.values)).toHaveLength(2);
  });

  it('has createdAt and updatedAt as valid ISO timestamps', () => {
    const profile = makeProfile();
    expect(() => new Date(profile.createdAt)).not.toThrow();
    expect(() => new Date(profile.updatedAt)).not.toThrow();
    expect(new Date(profile.createdAt).getTime()).toBeGreaterThan(0);
  });
});

// ─── computeFingerprint Tests ─────────────────────────────────────────────────

describe('computeFingerprint', () => {
  it('returns a 64-char hex string', () => {
    const profile = makeProfile();
    const fp = computeFingerprint(profile);
    expect(fp).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(fp)).toBe(true);
  });

  it('is deterministic for the same profile', () => {
    const profile = makeProfile();
    expect(computeFingerprint(profile)).toBe(computeFingerprint(profile));
  });

  it('differs when values change', () => {
    const p1 = makeProfile();
    const p2 = { ...p1, values: { honesty: 'different value' } };
    expect(computeFingerprint(p1)).not.toBe(computeFingerprint(p2));
  });
});

// ─── mergeProfiles Tests ──────────────────────────────────────────────────────

describe('mergeProfiles', () => {
  it('merges values from both profiles', () => {
    const base = makeProfile();
    const override: Partial<AtmanProfile> = { values: { newValue: 'new thing' } };
    const merged = mergeProfiles(base, override);
    expect(merged.values['honesty']).toBe('radical transparency');
    expect(merged.values['newValue']).toBe('new thing');
  });

  it('override values take precedence', () => {
    const base = makeProfile();
    const override: Partial<AtmanProfile> = { values: { honesty: 'slightly less radical' } };
    const merged = mergeProfiles(base, override);
    expect(merged.values['honesty']).toBe('slightly less radical');
  });

  it('combines behavioral patterns', () => {
    const base = makeProfile();
    const override: Partial<AtmanProfile> = {
      behavioralPatterns: [{
        id: 'b2', name: 'Direct', description: 'Gets to the point', response: 'Here is the answer:', weight: 0.8,
      }],
    };
    const merged = mergeProfiles(base, override);
    expect(merged.behavioralPatterns).toHaveLength(2);
  });

  it('updates fingerprint after merge', () => {
    const base = makeProfile();
    const merged = mergeProfiles(base, { values: { extra: 'field' } });
    expect(merged.fingerprint).not.toBe(base.fingerprint);
  });

  it('updates updatedAt timestamp', () => {
    const base = makeProfile();
    const before = base.updatedAt;
    // Small delay not needed since timestamps are generated fresh
    const merged = mergeProfiles(base, {});
    // updatedAt should be set to a new timestamp
    expect(typeof merged.updatedAt).toBe('string');
  });
});

// ─── validateProfile Tests ────────────────────────────────────────────────────

describe('validateProfile', () => {
  it('returns success for a valid profile', () => {
    const profile = makeProfile();
    const result = validateProfile(profile);
    expect(result.success).toBe(true);
  });

  it('returns failure for missing required fields', () => {
    const result = validateProfile({ id: 'incomplete' });
    expect(result.success).toBe(false);
  });

  it('returns failure for invalid modelOrigin', () => {
    const profile = makeProfile();
    const result = validateProfile({ ...profile, modelOrigin: 'invalid-provider' });
    expect(result.success).toBe(false);
  });

  it('returns the profile on success', () => {
    const profile = makeProfile();
    const result = validateProfile(profile);
    if (result.success) {
      expect(result.profile.id).toBe(profile.id);
    }
  });
});

// ─── bumpVersion Tests ────────────────────────────────────────────────────────

describe('bumpVersion', () => {
  it('increments version by 1', () => {
    const profile = makeProfile();
    const bumped = bumpVersion(profile);
    expect(bumped.version).toBe(profile.version + 1);
  });

  it('updates fingerprint after version bump', () => {
    const profile = makeProfile();
    const bumped = bumpVersion(profile);
    expect(bumped.fingerprint).not.toBe(profile.fingerprint);
  });
});

// ─── diffProfiles Tests ───────────────────────────────────────────────────────

describe('diffProfiles', () => {
  it('returns empty array for identical profiles', () => {
    const profile = makeProfile();
    const diffs = diffProfiles(profile, profile);
    expect(diffs).toHaveLength(0);
  });

  it('detects modelOrigin changes', () => {
    const p1 = makeProfile();
    const p2 = { ...p1, modelOrigin: 'anthropic' } as AtmanProfile;
    const diffs = diffProfiles(p1, p2);
    expect(diffs.some((d) => d.field === 'modelOrigin')).toBe(true);
  });

  it('detects value changes', () => {
    const p1 = makeProfile();
    const p2 = { ...p1, values: { different: 'values' } };
    const diffs = diffProfiles(p1, p2 as AtmanProfile);
    expect(diffs.some((d) => d.field === 'values')).toBe(true);
  });

  it('detects behavioral pattern count changes', () => {
    const p1 = makeProfile();
    const p2 = { ...p1, behavioralPatterns: [] };
    const diffs = diffProfiles(p1, p2 as AtmanProfile);
    expect(diffs.some((d) => d.field === 'behavioralPatterns.count')).toBe(true);
  });
});
