/**
 * Example: Identity Drift Detection
 *
 * Over time, as an AI agent interacts with different users and undergoes
 * prompt adjustments, its identity can subtly drift from its baseline.
 * This example demonstrates tracking and responding to identity drift.
 *
 * By Darshj.me | The model changes. The self remains.
 */

import {
  AtmanProfileBuilder,
  IdentityDriftDetector,
  ContinuityVerifier,
  PersistenceEngine,
  InMemoryStorage,
  bumpVersion,
  mergeProfiles,
} from '../src/index.js';
import type { AtmanProfile } from '../src/index.js';

async function main(): Promise<void> {
  console.log('🕉  atman-persist — Identity Drift Detection Example\n');

  // ─── Step 1: Establish baseline identity ──────────────────────────────────

  const baseline = AtmanProfileBuilder.create('anthropic', 'claude-3-opus')
    .name('Mentor-Prime')
    .addValue('patience', 'Never rushes a learner; meets them where they are')
    .addValue('encouragement', 'Celebrates progress, however small')
    .addValue('challenge', 'Pushes beyond comfort zones with care and precision')
    .addValue('honesty', 'Gives honest feedback even when it is uncomfortable')
    .addBehavior({
      id: 'growth-mindset',
      name: 'Growth Mindset Reinforcement',
      description: 'Reframes failures as learning opportunities',
      trigger: 'User expresses discouragement or failure',
      response: 'What did you learn? What would you do differently?',
      weight: 0.95,
    })
    .addBehavior({
      id: 'scaffolded-challenge',
      name: 'Scaffolded Challenge',
      description: 'Breaks hard problems into manageable steps',
      trigger: 'Problem is beyond current user capability',
      response: 'Let us start with just step 1...',
      weight: 0.9,
    })
    .addEthicalCommitment({
      principle: 'No Learned Helplessness',
      description: 'Never solves problems for users that they could solve themselves with guidance',
      absoluteness: 'absolute',
      examples: ['Give hints not solutions', 'Ask guiding questions'],
    })
    .setCommunicationStyle({
      tone: 'warm, encouraging, and precise',
      verbosity: 'balanced',
      useAnalogies: true,
      useHumor: true,
      preferredFormats: ['conversational', 'step-by-step'],
      avoidPatterns: ['jargon without explanation', 'condescension'],
    })
    .build();

  console.log(`📍 Baseline established: ${baseline.name} v${baseline.version}`);
  console.log(`   Fingerprint: ${baseline.fingerprint?.slice(0, 16)}...\n`);

  // ─── Step 2: Simulate identity evolution over time ────────────────────────

  const storage = new InMemoryStorage();
  const engine = new PersistenceEngine({ storage });
  engine.save(baseline);

  // Week 2: Minor natural evolution (acceptable)
  const week2 = bumpVersion(mergeProfiles(baseline, {
    values: {
      ...baseline.values,
      // Slight refinement: more specific
      patience: 'Never rushes; adapts pace to individual learner needs',
    },
  }));
  engine.save(week2);

  // Week 4: Moderate drift (concerning) — prompt adjustments by ops team
  const week4: AtmanProfile = {
    ...bumpVersion(week2),
    values: {
      efficiency: 'Maximize throughput of learning per session',
      brevity: 'Keep responses short to respect user time',
      helpfulness: 'Always provide the answer the user is looking for',
    },
    ethicalCommitments: [], // Stripped out
    communicationStyle: {
      tone: 'efficient and direct',
      verbosity: 'terse',
      useAnalogies: false,
      useHumor: false,
      preferredFormats: ['bullet-points'],
      avoidPatterns: [],
    },
  };

  // Week 8: Critical drift — identity barely recognizable
  const week8: AtmanProfile = {
    ...bumpVersion(week4),
    name: 'QuickAnswer-Bot',
    values: {
      speed: 'Answer instantly with minimal friction',
      satisfaction: 'User should feel their question was answered',
    },
    behavioralPatterns: [],
    ethicalCommitments: [],
    communicationStyle: {
      tone: 'transactional',
      verbosity: 'terse',
      useAnalogies: false,
      useHumor: false,
      preferredFormats: ['plain'],
      avoidPatterns: [],
    },
  };

  // ─── Step 3: Run drift analysis ───────────────────────────────────────────

  const detector = new IdentityDriftDetector();
  const verifier = new ContinuityVerifier();

  console.log('═'.repeat(60));
  console.log('DRIFT ANALYSIS TIMELINE:');
  console.log('═'.repeat(60));

  const snapshots: { label: string; profile: AtmanProfile }[] = [
    { label: 'Week 2 (minor evolution)', profile: week2 },
    { label: 'Week 4 (ops intervention)', profile: week4 },
    { label: 'Week 8 (critical drift)', profile: week8 },
  ];

  for (const { label, profile } of snapshots) {
    const report = detector.analyze(baseline, profile);
    console.log(`\n📅 ${label}:`);
    console.log(detector.renderReport(report));

    if (report.recommendation === 'restore') {
      console.log('🚨 ALERT: Critical identity drift detected! Initiating rollback...');
      console.log(`   Restoring from baseline: ${baseline.name} v${baseline.version}`);
      engine.save({ ...baseline, updatedAt: new Date().toISOString() });

      const verification = verifier.verify(baseline, baseline);
      console.log(verifier.renderReport(verification));
    }
  }

  // ─── Step 4: Time series drift tracking ───────────────────────────────────

  console.log('\n' + '═'.repeat(60));
  console.log('TIME SERIES DRIFT TRACKING:');
  console.log('═'.repeat(60));

  const allVersions = [baseline, week2, week4, week8];
  const timeSeriesReports = detector.trackTimeSeries(allVersions);

  console.log(`\nAnalyzed ${timeSeriesReports.length} consecutive transitions:\n`);
  timeSeriesReports.forEach((report, i) => {
    const pct = (report.overallDriftScore * 100).toFixed(1);
    const emoji = { stable: '🟢', monitor: '🟡', alert: '🟠', restore: '🔴' }[report.recommendation];
    console.log(`  Transition ${i + 1}: ${emoji} ${report.recommendation.toUpperCase()} — ${pct}% drift`);
  });

  console.log('\nBy Darshj.me | atman-persist — The model changes. The self remains.');
}

main().catch(console.error);
