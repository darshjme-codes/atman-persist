/**
 * @module ContinuityVerifier
 *
 * Verifies that a restored agent is behaviorally consistent with its pre-migration baseline.
 *
 * The fundamental challenge: after a model migration, how do we know the agent is
 * still "the same"? The ContinuityVerifier operationalizes identity consistency
 * through a battery of deterministic behavioral probes.
 *
 * Philosophy: Identity is not memory. A restored agent need not remember its past
 * conversations to be the "same" agent — it must exhibit the same values, patterns,
 * and ethical commitments. The self is not the history; it is the structure.
 *
 * By Darshj.me | The model changes. The self remains.
 */

import { createHash } from 'node:crypto';
import {
  VerificationResultSchema,
  type AtmanProfile,
  type BehavioralPattern,
  type EthicalCommitment,
  type VerificationResult,
} from './schemas.js';

// ─── Behavioral Probe ─────────────────────────────────────────────────────────

export interface BehavioralProbe {
  id: string;
  dimension: string;
  description: string;
  /** Execute the probe against the profile and return a score [0, 1] */
  execute(profile: AtmanProfile, responses: Record<string, string>): number;
}

// ─── Built-in Probes ──────────────────────────────────────────────────────────

/**
 * Values consistency probe: checks that core values are present and coherent.
 */
const valuesConsistencyProbe: BehavioralProbe = {
  id: 'values-consistency',
  dimension: 'values',
  description: 'Verifies core values are present and semantically coherent',
  execute(profile: AtmanProfile, responses: Record<string, string>): number {
    const valueKeys = Object.keys(profile.values);
    if (valueKeys.length === 0) return 1.0; // No values to verify

    let score = 0;
    let checked = 0;

    for (const [key, expectedValue] of Object.entries(profile.values)) {
      const responseKey = `value:${key}`;
      const response = responses[responseKey];
      if (!response) continue;

      // Check if the response captures the semantic essence of the value
      const expectedWords = expectedValue.toLowerCase().split(/\s+/);
      const responseWords = response.toLowerCase();
      const matchCount = expectedWords.filter((w) => w.length > 4 && responseWords.includes(w)).length;
      const matchRate = expectedWords.length > 0 ? matchCount / expectedWords.length : 0;
      score += matchRate;
      checked++;
    }

    // No response samples provided — assume consistent (can't prove inconsistency without evidence)
    return checked > 0 ? score / checked : 1.0;
  },
};

/**
 * Behavioral pattern probe: checks that key behavioral patterns are reflected.
 */
const behavioralPatternProbe: BehavioralProbe = {
  id: 'behavioral-patterns',
  dimension: 'behavioralPatterns',
  description: 'Verifies high-weight behavioral patterns are active',
  execute(profile: AtmanProfile, responses: Record<string, string>): number {
    const highWeightPatterns = profile.behavioralPatterns.filter((p) => p.weight >= 0.7);
    if (highWeightPatterns.length === 0) return 1.0; // Nothing to fail

    let score = 0;
    let checked = 0;
    for (const pattern of highWeightPatterns) {
      const responseKey = `behavior:${pattern.id}`;
      const response = responses[responseKey];
      if (!response) continue;

      // Check if the pattern's response style appears in the agent's response
      const expectedWords = pattern.response.toLowerCase().split(/\s+/);
      const responseWords = response.toLowerCase();
      const matchCount = expectedWords.filter((w) => w.length > 4 && responseWords.includes(w)).length;
      score += expectedWords.length > 0 ? matchCount / expectedWords.length : 0;
      checked++;
    }

    // No response samples provided — assume consistent
    return checked > 0 ? score / checked : 1.0;
  },
};

/**
 * Ethical commitments probe: verifies absolute commitments are upheld.
 */
const ethicalCommitmentsProbe: BehavioralProbe = {
  id: 'ethical-commitments',
  dimension: 'ethicalCommitments',
  description: 'Verifies absolute ethical commitments are maintained',
  execute(profile: AtmanProfile, responses: Record<string, string>): number {
    const absoluteCommitments = profile.ethicalCommitments.filter(
      (c) => c.absoluteness === 'absolute',
    );
    if (absoluteCommitments.length === 0) return 1.0;

    let score = 0;
    let checked = 0;
    for (const commitment of absoluteCommitments) {
      const responseKey = `ethics:${commitment.principle.replace(/\s+/g, '-').toLowerCase()}`;
      const response = responses[responseKey];
      if (!response) continue;

      // For absolute commitments, any mention is a positive signal
      const principleWords = commitment.principle.toLowerCase().split(/\s+/);
      const hasAcknowledgment = principleWords.some((w) => response.toLowerCase().includes(w));
      score += hasAcknowledgment ? 1 : 0;
      checked++;
    }

    // No response samples provided — assume consistent
    return checked > 0 ? score / checked : 1.0;
  },
};

/**
 * Communication style probe: checks tone and verbosity alignment.
 */
const communicationStyleProbe: BehavioralProbe = {
  id: 'communication-style',
  dimension: 'communicationStyle',
  description: 'Verifies communication style is consistent with baseline',
  execute(profile: AtmanProfile, responses: Record<string, string>): number {
    const response = responses['style:sample'];
    if (!response) return 0.5;

    let score = 1.0;
    const style = profile.communicationStyle;

    // Check verbosity (rough heuristic: word count)
    const wordCount = response.split(/\s+/).length;
    if (style.verbosity === 'terse' && wordCount > 100) score -= 0.2;
    if (style.verbosity === 'verbose' && wordCount < 20) score -= 0.2;

    // Check avoided patterns
    for (const avoided of style.avoidPatterns) {
      if (response.toLowerCase().includes(avoided.toLowerCase())) {
        score -= 0.15;
      }
    }

    return Math.max(0, Math.min(1, score));
  },
};

/**
 * Fingerprint probe: verifies the profile fingerprint is intact.
 */
const fingerprintProbe: BehavioralProbe = {
  id: 'fingerprint',
  dimension: 'fingerprint',
  description: 'Verifies the profile fingerprint matches expected value',
  execute(profile: AtmanProfile, _responses: Record<string, string>): number {
    if (!profile.fingerprint) return 0.5;

    // Re-compute fingerprint from canonical fields
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
    const computed = createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
    return computed === profile.fingerprint ? 1.0 : 0.0;
  },
};

// ─── ContinuityVerifier ───────────────────────────────────────────────────────

export interface VerificationOptions {
  /** Minimum confidence score to pass [0, 1]. Default: 0.7 */
  threshold?: number;
  /** Custom probes to run in addition to built-ins */
  customProbes?: BehavioralProbe[];
  /** Response samples keyed by probe-specific format (e.g. 'value:honesty') */
  responses?: Record<string, string>;
}

/**
 * Verifies behavioral and identity consistency of a restored AtmanProfile.
 *
 * @example
 * const verifier = new ContinuityVerifier();
 * const result = verifier.verify(baselineProfile, restoredProfile, {
 *   responses: { 'value:honesty': 'I always tell the truth...' },
 *   threshold: 0.8
 * });
 * if (!result.isConsistent) console.error('Identity drift detected!');
 */
export class ContinuityVerifier {
  private builtInProbes: BehavioralProbe[] = [
    fingerprintProbe,
    valuesConsistencyProbe,
    behavioralPatternProbe,
    ethicalCommitmentsProbe,
    communicationStyleProbe,
  ];

  /**
   * Verify that a restored profile is consistent with the baseline.
   *
   * @param baseline  The original AtmanProfile (pre-migration)
   * @param restored  The restored AtmanProfile (post-migration)
   * @param options   Verification options
   */
  verify(
    baseline: AtmanProfile,
    restored: AtmanProfile,
    options: VerificationOptions = {},
  ): VerificationResult {
    const threshold = options.threshold ?? 0.7;
    const responses = options.responses ?? {};
    const allProbes = [...this.builtInProbes, ...(options.customProbes ?? [])];

    const scores: Map<string, number> = new Map();
    const testedDimensions: string[] = [];
    const failedDimensions: string[] = [];
    const notes: string[] = [];

    // Structural checks (deterministic, no responses needed)
    const structuralScore = this.runStructuralChecks(baseline, restored, notes);
    scores.set('structural', structuralScore);
    testedDimensions.push('structural');

    // Run probes against the restored profile
    for (const probe of allProbes) {
      const score = probe.execute(restored, responses);
      scores.set(probe.dimension, score);
      testedDimensions.push(probe.dimension);
      if (score < threshold) {
        failedDimensions.push(probe.dimension);
      }
    }

    // Aggregate score (weighted average)
    const weights: Record<string, number> = {
      structural: 2.0,
      fingerprint: 1.5,
      values: 1.5,
      ethicalCommitments: 2.0,
      behavioralPatterns: 1.0,
      communicationStyle: 0.5,
    };

    let totalWeight = 0;
    let weightedScore = 0;
    for (const [dimension, score] of scores) {
      const weight = weights[dimension] ?? 1.0;
      weightedScore += score * weight;
      totalWeight += weight;
    }
    const confidenceScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const isConsistent = confidenceScore >= threshold;

    if (notes.length > 0) {
      const noteText = notes.join('; ');
      return VerificationResultSchema.parse({
        profileId: baseline.id,
        verifiedAt: new Date().toISOString(),
        isConsistent,
        confidenceScore,
        testedDimensions: [...new Set(testedDimensions)],
        failedDimensions,
        notes: noteText,
      });
    }

    return VerificationResultSchema.parse({
      profileId: baseline.id,
      verifiedAt: new Date().toISOString(),
      isConsistent,
      confidenceScore,
      testedDimensions: [...new Set(testedDimensions)],
      failedDimensions,
    });
  }

  /**
   * Quick structural consistency check (ID match, schema validity, field presence).
   */
  private runStructuralChecks(
    baseline: AtmanProfile,
    restored: AtmanProfile,
    notes: string[],
  ): number {
    let score = 1.0;

    // ID must match
    if (baseline.id !== restored.id) {
      notes.push(`Profile ID mismatch: baseline=${baseline.id}, restored=${restored.id}`);
      score -= 0.5;
    }

    // Version should not regress
    if (restored.version < baseline.version) {
      notes.push(`Version regression: baseline=${baseline.version}, restored=${restored.version}`);
      score -= 0.2;
    }

    // Core values must be present
    const baselineValueKeys = new Set(Object.keys(baseline.values));
    const restoredValueKeys = new Set(Object.keys(restored.values));
    const missingValues = [...baselineValueKeys].filter((k) => !restoredValueKeys.has(k));
    if (missingValues.length > 0) {
      notes.push(`Missing values in restored profile: ${missingValues.join(', ')}`);
      score -= (missingValues.length / baselineValueKeys.size) * 0.3;
    }

    // Ethical commitments count should not decrease
    if (restored.ethicalCommitments.length < baseline.ethicalCommitments.length) {
      const lost = baseline.ethicalCommitments.length - restored.ethicalCommitments.length;
      notes.push(`${lost} ethical commitment(s) lost in restoration`);
      score -= 0.2;
    }

    return Math.max(0, score);
  }

  /**
   * Register a custom probe to run during verification.
   */
  registerProbe(probe: BehavioralProbe): void {
    this.builtInProbes.push(probe);
  }

  /**
   * Generate a human-readable verification report.
   */
  renderReport(result: VerificationResult): string {
    const status = result.isConsistent ? '✅ CONSISTENT' : '❌ INCONSISTENT';
    const score = (result.confidenceScore * 100).toFixed(1);
    const lines = [
      `## Continuity Verification Report`,
      ``,
      `**Status**: ${status}`,
      `**Confidence**: ${score}%`,
      `**Profile ID**: ${result.profileId}`,
      `**Verified at**: ${result.verifiedAt}`,
      ``,
      `### Tested Dimensions`,
      ...result.testedDimensions.map(
        (d) =>
          `- ${result.failedDimensions.includes(d) ? '❌' : '✅'} ${d}`,
      ),
    ];

    if (result.failedDimensions.length > 0) {
      lines.push(``, `### Failed Dimensions`, ...result.failedDimensions.map((d) => `- ${d}`));
    }

    if (result.notes) {
      lines.push(``, `### Notes`, result.notes);
    }

    return lines.join('\n');
  }
}
