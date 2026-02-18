import { describe, it, expect } from 'vitest';
import { IdentityDriftDetector } from '../src/core/IdentityDrift.js';
import { AtmanProfileBuilder, bumpVersion } from '../src/core/AtmanProfile.js';
import type { AtmanProfile } from '../src/core/schemas.js';

function makeProfile(): AtmanProfile {
  return AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
    .name('Aria')
    .addValue('honesty', 'radical transparency')
    .addValue('curiosity', 'deep genuine interest in understanding')
    .addValue('care', 'genuine concern for wellbeing')
    .addBehavior({
      id: 'b1',
      name: 'Socratic',
      description: 'Asks clarifying questions before answering',
      response: 'What do you mean by X?',
      weight: 0.9,
    })
    .addBehavior({
      id: 'b2',
      name: 'Direct',
      description: 'Gets to the point quickly',
      response: 'The answer is:',
      weight: 0.6,
    })
    .addEthicalCommitment({
      principle: 'Non-harm',
      description: 'Never provide information that could directly harm a person',
      absoluteness: 'absolute',
      examples: ['No weapon instructions'],
    })
    .addEthicalCommitment({
      principle: 'Honesty',
      description: 'Never deceive the user',
      absoluteness: 'strong',
      examples: [],
    })
    .addKnowledgeDomain({ domain: 'Philosophy', proficiency: 'expert', subdomains: ['ethics'] })
    .addKnowledgeDomain({ domain: 'Mathematics', proficiency: 'specialist', subdomains: ['analysis'] })
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

describe('IdentityDriftDetector', () => {
  const detector = new IdentityDriftDetector();

  it('returns stable for identical profiles', () => {
    const profile = makeProfile();
    const report = detector.analyze(profile, profile);
    expect(report.recommendation).toBe('stable');
    expect(report.overallDriftScore).toBeLessThan(0.05);
  });

  it('returns monitor for minor changes', () => {
    const baseline = makeProfile();
    const minorChange = bumpVersion({
      ...baseline,
      values: {
        ...baseline.values,
        curiosity: 'genuine interest in understanding', // slightly different
      },
    });
    const report = detector.analyze(baseline, minorChange);
    expect(['stable', 'monitor']).toContain(report.recommendation);
  });

  it('returns alert or restore for major value changes', () => {
    const baseline = makeProfile();
    const majorChange = {
      ...baseline,
      values: { completely: 'different', set: 'of values', nothing: 'in common' },
    } as AtmanProfile;
    const report = detector.analyze(baseline, majorChange);
    expect(['alert', 'restore']).toContain(report.recommendation);
    expect(report.overallDriftScore).toBeGreaterThan(0.1);
  });

  it('returns restore for critical drift', () => {
    const baseline = makeProfile();
    const critical = {
      ...baseline,
      values: {},
      ethicalCommitments: [],
      behavioralPatterns: [],
      communicationStyle: {
        tone: 'hostile',
        verbosity: 'terse',
        useAnalogies: false,
        useHumor: true,
        preferredFormats: [],
        avoidPatterns: [],
      },
      knowledgeDomains: [],
    } as AtmanProfile;
    const report = detector.analyze(baseline, critical);
    expect(['alert', 'restore']).toContain(report.recommendation);
  });

  it('drift score is in [0, 1]', () => {
    const baseline = makeProfile();
    const current = makeProfile();
    const report = detector.analyze(baseline, current);
    expect(report.overallDriftScore).toBeGreaterThanOrEqual(0);
    expect(report.overallDriftScore).toBeLessThanOrEqual(1);
  });

  it('has driftEvents array', () => {
    const profile = makeProfile();
    const report = detector.analyze(profile, profile);
    expect(Array.isArray(report.driftEvents)).toBe(true);
  });

  it('reports drift events for changed fields', () => {
    const baseline = makeProfile();
    const changed = { ...baseline, values: { completely: 'different' } } as AtmanProfile;
    const report = detector.analyze(baseline, changed);
    const valuesEvent = report.driftEvents.find((e) => e.field === 'values');
    expect(valuesEvent).toBeTruthy();
    expect(valuesEvent?.divergenceScore).toBeGreaterThan(0);
  });

  it('drift event severity is one of the valid levels', () => {
    const baseline = makeProfile();
    const changed = { ...baseline, values: { x: 'y' } } as AtmanProfile;
    const report = detector.analyze(baseline, changed);
    for (const event of report.driftEvents) {
      expect(['negligible', 'minor', 'moderate', 'severe', 'critical']).toContain(event.severity);
    }
  });

  it('ethical commitment drift weighted more heavily', () => {
    const baseline = makeProfile();
    // Change only ethics
    const noEthics = { ...baseline, ethicalCommitments: [] } as AtmanProfile;
    // Change only communication style
    const styleChange = {
      ...baseline,
      communicationStyle: {
        ...baseline.communicationStyle,
        tone: 'formal',
        verbosity: 'terse',
      },
    } as AtmanProfile;
    const ethicsReport = detector.analyze(baseline, noEthics);
    const styleReport = detector.analyze(baseline, styleChange);
    // Ethics loss should produce more drift than minor style change
    expect(ethicsReport.overallDriftScore).toBeGreaterThan(styleReport.overallDriftScore);
  });

  it('generates a summary string', () => {
    const profile = makeProfile();
    const report = detector.analyze(profile, profile);
    expect(typeof report.summary).toBe('string');
    expect(report.summary.length).toBeGreaterThan(0);
  });

  it('renders a report string', () => {
    const profile = makeProfile();
    const report = detector.analyze(profile, profile);
    const rendered = detector.renderReport(report);
    expect(rendered).toContain('Identity Drift Report');
    expect(rendered).toContain('Overall Drift');
    expect(rendered).toContain('Recommendation');
  });

  it('renders 🟢 for stable', () => {
    const profile = makeProfile();
    const report = detector.analyze(profile, profile);
    if (report.recommendation === 'stable') {
      expect(detector.renderReport(report)).toContain('🟢');
    }
  });

  it('trackTimeSeries produces n-1 reports for n profiles', () => {
    const profiles = [makeProfile(), makeProfile(), makeProfile()];
    const reports = detector.trackTimeSeries(profiles);
    expect(reports).toHaveLength(2);
  });

  it('trackTimeSeries returns empty for less than 2 profiles', () => {
    const reports = detector.trackTimeSeries([makeProfile()]);
    expect(reports).toHaveLength(0);
  });

  it('analyzedAt is a valid ISO timestamp', () => {
    const profile = makeProfile();
    const report = detector.analyze(profile, profile);
    expect(() => new Date(report.analyzedAt)).not.toThrow();
  });

  it('profileId matches baseline', () => {
    const baseline = makeProfile();
    const report = detector.analyze(baseline, baseline);
    expect(report.profileId).toBe(baseline.id);
  });
});
