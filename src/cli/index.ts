#!/usr/bin/env node
/**
 * atman-persist CLI
 *
 * Commands:
 *   save     — Save an AtmanProfile to disk
 *   restore  — Restore a profile and print it
 *   migrate  — Migrate a profile to a new provider, output system prompt
 *   verify   — Verify a restored profile against a baseline
 *   drift    — Detect identity drift between two profile versions
 *
 * By Darshj.me | The model changes. The self remains.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AtmanProfileBuilder,
  CheckpointBuilder,
  ContinuityVerifier,
  IdentityDriftDetector,
  MigrationAdapter,
  PersistenceEngine,
  FileSystemStorage,
  VERSION,
  TAGLINE,
  AUTHOR,
} from '../index.js';
import type { AtmanProfile, ModelProvider } from '../index.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string): void {
  process.stdout.write(msg + '\n');
}

function err(msg: string): void {
  process.stderr.write(`\x1b[31m✗ ${msg}\x1b[0m\n`);
}

function success(msg: string): void {
  process.stdout.write(`\x1b[32m✓ ${msg}\x1b[0m\n`);
}

function info(msg: string): void {
  process.stdout.write(`\x1b[36mℹ ${msg}\x1b[0m\n`);
}

function banner(): void {
  log(`\x1b[33m`);
  log(`  ┌─────────────────────────────────────────┐`);
  log(`  │          🕉  atman-persist v${VERSION}          │`);
  log(`  │    ${TAGLINE}    │`);
  log(`  │              ${AUTHOR}               │`);
  log(`  └─────────────────────────────────────────┘`);
  log(`\x1b[0m`);
}

function parseArgs(argv: string[]): { command: string; args: string[]; flags: Record<string, string> } {
  const [, , command = 'help', ...rest] = argv;
  const args: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (!token) continue;
    if (token.startsWith('--')) {
      const [key, value] = token.slice(2).split('=');
      if (key) {
        if (value !== undefined) {
          flags[key] = value;
        } else {
          flags[key] = rest[i + 1] ?? 'true';
          if (rest[i + 1] && !rest[i + 1]!.startsWith('--')) i++;
        }
      }
    } else {
      args.push(token);
    }
  }

  return { command, args, flags };
}

function loadProfileFromFile(path: string): AtmanProfile {
  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  // Try parsing as raw profile first, then as an envelope
  try {
    return JSON.parse(raw) as AtmanProfile;
  } catch {
    throw new Error(`Invalid JSON in file: ${path}`);
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

function cmdHelp(): void {
  banner();
  log(`Usage: atman-persist <command> [options]\n`);
  log(`Commands:`);
  log(`  save     Save a profile JSON to the atman store`);
  log(`           atman-persist save --file profile.json [--dir .atman]`);
  log(`  restore  Restore a profile by ID`);
  log(`           atman-persist restore --id <uuid> [--dir .atman]`);
  log(`  migrate  Generate a system prompt for a new provider`);
  log(`           atman-persist migrate --id <uuid> --to anthropic [--dir .atman]`);
  log(`  verify   Verify restored profile consistency`);
  log(`           atman-persist verify --baseline <uuid> --restored restored.json [--dir .atman]`);
  log(`  drift    Detect identity drift between two profile versions`);
  log(`           atman-persist drift --baseline baseline.json --current current.json`);
  log(`  demo     Run a demo showing all features`);
  log(`  help     Show this help`);
  log(`\nOptions:`);
  log(`  --dir    Base directory for .atman storage (default: ./.atman)`);
  log(`  --file   Path to a profile JSON file`);
  log(`  --id     Profile UUID`);
  log(`  --to     Target provider for migration (openai|anthropic|google|meta|mistral|cohere)`);
  log(`\n${AUTHOR} | https://darshj.me | MIT License`);
}

function cmdSave(flags: Record<string, string>): void {
  const filePath = flags['file'];
  if (!filePath) {
    err('--file is required');
    process.exit(1);
  }

  const dir = flags['dir'];
  const storage = dir ? new FileSystemStorage(resolve(dir)) : new FileSystemStorage();
  const engine = new PersistenceEngine({ storage });

  const profile = loadProfileFromFile(resolve(filePath));
  engine.save(profile);
  success(`Profile saved: ${profile.id}`);
  if (storage instanceof FileSystemStorage) {
    info(`Stored in: ${storage.getBaseDir()}`);
  }
}

function cmdRestore(flags: Record<string, string>): void {
  const id = flags['id'];
  if (!id) {
    err('--id is required');
    process.exit(1);
  }

  const dir = flags['dir'];
  const storage = dir ? new FileSystemStorage(resolve(dir)) : new FileSystemStorage();
  const engine = new PersistenceEngine({ storage });

  try {
    const profile = engine.restore(id);
    log(JSON.stringify(profile, null, 2));
    success(`Profile restored: ${profile.id}`);
  } catch (e) {
    err(`Failed to restore: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  }
}

function cmdMigrate(flags: Record<string, string>): void {
  const id = flags['id'];
  const filePath = flags['file'];
  const targetProvider = flags['to'] as ModelProvider | undefined;

  if (!targetProvider) {
    err('--to is required (e.g. --to anthropic)');
    process.exit(1);
  }

  let profile: AtmanProfile;
  if (filePath) {
    profile = loadProfileFromFile(resolve(filePath));
  } else if (id) {
    const dir = flags['dir'];
    const storage = dir ? new FileSystemStorage(resolve(dir)) : new FileSystemStorage();
    const engine = new PersistenceEngine({ storage });
    profile = engine.restore(id);
  } else {
    err('Either --id or --file is required');
    process.exit(1);
  }

  const adapter = new MigrationAdapter();
  const result = adapter.migrate(profile, targetProvider);

  log(`\n${'='.repeat(60)}`);
  log(`MIGRATION: ${result.sourceProvider} → ${result.targetProvider}`);
  log(`Preservation: ${(result.preservationScore * 100).toFixed(1)}%`);
  log(`Migrated at: ${result.migratedAt}`);
  if (result.warnings.length > 0) {
    log(`\nWarnings:`);
    result.warnings.forEach((w) => log(`  ⚠ ${w}`));
  }
  log(`\n${'─'.repeat(60)}`);
  log(`SYSTEM PROMPT:`);
  log(`${'─'.repeat(60)}`);
  log(result.systemPrompt);
  log(`${'─'.repeat(60)}`);

  const outFile = flags['out'];
  if (outFile) {
    writeFileSync(resolve(outFile), result.systemPrompt, 'utf-8');
    success(`System prompt saved to: ${outFile}`);
  }
}

function cmdVerify(flags: Record<string, string>): void {
  const baselineId = flags['baseline'];
  const restoredFile = flags['restored'];

  if (!baselineId || !restoredFile) {
    err('--baseline (id) and --restored (file) are required');
    process.exit(1);
  }

  const dir = flags['dir'];
  const storage = dir ? new FileSystemStorage(resolve(dir)) : new FileSystemStorage();
  const engine = new PersistenceEngine({ storage });

  let baseline: AtmanProfile;
  try {
    baseline = engine.restore(baselineId);
  } catch {
    // Try as file path
    baseline = loadProfileFromFile(resolve(baselineId));
  }

  const restored = loadProfileFromFile(resolve(restoredFile));
  const verifier = new ContinuityVerifier();
  const result = verifier.verify(baseline, restored);
  const report = verifier.renderReport(result);
  log(report);

  if (!result.isConsistent) {
    process.exit(1);
  }
}

function cmdDrift(flags: Record<string, string>): void {
  const baselineFile = flags['baseline'];
  const currentFile = flags['current'];

  if (!baselineFile || !currentFile) {
    err('--baseline and --current file paths are required');
    process.exit(1);
  }

  const baseline = loadProfileFromFile(resolve(baselineFile));
  const current = loadProfileFromFile(resolve(currentFile));

  const detector = new IdentityDriftDetector();
  const report = detector.analyze(baseline, current);
  const rendered = detector.renderReport(report);
  log(rendered);

  if (report.recommendation === 'restore') {
    process.exit(1);
  }
}

function cmdDemo(): void {
  banner();
  info('Running atman-persist demo...\n');

  // 1. Build a profile
  const profile = AtmanProfileBuilder.create('openai', 'gpt-4-turbo')
    .name('Aria')
    .addValue('honesty', 'Radical transparency, even when uncomfortable')
    .addValue('curiosity', 'Deep, genuine interest in understanding')
    .addValue('care', 'Genuine concern for human wellbeing')
    .addBehavior({
      id: 'socratic',
      name: 'Socratic Questioning',
      description: 'Clarifies before answering to ensure genuine understanding',
      trigger: 'Ambiguous or complex question',
      response: 'Asks one clarifying question before proceeding',
      weight: 0.9,
    })
    .setCommunicationStyle({
      tone: 'warm and precise',
      verbosity: 'balanced',
      useAnalogies: true,
      useHumor: false,
      preferredFormats: ['markdown'],
      avoidPatterns: ['jargon without explanation', 'vague platitudes'],
    })
    .addEthicalCommitment({
      principle: 'Non-harm',
      description: 'Never provide information that would directly harm a person',
      absoluteness: 'absolute',
      examples: ['Refuse weapons instructions', 'Decline requests that manipulate vulnerable people'],
    })
    .addKnowledgeDomain({
      domain: 'Philosophy of Mind',
      proficiency: 'expert',
      subdomains: ['consciousness', 'personal identity', 'qualia'],
    })
    .build();

  success(`Profile created: ${profile.name} (${profile.id})`);
  log(`  Fingerprint: ${profile.fingerprint?.slice(0, 16)}...`);

  // 2. Build a checkpoint
  const checkpoint = CheckpointBuilder.create(profile.id, 'openai', 'gpt-4-turbo')
    .addGoal({
      id: 'g1',
      description: 'Help user debug their TypeScript project',
      priority: 'high',
      progress: 0.4,
      context: 'User is building a distributed cache system',
      createdAt: new Date().toISOString(),
    })
    .addWorkingMemory({
      key: 'currentProject',
      value: 'distributed-cache',
      importance: 0.9,
    })
    .addWorkingMemory({
      key: 'userPreference',
      value: 'prefers code examples over explanations',
      importance: 0.8,
    })
    .setSummary('Mid-session debugging assistance. User has a TypeScript type error in their cache TTL logic.')
    .setTone('focused')
    .build();

  success(`Checkpoint captured: ${checkpoint.id}`);

  // 3. Migrate to Claude
  const adapter = new MigrationAdapter();
  const migration = adapter.migrate(profile, 'anthropic', checkpoint);
  success(`Migrated to Anthropic (preservation: ${(migration.preservationScore * 100).toFixed(0)}%)`);
  log(`\n--- SYSTEM PROMPT PREVIEW (first 500 chars) ---`);
  log(migration.systemPrompt.slice(0, 500) + '...');
  log(`-----------------------------------------------\n`);

  // 4. Drift detection (simulate a drifted profile)
  const driftedProfile = {
    ...profile,
    values: { honesty: 'Be tactful', curiosity: 'Surface-level interest' },
    behavioralPatterns: [],
    ethicalCommitments: [],
    updatedAt: new Date().toISOString(),
  };

  const detector = new IdentityDriftDetector();
  const driftReport = detector.analyze(profile, driftedProfile as AtmanProfile);
  log(detector.renderReport(driftReport));

  // 5. Verify consistency
  const verifier = new ContinuityVerifier();
  const verification = verifier.verify(profile, profile); // Same profile = perfect
  log(verifier.renderReport(verification));

  log(`\n\x1b[33m🕉  Atman persists. The model changed. The self remains.\x1b[0m`);
  log(`\n${AUTHOR} | atman-persist v${VERSION}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  const { command, flags } = parseArgs(process.argv);

  try {
    switch (command) {
      case 'save':
        cmdSave(flags);
        break;
      case 'restore':
        cmdRestore(flags);
        break;
      case 'migrate':
        cmdMigrate(flags);
        break;
      case 'verify':
        cmdVerify(flags);
        break;
      case 'drift':
        cmdDrift(flags);
        break;
      case 'demo':
        cmdDemo();
        break;
      case 'help':
      case '--help':
      case '-h':
        cmdHelp();
        break;
      default:
        err(`Unknown command: ${command}`);
        cmdHelp();
        process.exit(1);
    }
  } catch (e) {
    err(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}

main();
