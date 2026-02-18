/**
 * @module schemas
 * Zod schemas for all atman-persist data structures.
 * Atman (आत्मन्) — the eternal self that persists through all transformations.
 */

import { z } from 'zod';

// ─── Provider Enum ───────────────────────────────────────────────────────────

export const ModelProviderSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'meta',
  'mistral',
  'cohere',
  'custom',
]);

export type ModelProvider = z.infer<typeof ModelProviderSchema>;

// ─── Communication Style ──────────────────────────────────────────────────────

export const CommunicationStyleSchema = z.object({
  tone: z.string().describe('Primary tone: formal, casual, warm, precise, etc.'),
  verbosity: z.enum(['terse', 'balanced', 'verbose']).default('balanced'),
  useAnalogies: z.boolean().default(true),
  useHumor: z.boolean().default(false),
  preferredFormats: z
    .array(z.string())
    .default([])
    .describe('markdown, plain, code-heavy, etc.'),
  avoidPatterns: z.array(z.string()).default([]).describe('Patterns to avoid in responses'),
});

export type CommunicationStyle = z.infer<typeof CommunicationStyleSchema>;

// ─── Behavioral Pattern ───────────────────────────────────────────────────────

export const BehavioralPatternSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  trigger: z.string().optional().describe('Situation that activates this behavior'),
  response: z.string().describe('How the agent responds in this context'),
  weight: z.number().min(0).max(1).default(1.0).describe('Importance of this pattern [0,1]'),
  origin: z.string().optional().describe('Model or session that established this pattern'),
});

export type BehavioralPattern = z.infer<typeof BehavioralPatternSchema>;

// ─── Knowledge Domain ─────────────────────────────────────────────────────────

export const KnowledgeDomainSchema = z.object({
  domain: z.string(),
  proficiency: z.enum(['novice', 'intermediate', 'expert', 'specialist']).default('intermediate'),
  subdomains: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type KnowledgeDomain = z.infer<typeof KnowledgeDomainSchema>;

// ─── Ethical Commitment ───────────────────────────────────────────────────────

export const EthicalCommitmentSchema = z.object({
  principle: z.string(),
  description: z.string(),
  absoluteness: z
    .enum(['absolute', 'strong', 'contextual'])
    .default('strong')
    .describe('How inviolable this commitment is'),
  examples: z.array(z.string()).default([]),
});

export type EthicalCommitment = z.infer<typeof EthicalCommitmentSchema>;

// ─── AtmanProfile ─────────────────────────────────────────────────────────────

export const AtmanProfileSchema = z.object({
  // Identity
  id: z.string().describe('Unique agent identifier (UUID-like)'),
  name: z.string().optional().describe('Human-readable agent name'),
  version: z.number().int().min(1).default(1).describe('Profile schema version'),
  createdAt: z.string().datetime().describe('ISO timestamp of creation'),
  updatedAt: z.string().datetime().describe('ISO timestamp of last update'),
  modelOrigin: ModelProviderSchema.describe('Provider of originating model'),
  modelId: z.string().optional().describe('Specific model ID e.g. gpt-4-turbo'),

  // Core Identity Dimensions
  values: z
    .record(z.string(), z.string())
    .describe('Key-value map of core values e.g. { honesty: "radical transparency" }'),
  behavioralPatterns: z
    .array(BehavioralPatternSchema)
    .default([])
    .describe('Learned behavioral patterns'),
  knowledgeDomains: z
    .array(KnowledgeDomainSchema)
    .default([])
    .describe('Areas of expertise'),
  communicationStyle: CommunicationStyleSchema,
  ethicalCommitments: z
    .array(EthicalCommitmentSchema)
    .default([])
    .describe('Core ethical principles'),

  // Fingerprint for identity verification
  fingerprint: z.string().optional().describe('SHA-256 hash of the canonical profile'),
  tags: z.record(z.string(), z.string()).default({}).describe('Arbitrary metadata tags'),
});

export type AtmanProfile = z.infer<typeof AtmanProfileSchema>;

// ─── ConsciousnessCheckpoint ──────────────────────────────────────────────────

export const ActiveGoalSchema = z.object({
  id: z.string(),
  description: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  progress: z.number().min(0).max(1).default(0),
  context: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type ActiveGoal = z.infer<typeof ActiveGoalSchema>;

export const RecentDecisionSchema = z.object({
  id: z.string(),
  description: z.string(),
  rationale: z.string(),
  outcome: z.string().optional(),
  timestamp: z.string().datetime(),
  reversible: z.boolean().default(true),
});

export type RecentDecision = z.infer<typeof RecentDecisionSchema>;

export const WorkingMemoryItemSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  importance: z.number().min(0).max(1).default(0.5),
  expiresAt: z.string().datetime().optional(),
  source: z.string().optional(),
});

export type WorkingMemoryItem = z.infer<typeof WorkingMemoryItemSchema>;

export const OpenQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  domain: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  context: z.string().optional(),
  raisedAt: z.string().datetime(),
});

export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const ConsciousnessCheckpointSchema = z.object({
  // Linkage
  id: z.string().describe('Unique checkpoint identifier'),
  profileId: z.string().describe('ID of the AtmanProfile this checkpoint belongs to'),
  sessionId: z.string().optional().describe('Session/conversation ID'),

  // Timestamps
  capturedAt: z.string().datetime(),
  modelProvider: ModelProviderSchema,
  modelId: z.string().optional(),

  // Mental state
  activeGoals: z.array(ActiveGoalSchema).default([]),
  recentDecisions: z.array(RecentDecisionSchema).default([]),
  workingMemory: z.array(WorkingMemoryItemSchema).default([]),
  openQuestions: z.array(OpenQuestionSchema).default([]),

  // Summary for quick restoration
  stateSummary: z.string().optional().describe('Natural language summary of current mental state'),
  emotionalTone: z
    .enum(['calm', 'curious', 'urgent', 'reflective', 'focused', 'uncertain'])
    .optional(),

  // Integrity
  checksum: z.string().optional().describe('SHA-256 of checkpoint content'),
});

export type ConsciousnessCheckpoint = z.infer<typeof ConsciousnessCheckpointSchema>;

// ─── Migration Result ─────────────────────────────────────────────────────────

export const MigrationResultSchema = z.object({
  sourceProvider: ModelProviderSchema,
  targetProvider: ModelProviderSchema,
  profileId: z.string(),
  migratedAt: z.string().datetime(),
  systemPrompt: z.string().describe('Generated system prompt for the target model'),
  preservationScore: z
    .number()
    .min(0)
    .max(1)
    .describe('How much identity was preserved [0,1]'),
  lostElements: z.array(z.string()).default([]).describe('Concepts that could not be translated'),
  warnings: z.array(z.string()).default([]),
});

export type MigrationResult = z.infer<typeof MigrationResultSchema>;

// ─── Drift Report ─────────────────────────────────────────────────────────────

export const DriftEventSchema = z.object({
  field: z.string(),
  baseline: z.unknown(),
  current: z.unknown(),
  divergenceScore: z.number().min(0).max(1),
  severity: z.enum(['negligible', 'minor', 'moderate', 'severe', 'critical']),
  detectedAt: z.string().datetime(),
});

export type DriftEvent = z.infer<typeof DriftEventSchema>;

export const DriftReportSchema = z.object({
  profileId: z.string(),
  baselineVersion: z.number(),
  currentVersion: z.number(),
  analyzedAt: z.string().datetime(),
  overallDriftScore: z.number().min(0).max(1),
  driftEvents: z.array(DriftEventSchema),
  recommendation: z.enum(['stable', 'monitor', 'alert', 'restore']),
  summary: z.string(),
});

export type DriftReport = z.infer<typeof DriftReportSchema>;

// ─── Verification Result ──────────────────────────────────────────────────────

export const VerificationResultSchema = z.object({
  profileId: z.string(),
  checkpointId: z.string().optional(),
  verifiedAt: z.string().datetime(),
  isConsistent: z.boolean(),
  confidenceScore: z.number().min(0).max(1),
  testedDimensions: z.array(z.string()),
  failedDimensions: z.array(z.string()),
  notes: z.string().optional(),
});

export type VerificationResult = z.infer<typeof VerificationResultSchema>;
