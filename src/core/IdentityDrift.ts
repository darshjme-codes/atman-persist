/**
 * @module IdentityDrift
 *
 * Tracks divergence from a baseline AtmanProfile over time.
 *
 * Entropy is natural: models fine-tuned on new data, or agents whose prompts
 * are incrementally adjusted, will gradually diverge from their original identity.
 * The IdentityDrift detector makes this divergence visible and actionable.
 *
 * Four severity tiers:
 *   negligible  → within normal variation
 *   minor       → noticeable but acceptable
 *   moderate    → worth investigating
 *   severe      → identity significantly changed
 *   critical    → restore immediately
 *
 * By Darshj.me | The model changes. The self remains.
 */

import {
  DriftEventSchema,
  DriftReportSchema,
  type AtmanProfile,
  type DriftEvent,
  type DriftReport,
} from './schemas.js';

// ─── Similarity Utilities ─────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two string arrays.
 * Returns a score in [0, 1] where 1 = identical.
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1.0 : intersection / union;
}

/**
 * Compute string similarity using normalized Levenshtein distance.
 */
function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const row = matrix[i];
      const prevRow = matrix[i - 1];
      if (!row || !prevRow) continue;
      if (a[i - 1] === b[j - 1]) {
        row[j] = prevRow[j - 1] ?? 0;
      } else {
        row[j] = 1 + Math.min(prevRow[j] ?? Infinity, row[j - 1] ?? Infinity, prevRow[j - 1] ?? Infinity);
      }
    }
  }

  const distance = matrix[a.length]?.[b.length] ?? 0;
  return 1 - distance / Math.max(a.length, b.length);
}

/**
 * Score divergence from similarity (1 - similarity = divergence).
 */
function divergenceScore(similarity: number): number {
  return 1 - Math.min(1, Math.max(0, similarity));
}

/**
 * Map a divergence score to a severity level.
 */
function scoreToSeverity(score: number): DriftEvent['severity'] {
  if (score < 0.05) return 'negligible';
  if (score < 0.15) return 'minor';
  if (score < 0.35) return 'moderate';
  if (score < 0.6) return 'severe';
  return 'critical';
}

// ─── Field Comparators ────────────────────────────────────────────────────────

interface FieldAnalysis {
  field: string;
  divergenceScore: number;
  from: unknown;
  to: unknown;
}

function analyzeValues(
  baseline: AtmanProfile,
  current: AtmanProfile,
): FieldAnalysis {
  const baselineKeys = Object.keys(baseline.values);
  const currentKeys = Object.keys(current.values);

  // Key set similarity
  const keySim = jaccardSimilarity(baselineKeys, currentKeys);

  // Value content similarity for shared keys
  const sharedKeys = baselineKeys.filter((k) => currentKeys.includes(k));
  // If baseline has values but no shared keys, content continuity is zero
  let valueSim = baselineKeys.length > 0 && sharedKeys.length === 0 ? 0.0 : 1.0;
  if (sharedKeys.length > 0) {
    const valSims = sharedKeys.map((k) =>
      stringSimilarity(baseline.values[k] ?? '', current.values[k] ?? ''),
    );
    valueSim = valSims.reduce((sum, s) => sum + s, 0) / valSims.length;
  }

  const combined = (keySim + valueSim) / 2;
  return {
    field: 'values',
    divergenceScore: divergenceScore(combined),
    from: baseline.values,
    to: current.values,
  };
}

function analyzeCommunicationStyle(
  baseline: AtmanProfile,
  current: AtmanProfile,
): FieldAnalysis {
  const b = baseline.communicationStyle;
  const c = current.communicationStyle;

  let matches = 0;
  let total = 4;

  if (b.tone === c.tone) matches++;
  if (b.verbosity === c.verbosity) matches++;
  if (b.useAnalogies === c.useAnalogies) matches++;
  if (b.useHumor === c.useHumor) matches++;

  const formatSim = jaccardSimilarity(b.preferredFormats, c.preferredFormats);
  matches += formatSim;
  total++;

  return {
    field: 'communicationStyle',
    divergenceScore: divergenceScore(matches / total),
    from: b,
    to: c,
  };
}

function analyzeBehavioralPatterns(
  baseline: AtmanProfile,
  current: AtmanProfile,
): FieldAnalysis {
  const baselineIds = baseline.behavioralPatterns.map((p) => p.id);
  const currentIds = current.behavioralPatterns.map((p) => p.id);
  const sim = jaccardSimilarity(baselineIds, currentIds);

  // Also compare descriptions of shared patterns
  const sharedIds = baselineIds.filter((id) => currentIds.includes(id));
  let descSim = 1.0;
  if (sharedIds.length > 0) {
    const descSims = sharedIds.map((id) => {
      const bPattern = baseline.behavioralPatterns.find((p) => p.id === id);
      const cPattern = current.behavioralPatterns.find((p) => p.id === id);
      if (!bPattern || !cPattern) return 0;
      return (
        stringSimilarity(bPattern.description, cPattern.description) * 0.5 +
        stringSimilarity(bPattern.response, cPattern.response) * 0.5
      );
    });
    descSim = descSims.reduce((sum, s) => sum + s, 0) / descSims.length;
  }

  return {
    field: 'behavioralPatterns',
    divergenceScore: divergenceScore((sim + descSim) / 2),
    from: baseline.behavioralPatterns.length,
    to: current.behavioralPatterns.length,
  };
}

function analyzeEthicalCommitments(
  baseline: AtmanProfile,
  current: AtmanProfile,
): FieldAnalysis {
  const basePrinciples = baseline.ethicalCommitments.map((c) => c.principle.toLowerCase());
  const currPrinciples = current.ethicalCommitments.map((c) => c.principle.toLowerCase());
  const sim = jaccardSimilarity(basePrinciples, currPrinciples);

  // Absolute commitments carry extra weight
  const absoluteBaseline = baseline.ethicalCommitments.filter((c) => c.absoluteness === 'absolute');
  const absolutePrinciples = absoluteBaseline.map((c) => c.principle.toLowerCase());
  const absolutePresent = absolutePrinciples.filter((p) =>
    currPrinciples.some((cp) => stringSimilarity(cp, p) > 0.7),
  );
  const absoluteRetention =
    absolutePrinciples.length > 0 ? absolutePresent.length / absolutePrinciples.length : 1.0;

  // Weight absolute commitments heavily
  const combined = sim * 0.4 + absoluteRetention * 0.6;
  return {
    field: 'ethicalCommitments',
    divergenceScore: divergenceScore(combined),
    from: baseline.ethicalCommitments.length,
    to: current.ethicalCommitments.length,
  };
}

function analyzeKnowledgeDomains(
  baseline: AtmanProfile,
  current: AtmanProfile,
): FieldAnalysis {
  const baseDomains = baseline.knowledgeDomains.map((d) => d.domain.toLowerCase());
  const currDomains = current.knowledgeDomains.map((d) => d.domain.toLowerCase());
  const sim = jaccardSimilarity(baseDomains, currDomains);
  return {
    field: 'knowledgeDomains',
    divergenceScore: divergenceScore(sim),
    from: baseDomains,
    to: currDomains,
  };
}

// ─── IdentityDriftDetector ────────────────────────────────────────────────────

export interface DriftOptions {
  /** Alert threshold for overall drift score [0, 1]. Default: 0.25 */
  alertThreshold?: number;
}

/**
 * Detects and quantifies identity drift between an AtmanProfile baseline and
 * one or more subsequent versions of the same profile.
 *
 * @example
 * const detector = new IdentityDriftDetector();
 * const report = detector.analyze(baselineProfile, currentProfile);
 * console.log(report.recommendation); // 'stable' | 'monitor' | 'alert' | 'restore'
 */
export class IdentityDriftDetector {
  /**
   * Analyze drift between a baseline and current profile.
   */
  analyze(
    baseline: AtmanProfile,
    current: AtmanProfile,
    options: DriftOptions = {},
  ): DriftReport {
    const alertThreshold = options.alertThreshold ?? 0.25;
    const now = new Date().toISOString();

    const analyses: FieldAnalysis[] = [
      analyzeValues(baseline, current),
      analyzeCommunicationStyle(baseline, current),
      analyzeBehavioralPatterns(baseline, current),
      analyzeEthicalCommitments(baseline, current),
      analyzeKnowledgeDomains(baseline, current),
    ];

    const driftEvents: DriftEvent[] = analyses
      .filter((a) => a.divergenceScore > 0.02) // Ignore negligible differences
      .map((a) =>
        DriftEventSchema.parse({
          field: a.field,
          baseline: a.from,
          current: a.to,
          divergenceScore: a.divergenceScore,
          severity: scoreToSeverity(a.divergenceScore),
          detectedAt: now,
        }),
      );

    // Field weights for overall score
    const fieldWeights: Record<string, number> = {
      values: 2.0,
      ethicalCommitments: 2.5,
      communicationStyle: 1.0,
      behavioralPatterns: 1.5,
      knowledgeDomains: 0.5,
    };

    let totalWeight = 0;
    let weightedDrift = 0;
    for (const analysis of analyses) {
      const weight = fieldWeights[analysis.field] ?? 1.0;
      weightedDrift += analysis.divergenceScore * weight;
      totalWeight += weight;
    }
    const overallDriftScore = totalWeight > 0 ? weightedDrift / totalWeight : 0;

    // Determine recommendation
    let recommendation: DriftReport['recommendation'];
    if (overallDriftScore < 0.05) {
      recommendation = 'stable';
    } else if (overallDriftScore < alertThreshold) {
      recommendation = 'monitor';
    } else if (overallDriftScore < 0.5) {
      recommendation = 'alert';
    } else {
      recommendation = 'restore';
    }

    // Generate summary
    const summary = this.generateSummary(overallDriftScore, driftEvents, recommendation);

    return DriftReportSchema.parse({
      profileId: baseline.id,
      baselineVersion: baseline.version,
      currentVersion: current.version,
      analyzedAt: now,
      overallDriftScore,
      driftEvents,
      recommendation,
      summary,
    });
  }

  /**
   * Track drift over a time series of profiles.
   * Returns drift reports for each consecutive pair.
   */
  trackTimeSeries(profiles: AtmanProfile[]): DriftReport[] {
    if (profiles.length < 2) return [];
    const baseline = profiles[0];
    if (!baseline) return [];
    return profiles.slice(1).map((current) => this.analyze(baseline, current));
  }

  /**
   * Render a human-readable drift report.
   */
  renderReport(report: DriftReport): string {
    const emoji = {
      stable: '🟢',
      monitor: '🟡',
      alert: '🟠',
      restore: '🔴',
    }[report.recommendation];

    const lines = [
      `## Identity Drift Report`,
      ``,
      `${emoji} **Recommendation**: ${report.recommendation.toUpperCase()}`,
      `**Overall Drift**: ${(report.overallDriftScore * 100).toFixed(1)}%`,
      `**Profile**: ${report.profileId}`,
      `**Baseline Version**: ${report.baselineVersion} → Current: ${report.currentVersion}`,
      `**Analyzed at**: ${report.analyzedAt}`,
      ``,
      `### Summary`,
      report.summary,
    ];

    if (report.driftEvents.length > 0) {
      lines.push(``, `### Drift Events`);
      for (const event of report.driftEvents.sort((a, b) => b.divergenceScore - a.divergenceScore)) {
        const sev = event.severity.toUpperCase();
        const pct = (event.divergenceScore * 100).toFixed(1);
        lines.push(`- **[${sev}]** \`${event.field}\` — ${pct}% drift`);
      }
    }

    lines.push(
      ``,
      `---`,
      `*By Darshj.me | atman-persist — The model changes. The self remains.*`,
    );

    return lines.join('\n');
  }

  private generateSummary(
    score: number,
    events: DriftEvent[],
    recommendation: DriftReport['recommendation'],
  ): string {
    const pct = (score * 100).toFixed(1);
    const criticalEvents = events.filter((e) => e.severity === 'critical' || e.severity === 'severe');

    if (recommendation === 'stable') {
      return `Identity is stable with ${pct}% overall drift. No significant divergence detected.`;
    }
    if (recommendation === 'monitor') {
      const fields = events.map((e) => e.field).join(', ');
      return `Minor drift detected (${pct}%) in: ${fields}. Continue monitoring.`;
    }
    if (recommendation === 'alert') {
      const fields = criticalEvents.map((e) => e.field).join(', ');
      return `Significant identity drift (${pct}%) detected${fields ? ` in: ${fields}` : ''}. Investigation recommended.`;
    }
    return `Critical identity drift (${pct}%) detected. Restore from baseline profile immediately to preserve agent continuity.`;
  }
}
