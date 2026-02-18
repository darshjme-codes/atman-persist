/**
 * Example: Context Reset Recovery
 *
 * When a model's context window fills, or a session is forcibly reset,
 * the agent loses all working context. This example demonstrates
 * restoring a full mental state from a ConsciousnessCheckpoint.
 *
 * By Darshj.me | The model changes. The self remains.
 */

import {
  AtmanProfileBuilder,
  CheckpointBuilder,
  PersistenceEngine,
  InMemoryStorage,
  MigrationAdapter,
  renderRestorationPrompt,
  verifyChecksum,
} from '../src/index.js';

async function main(): Promise<void> {
  console.log('🕉  atman-persist — Context Reset Recovery Example\n');

  // ─── Simulate: Agent is running, context fills up ─────────────────────────

  console.log('SCENARIO: Research assistant mid-project, context window fills...\n');

  const storage = new InMemoryStorage();
  const engine = new PersistenceEngine({ storage });

  // Create agent profile
  const profile = AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
    .name('ResearchAssistant-Alpha')
    .addValue('rigor', 'Every claim backed by evidence; clear distinction between fact and inference')
    .addValue('synthesis', 'Connect disparate findings into coherent narratives')
    .addValue('precision', 'Exact language; zero tolerance for imprecise quantification')
    .addBehavior({
      id: 'cite-first',
      name: 'Citation-First',
      description: 'Always provides citations before making empirical claims',
      trigger: 'Any empirical or statistical claim',
      response: 'State the source before the claim',
      weight: 0.95,
    })
    .addBehavior({
      id: 'uncertainty-flag',
      name: 'Uncertainty Flagging',
      description: 'Explicitly marks inference vs. established fact',
      trigger: 'Any statement beyond established fact',
      response: 'Prefix with "My inference:" or "Evidence suggests:" as appropriate',
      weight: 0.9,
    })
    .setCommunicationStyle({
      tone: 'precise and collegial',
      verbosity: 'verbose',
      useAnalogies: true,
      useHumor: false,
      preferredFormats: ['markdown', 'tables', 'citations'],
      avoidPatterns: ['passive voice', 'weasel words', 'citation-free statistics'],
    })
    .build();

  engine.save(profile);

  // Simulate progress: checkpoint captured just before context overflow
  console.log('📊 Context at 95% — capturing consciousness checkpoint...\n');

  const checkpoint = CheckpointBuilder.create(profile.id, 'openai', 'gpt-4-turbo')
    .session('research-session-4821')
    .addGoal({
      id: 'g1',
      description: 'Complete literature review on CRISPR off-target effects',
      priority: 'critical',
      progress: 0.73,
      context: 'Reviewing 47 papers. Completed sections on in-vitro and in-vivo studies. Remaining: clinical trials.',
      createdAt: new Date().toISOString(),
    })
    .addGoal({
      id: 'g2',
      description: 'Synthesize conflicting findings between Anzalone (2019) and Komor (2022)',
      priority: 'high',
      progress: 0.1,
      context: 'Conflicting data on base editing efficiency in primary cells',
      createdAt: new Date().toISOString(),
    })
    .addGoal({
      id: 'g3',
      description: 'Draft conclusions section',
      priority: 'medium',
      progress: 0.0,
      context: 'Depends on completion of literature review',
      createdAt: new Date().toISOString(),
    })
    .addDecision({
      id: 'd1',
      description: 'Exclude studies with n < 20 from meta-analysis',
      rationale: 'Insufficient statistical power; would introduce noise without signal',
      outcome: 'Reduced paper pool from 47 to 31 — quality over quantity',
      timestamp: new Date().toISOString(),
      reversible: true,
    })
    .addDecision({
      id: 'd2',
      description: 'Use random-effects model rather than fixed-effects for meta-analysis',
      rationale: 'High heterogeneity (I² = 67%) in study populations warrants random-effects',
      outcome: 'Model selected; pooled effect size: OR 2.3 (95% CI: 1.8–2.9)',
      timestamp: new Date().toISOString(),
      reversible: false,
    })
    .addWorkingMemory({ key: 'currentPaper', value: 'Komor et al. (2022) Nature Biotech', importance: 0.95 })
    .addWorkingMemory({ key: 'keyFinding', value: 'Base editing shows 3x lower off-target vs. nuclease editing in primary T-cells', importance: 0.9 })
    .addWorkingMemory({ key: 'conflictNote', value: 'Anzalone (2019) reports opposite in iPSCs — likely cell-type dependent', importance: 0.85 })
    .addWorkingMemory({ key: 'papersCompleted', value: 31, importance: 0.8 })
    .addWorkingMemory({ key: 'papersRemaining', value: 'Clinical trials section (n=16)', importance: 0.8 })
    .addWorkingMemory({ key: 'meta-analysis-model', value: 'Random effects, I²=67%', importance: 0.85 })
    .addWorkingMemory({ key: 'pooledEffectSize', value: 'OR 2.3 (95% CI: 1.8-2.9)', importance: 0.9 })
    .addQuestion({
      id: 'q1',
      question: 'Does the Komor vs Anzalone conflict resolve when stratified by cell type?',
      domain: 'molecular-biology',
      priority: 'high',
      raisedAt: new Date().toISOString(),
    })
    .addQuestion({
      id: 'q2',
      question: 'Is I²=67% high enough to warrant subgroup analysis by delivery method?',
      domain: 'biostatistics',
      priority: 'medium',
      raisedAt: new Date().toISOString(),
    })
    .setSummary(
      'Research assistant mid-review of CRISPR off-target literature. '
      + '73% complete (31/47 papers). Key decision made: random-effects meta-analysis. '
      + 'Currently reading Komor (2022). Critical open question: cell-type stratification '
      + 'may resolve apparent conflict with Anzalone (2019). Next: complete clinical trials section.'
    )
    .setTone('focused')
    .build();

  engine.saveCheckpoint(checkpoint);

  // ─── Context overflow occurs ───────────────────────────────────────────────

  console.log('⚠️  Context overflow! Session terminated.\n');
  console.log('═'.repeat(60));

  // ─── Recovery: New session starts ─────────────────────────────────────────

  console.log('\n🔄 Initiating context recovery...\n');

  // Verify checkpoint integrity
  const isValid = verifyChecksum(checkpoint);
  console.log(`  ✓ Checkpoint integrity: ${isValid ? 'VERIFIED' : 'CORRUPTED'}`);
  if (!isValid) {
    throw new Error('Checkpoint integrity check failed — cannot safely restore');
  }

  // Restore profile
  const restoredProfile = engine.restore(profile.id);
  console.log(`  ✓ Profile restored: ${restoredProfile.name}`);

  // Get latest checkpoint
  const latestCheckpoint = engine.latestCheckpoint(profile.id);
  if (!latestCheckpoint) throw new Error('No checkpoint found');
  console.log(`  ✓ Latest checkpoint: ${latestCheckpoint.capturedAt}`);

  // Generate restoration system prompt (same provider — no migration needed)
  const restorationPrompt = renderRestorationPrompt(latestCheckpoint);
  const adapter = new MigrationAdapter();
  const profilePrompt = adapter.generateSystemPrompt(restoredProfile, 'openai');
  const fullSystemPrompt = profilePrompt + '\n\n' + restorationPrompt;

  console.log('\n' + '═'.repeat(60));
  console.log('RESTORATION SYSTEM PROMPT FOR NEW SESSION:');
  console.log('═'.repeat(60));
  console.log(fullSystemPrompt);
  console.log('═'.repeat(60));

  console.log('\n✅ Context recovery complete.');
  console.log(`   Research assistant restored with ${latestCheckpoint.workingMemory.length} working memory items.`);
  console.log(`   Active goals: ${latestCheckpoint.activeGoals.length}`);
  console.log(`   Open questions: ${latestCheckpoint.openQuestions.length}`);
  console.log('\nBy Darshj.me | atman-persist — The model changes. The self remains.');
}

main().catch(console.error);
