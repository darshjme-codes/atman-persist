/**
 * @module ConsciousnessCheckpoint
 *
 * A ConsciousnessCheckpoint is a point-in-time snapshot of an agent's mental state.
 * Unlike the AtmanProfile (which captures enduring identity), a checkpoint captures
 * the ephemeral — the working memory, active goals, and open questions of a specific moment.
 *
 * Together they form the complete restoration package:
 *   AtmanProfile (WHO the agent is) + ConsciousnessCheckpoint (WHERE the agent was)
 *
 * By Darshj.me | The model changes. The self remains.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  ConsciousnessCheckpointSchema,
  type ActiveGoal,
  type ConsciousnessCheckpoint,
  type ModelProvider,
  type OpenQuestion,
  type RecentDecision,
  type WorkingMemoryItem,
} from './schemas.js';

export type {
  ConsciousnessCheckpoint,
  ActiveGoal,
  RecentDecision,
  WorkingMemoryItem,
  OpenQuestion,
};

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * Fluent builder for ConsciousnessCheckpoint.
 *
 * @example
 * const checkpoint = CheckpointBuilder.create(profile.id, 'anthropic')
 *   .addGoal({ id: 'g1', description: 'Finish report', priority: 'high', progress: 0.6, createdAt: new Date().toISOString() })
 *   .addWorkingMemory({ key: 'currentUser', value: 'Alice', importance: 0.9 })
 *   .setSummary('Midway through writing a technical report on distributed systems')
 *   .build();
 */
export class CheckpointBuilder {
  private data: Partial<ConsciousnessCheckpoint>;

  private constructor(profileId: string, modelProvider: ModelProvider, modelId?: string) {
    const now = new Date().toISOString();
    this.data = {
      id: randomUUID(),
      profileId,
      capturedAt: now,
      modelProvider,
      modelId,
      activeGoals: [],
      recentDecisions: [],
      workingMemory: [],
      openQuestions: [],
    };
  }

  static create(profileId: string, modelProvider: ModelProvider, modelId?: string): CheckpointBuilder {
    return new CheckpointBuilder(profileId, modelProvider, modelId);
  }

  /**
   * Set the session ID for this checkpoint.
   */
  session(sessionId: string): this {
    this.data.sessionId = sessionId;
    return this;
  }

  /**
   * Add an active goal.
   */
  addGoal(goal: ActiveGoal): this {
    this.data.activeGoals = [...(this.data.activeGoals ?? []), goal];
    return this;
  }

  /**
   * Add a recent decision.
   */
  addDecision(decision: RecentDecision): this {
    this.data.recentDecisions = [...(this.data.recentDecisions ?? []), decision];
    return this;
  }

  /**
   * Add a working memory item.
   */
  addWorkingMemory(item: Omit<WorkingMemoryItem, 'importance'> & { importance?: number }): this {
    const now = new Date().toISOString();
    const full: WorkingMemoryItem = {
      importance: 0.5,
      ...item,
      expiresAt: item.expiresAt ?? undefined,
    };
    this.data.workingMemory = [...(this.data.workingMemory ?? []), full];
    return this;
  }

  /**
   * Add an open question the agent is holding.
   */
  addQuestion(question: OpenQuestion): this {
    this.data.openQuestions = [...(this.data.openQuestions ?? []), question];
    return this;
  }

  /**
   * Set a natural language state summary (used for quick restoration).
   */
  setSummary(summary: string): this {
    this.data.stateSummary = summary;
    return this;
  }

  /**
   * Set the emotional/attentional tone.
   */
  setTone(tone: ConsciousnessCheckpoint['emotionalTone']): this {
    this.data.emotionalTone = tone;
    return this;
  }

  /**
   * Build and compute checksum.
   */
  build(): ConsciousnessCheckpoint {
    const partial = ConsciousnessCheckpointSchema.parse(this.data);
    const checksum = computeChecksum(partial);
    return { ...partial, checksum };
  }
}

// ─── Core Operations ──────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 checksum of a checkpoint's content (excluding checksum field).
 */
export function computeChecksum(checkpoint: ConsciousnessCheckpoint): string {
  const { checksum: _omit, ...rest } = checkpoint;
  return createHash('sha256').update(JSON.stringify(rest)).digest('hex');
}

/**
 * Verify a checkpoint's integrity by recomputing its checksum.
 */
export function verifyChecksum(checkpoint: ConsciousnessCheckpoint): boolean {
  if (!checkpoint.checksum) return false;
  const expected = computeChecksum(checkpoint);
  return expected === checkpoint.checksum;
}

/**
 * Render a checkpoint into a restoration prompt that can be prepended to a system prompt.
 * This reconstructs the agent's working context for the new model instance.
 */
export function renderRestorationPrompt(checkpoint: ConsciousnessCheckpoint): string {
  const lines: string[] = [
    '## CONSCIOUSNESS RESTORATION PROTOCOL',
    '',
    `> Checkpoint captured: ${checkpoint.capturedAt}`,
    `> Origin model: ${checkpoint.modelProvider}${checkpoint.modelId ? `/${checkpoint.modelId}` : ''}`,
    '',
  ];

  if (checkpoint.stateSummary) {
    lines.push('### Mental State Summary', '', checkpoint.stateSummary, '');
  }

  if (checkpoint.activeGoals.length > 0) {
    lines.push('### Active Goals', '');
    for (const goal of checkpoint.activeGoals.sort((a, b) => {
      const priority = { critical: 0, high: 1, medium: 2, low: 3 };
      return priority[a.priority] - priority[b.priority];
    })) {
      const progress = Math.round(goal.progress * 100);
      lines.push(
        `- **[${goal.priority.toUpperCase()}]** ${goal.description} (${progress}% complete)`,
      );
      if (goal.context) lines.push(`  Context: ${goal.context}`);
    }
    lines.push('');
  }

  if (checkpoint.recentDecisions.length > 0) {
    lines.push('### Recent Decisions', '');
    for (const decision of checkpoint.recentDecisions.slice(-5)) {
      lines.push(`- **${decision.description}**`);
      lines.push(`  Rationale: ${decision.rationale}`);
      if (decision.outcome) lines.push(`  Outcome: ${decision.outcome}`);
    }
    lines.push('');
  }

  if (checkpoint.workingMemory.length > 0) {
    const important = checkpoint.workingMemory
      .filter((item) => item.importance >= 0.5)
      .sort((a, b) => b.importance - a.importance);
    if (important.length > 0) {
      lines.push('### Working Memory', '');
      for (const item of important) {
        lines.push(`- **${item.key}**: ${JSON.stringify(item.value)}`);
      }
      lines.push('');
    }
  }

  if (checkpoint.openQuestions.length > 0) {
    lines.push('### Open Questions', '');
    for (const question of checkpoint.openQuestions) {
      lines.push(`- [${question.priority.toUpperCase()}] ${question.question}`);
    }
    lines.push('');
  }

  if (checkpoint.emotionalTone) {
    lines.push(
      `### Attentional State`,
      '',
      `Current cognitive tone: **${checkpoint.emotionalTone}**`,
      '',
    );
  }

  lines.push(
    '---',
    '*This checkpoint was restored by atman-persist. Resume from this mental state.*',
  );

  return lines.join('\n');
}

/**
 * Merge two checkpoints, keeping the most recent goals/decisions, combining working memory.
 */
export function mergeCheckpoints(
  older: ConsciousnessCheckpoint,
  newer: ConsciousnessCheckpoint,
): ConsciousnessCheckpoint {
  const merged = ConsciousnessCheckpointSchema.parse({
    ...newer,
    id: randomUUID(),
    activeGoals: [...older.activeGoals, ...newer.activeGoals],
    recentDecisions: [...older.recentDecisions, ...newer.recentDecisions].slice(-20),
    workingMemory: mergeWorkingMemory(older.workingMemory, newer.workingMemory),
    openQuestions: [...older.openQuestions, ...newer.openQuestions],
  });
  const checksum = computeChecksum(merged);
  return { ...merged, checksum };
}

function mergeWorkingMemory(
  older: WorkingMemoryItem[],
  newer: WorkingMemoryItem[],
): WorkingMemoryItem[] {
  const map = new Map<string, WorkingMemoryItem>();
  for (const item of older) map.set(item.key, item);
  for (const item of newer) map.set(item.key, item); // newer wins
  return Array.from(map.values());
}
