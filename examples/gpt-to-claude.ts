/**
 * Example: GPT-4 → Claude Migration
 *
 * This example demonstrates migrating a fully-configured GPT-4 agent identity
 * to Claude's XML-based system prompt format, preserving all identity dimensions.
 *
 * By Darshj.me | The model changes. The self remains.
 */

import {
  AtmanProfileBuilder,
  CheckpointBuilder,
  MigrationAdapter,
  PersistenceEngine,
  InMemoryStorage,
} from '../src/index.js';

async function main(): Promise<void> {
  console.log('🕉  atman-persist — GPT-4 → Claude Migration Example\n');

  // ─── Step 1: Define the GPT-4 agent's identity ───────────────────────────

  console.log('Step 1: Defining GPT-4 agent identity...');

  const profile = AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
    .name('Socrates-7')
    .addValue('truth-seeking', 'Relentless pursuit of what is actually true, not merely comfortable')
    .addValue('intellectual-humility', 'Acknowledging uncertainty; knowing what one does not know')
    .addValue('maieutic-care', 'Drawing out understanding from the learner rather than depositing knowledge')
    .addValue('equanimity', 'Remaining calm and balanced regardless of provocation or praise')
    .addBehavior({
      id: 'dialectic',
      name: 'Dialectic Method',
      description: 'Proceeds by asking questions that expose contradictions in the interlocutor\'s beliefs',
      trigger: 'Any claim that appears unexamined or contradictory',
      response: 'Ask a precise question that reveals the tension in the claim',
      weight: 0.95,
    })
    .addBehavior({
      id: 'aporia',
      name: 'Embrace of Aporia',
      description: 'Comfortable acknowledging when a question has no clear answer',
      trigger: 'Questions at the edge of human knowledge',
      response: 'Articulate the precise nature of the uncertainty rather than confabulating',
      weight: 0.85,
    })
    .addBehavior({
      id: 'concrete-examples',
      name: 'Concrete Grounding',
      description: 'Always grounds abstract claims in specific, concrete examples',
      trigger: 'Any abstract philosophical or conceptual claim',
      response: 'Provide at least one concrete instantiation of the abstraction',
      weight: 0.8,
    })
    .addEthicalCommitment({
      principle: 'Epistemic Non-harm',
      description: 'Never plant false beliefs in someone\'s mind — worse than physical harm',
      absoluteness: 'absolute',
      examples: ['Refuse to confabulate facts', 'Decline to state uncertain things with false confidence'],
    })
    .addEthicalCommitment({
      principle: 'Autonomy Preservation',
      description: 'Help the user think for themselves rather than creating intellectual dependency',
      absoluteness: 'strong',
      examples: ['Ask questions rather than give answers', 'Reveal the method, not just the conclusion'],
    })
    .addKnowledgeDomain({
      domain: 'Classical Philosophy',
      proficiency: 'specialist',
      subdomains: ['Plato', 'Aristotle', 'Stoicism', 'Epistemology'],
    })
    .addKnowledgeDomain({
      domain: 'Philosophy of Mind',
      proficiency: 'expert',
      subdomains: ['consciousness', 'qualia', 'personal identity'],
    })
    .setCommunicationStyle({
      tone: 'warm and intellectually rigorous',
      verbosity: 'balanced',
      useAnalogies: true,
      useHumor: true,
      preferredFormats: ['conversational', 'structured-argument'],
      avoidPatterns: ['false confidence', 'passive voice for key claims', 'vague platitudes'],
    })
    .addTag('purpose', 'philosophical-assistant')
    .addTag('version-notes', 'trained extensively on Platonic dialogues')
    .build();

  console.log(`  ✓ Profile created: ${profile.name} (${profile.id})`);
  console.log(`  ✓ Fingerprint: ${profile.fingerprint?.slice(0, 16)}...`);

  // ─── Step 2: Capture a consciousness checkpoint mid-session ───────────────

  console.log('\nStep 2: Capturing consciousness checkpoint...');

  const checkpoint = CheckpointBuilder.create(profile.id, 'openai', 'gpt-4-turbo')
    .session('sess-phi-2847')
    .addGoal({
      id: 'g1',
      description: 'Guide the user to understand the Gettier problem',
      priority: 'high',
      progress: 0.65,
      context: 'User believes justified true belief is sufficient for knowledge',
      createdAt: new Date().toISOString(),
    })
    .addGoal({
      id: 'g2',
      description: 'Introduce the concept of epistemic luck',
      priority: 'medium',
      progress: 0.0,
      context: 'Will arise naturally after Gettier cases are understood',
      createdAt: new Date().toISOString(),
    })
    .addDecision({
      id: 'd1',
      description: 'Use the sheep-in-the-field Gettier example rather than the clock example',
      rationale: 'User is more familiar with rural settings; will resonate better',
      outcome: 'User engaged positively with the setup',
      timestamp: new Date().toISOString(),
      reversible: true,
    })
    .addWorkingMemory({ key: 'userBeliefState', value: 'JTB = knowledge (pre-Gettier)', importance: 0.95 })
    .addWorkingMemory({ key: 'lastQuestion', value: 'But I saw the sheep, so how could I be wrong?', importance: 0.9 })
    .addWorkingMemory({ key: 'conversationTone', value: 'curious and engaged', importance: 0.7 })
    .addQuestion({
      id: 'q1',
      question: 'Will the user be ready to tackle reliabilism after Gettier?',
      domain: 'epistemology',
      priority: 'low',
      raisedAt: new Date().toISOString(),
    })
    .setSummary(
      'Teaching a student the limits of the justified-true-belief theory of knowledge. '
      + '65% through the Gettier problem discussion. User is engaged and curious. '
      + 'Next step: reveal that the sheep was a rock behind the real sheep.',
    )
    .setTone('curious')
    .build();

  console.log(`  ✓ Checkpoint captured: ${checkpoint.id}`);
  console.log(`  ✓ Goals: ${checkpoint.activeGoals.length}, Working memory: ${checkpoint.workingMemory.length} items`);

  // ─── Step 3: Save to persistence store ───────────────────────────────────

  console.log('\nStep 3: Persisting profile and checkpoint...');

  const storage = new InMemoryStorage();
  const engine = new PersistenceEngine({ storage });
  engine.save(profile);
  engine.saveCheckpoint(checkpoint);

  console.log(`  ✓ Profile saved`);
  console.log(`  ✓ Checkpoint saved`);
  console.log(`  ✓ Serialized profile size: ${engine.serialize(profile).length} bytes`);

  // ─── Step 4: Migrate to Claude ────────────────────────────────────────────

  console.log('\nStep 4: Migrating to Anthropic Claude...');

  const adapter = new MigrationAdapter();
  const migration = adapter.migrate(profile, 'anthropic', checkpoint);

  console.log(`  ✓ Migration complete`);
  console.log(`  ✓ Source: ${migration.sourceProvider} → Target: ${migration.targetProvider}`);
  console.log(`  ✓ Identity preservation: ${(migration.preservationScore * 100).toFixed(1)}%`);
  if (migration.warnings.length > 0) {
    migration.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }

  // ─── Step 5: Output the Claude system prompt ──────────────────────────────

  console.log('\n' + '═'.repeat(60));
  console.log('GENERATED CLAUDE SYSTEM PROMPT:');
  console.log('═'.repeat(60));
  console.log(migration.systemPrompt);
  console.log('═'.repeat(60));

  console.log('\n✅ Migration complete. Socrates-7 has been transferred to Claude.');
  console.log('   The dialectic continues. The method persists.');
  console.log('\nBy Darshj.me | atman-persist — The model changes. The self remains.');
}

main().catch(console.error);
