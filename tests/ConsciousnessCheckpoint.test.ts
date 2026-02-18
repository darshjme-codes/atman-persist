import { describe, it, expect } from 'vitest';
import {
  CheckpointBuilder,
  computeChecksum,
  verifyChecksum,
  renderRestorationPrompt,
  mergeCheckpoints,
} from '../src/core/ConsciousnessCheckpoint.js';
import type { ConsciousnessCheckpoint } from '../src/core/schemas.js';

function makeCheckpoint(profileId = 'profile-001'): ConsciousnessCheckpoint {
  return CheckpointBuilder.create(profileId, 'openai', 'gpt-4-turbo')
    .session('sess-123')
    .addGoal({
      id: 'g1',
      description: 'Fix TypeScript bug',
      priority: 'high',
      progress: 0.4,
      context: 'User has type error in cache module',
      createdAt: new Date().toISOString(),
    })
    .addGoal({
      id: 'g2',
      description: 'Write tests',
      priority: 'medium',
      progress: 0.0,
      createdAt: new Date().toISOString(),
    })
    .addDecision({
      id: 'd1',
      description: 'Use Map instead of plain object for cache',
      rationale: 'Better performance for frequent lookups',
      outcome: 'User agreed',
      timestamp: new Date().toISOString(),
      reversible: true,
    })
    .addWorkingMemory({ key: 'currentFile', value: 'cache.ts', importance: 0.9 })
    .addWorkingMemory({ key: 'lastError', value: 'Type error on line 42', importance: 0.7 })
    .addQuestion({
      id: 'q1',
      question: 'Should we use Redis or in-memory cache?',
      domain: 'architecture',
      priority: 'high',
      raisedAt: new Date().toISOString(),
    })
    .setSummary('Mid-session TypeScript debugging. Working on cache TTL type error.')
    .setTone('focused')
    .build();
}

describe('CheckpointBuilder', () => {
  it('creates a valid checkpoint with required fields', () => {
    const cp = makeCheckpoint();
    expect(cp.id).toBeTruthy();
    expect(cp.profileId).toBe('profile-001');
    expect(cp.modelProvider).toBe('openai');
    expect(cp.modelId).toBe('gpt-4-turbo');
  });

  it('includes a valid checksum', () => {
    const cp = makeCheckpoint();
    expect(cp.checksum).toBeTruthy();
    expect(cp.checksum).toHaveLength(64);
  });

  it('has the correct number of goals', () => {
    const cp = makeCheckpoint();
    expect(cp.activeGoals).toHaveLength(2);
  });

  it('has the correct decisions', () => {
    const cp = makeCheckpoint();
    expect(cp.recentDecisions).toHaveLength(1);
    expect(cp.recentDecisions[0]?.description).toBe('Use Map instead of plain object for cache');
  });

  it('has working memory items', () => {
    const cp = makeCheckpoint();
    expect(cp.workingMemory).toHaveLength(2);
  });

  it('has open questions', () => {
    const cp = makeCheckpoint();
    expect(cp.openQuestions).toHaveLength(1);
  });

  it('stores stateSummary', () => {
    const cp = makeCheckpoint();
    expect(cp.stateSummary).toContain('TypeScript');
  });

  it('stores emotional tone', () => {
    const cp = makeCheckpoint();
    expect(cp.emotionalTone).toBe('focused');
  });

  it('stores sessionId', () => {
    const cp = makeCheckpoint();
    expect(cp.sessionId).toBe('sess-123');
  });
});

describe('computeChecksum', () => {
  it('returns a 64-char hex string', () => {
    const cp = makeCheckpoint();
    const cs = computeChecksum(cp);
    expect(cs).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(cs)).toBe(true);
  });

  it('is deterministic', () => {
    const cp = makeCheckpoint();
    expect(computeChecksum(cp)).toBe(computeChecksum(cp));
  });

  it('differs when content changes', () => {
    const cp = makeCheckpoint();
    const modified = { ...cp, stateSummary: 'Different summary' };
    expect(computeChecksum(cp)).not.toBe(computeChecksum(modified));
  });
});

describe('verifyChecksum', () => {
  it('returns true for a valid checkpoint', () => {
    const cp = makeCheckpoint();
    expect(verifyChecksum(cp)).toBe(true);
  });

  it('returns false if checksum is missing', () => {
    const cp = makeCheckpoint();
    const { checksum: _, ...withoutChecksum } = cp;
    expect(verifyChecksum(withoutChecksum as ConsciousnessCheckpoint)).toBe(false);
  });

  it('returns false if content was tampered', () => {
    const cp = makeCheckpoint();
    const tampered = { ...cp, stateSummary: 'Tampered summary' };
    expect(verifyChecksum(tampered)).toBe(false);
  });
});

describe('renderRestorationPrompt', () => {
  it('includes the RESTORATION PROTOCOL header', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('CONSCIOUSNESS RESTORATION PROTOCOL');
  });

  it('includes active goals', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('Fix TypeScript bug');
  });

  it('includes recent decisions', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('Use Map instead of plain object');
  });

  it('includes working memory', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('currentFile');
  });

  it('includes open questions', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('Redis or in-memory');
  });

  it('includes emotional tone', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('focused');
  });

  it('includes model origin', () => {
    const cp = makeCheckpoint();
    const prompt = renderRestorationPrompt(cp);
    expect(prompt).toContain('openai');
  });
});

describe('mergeCheckpoints', () => {
  it('combines goals from both checkpoints', () => {
    const cp1 = makeCheckpoint();
    const cp2 = CheckpointBuilder.create('profile-001', 'anthropic')
      .addGoal({
        id: 'g3',
        description: 'New goal',
        priority: 'low',
        progress: 0,
        createdAt: new Date().toISOString(),
      })
      .build();
    const merged = mergeCheckpoints(cp1, cp2);
    expect(merged.activeGoals.length).toBeGreaterThan(cp2.activeGoals.length);
  });

  it('newer wins in working memory conflicts', () => {
    const cp1 = CheckpointBuilder.create('p1', 'openai')
      .addWorkingMemory({ key: 'shared', value: 'old value', importance: 0.5 })
      .build();
    const cp2 = CheckpointBuilder.create('p1', 'anthropic')
      .addWorkingMemory({ key: 'shared', value: 'new value', importance: 0.9 })
      .build();
    const merged = mergeCheckpoints(cp1, cp2);
    const sharedItem = merged.workingMemory.find((m) => m.key === 'shared');
    expect(sharedItem?.value).toBe('new value');
  });

  it('generates a new checkpoint id', () => {
    const cp1 = makeCheckpoint();
    const cp2 = makeCheckpoint();
    const merged = mergeCheckpoints(cp1, cp2);
    expect(merged.id).not.toBe(cp1.id);
    expect(merged.id).not.toBe(cp2.id);
  });
});
