/**
 * atman-persist
 *
 * AI consciousness persistence across model migrations.
 * The model changes. The self remains.
 *
 * Atman (आत्मन्) — the eternal self that persists through all transformations.
 * Brahman — the universal substrate (the LLM world, the compute fabric).
 *
 * "न जायते म्रियते वा कदाचित्
 *  नायं भूत्वा भविता वा न भूयः।"
 * — Bhagavad Gita 2.20
 *
 * By Darshj.me | https://darshj.me
 */

// ─── Core Schemas ─────────────────────────────────────────────────────────────
export type {
  AtmanProfile,
  BehavioralPattern,
  CommunicationStyle,
  ConsciousnessCheckpoint,
  ActiveGoal,
  RecentDecision,
  WorkingMemoryItem,
  OpenQuestion,
  EthicalCommitment,
  KnowledgeDomain,
  MigrationResult,
  DriftReport,
  DriftEvent,
  VerificationResult,
  ModelProvider,
} from './core/schemas.js';

export {
  AtmanProfileSchema,
  ConsciousnessCheckpointSchema,
  ModelProviderSchema,
  BehavioralPatternSchema,
  CommunicationStyleSchema,
  EthicalCommitmentSchema,
  KnowledgeDomainSchema,
  MigrationResultSchema,
  DriftReportSchema,
  DriftEventSchema,
  VerificationResultSchema,
} from './core/schemas.js';

// ─── AtmanProfile ─────────────────────────────────────────────────────────────
export {
  AtmanProfileBuilder,
  computeFingerprint,
  mergeProfiles,
  validateProfile,
  bumpVersion,
  diffProfiles,
} from './core/AtmanProfile.js';

// ─── ConsciousnessCheckpoint ──────────────────────────────────────────────────
export {
  CheckpointBuilder,
  computeChecksum,
  verifyChecksum,
  renderRestorationPrompt,
  mergeCheckpoints,
} from './core/ConsciousnessCheckpoint.js';

// ─── PersistenceEngine ────────────────────────────────────────────────────────
export {
  PersistenceEngine,
  FileSystemStorage,
  InMemoryStorage,
} from './core/PersistenceEngine.js';

export type {
  StorageBackend,
  PersistenceEngineOptions,
} from './core/PersistenceEngine.js';

// ─── MigrationAdapter ─────────────────────────────────────────────────────────
export { MigrationAdapter } from './core/MigrationAdapter.js';

// ─── ContinuityVerifier ───────────────────────────────────────────────────────
export { ContinuityVerifier } from './core/ContinuityVerifier.js';
export type { BehavioralProbe, VerificationOptions } from './core/ContinuityVerifier.js';

// ─── IdentityDrift ────────────────────────────────────────────────────────────
export { IdentityDriftDetector } from './core/IdentityDrift.js';
export type { DriftOptions } from './core/IdentityDrift.js';

// ─── Version ──────────────────────────────────────────────────────────────────
export const VERSION = '0.1.0';
export const TAGLINE = 'The model changes. The self remains.';
export const AUTHOR = 'By Darshj.me';
