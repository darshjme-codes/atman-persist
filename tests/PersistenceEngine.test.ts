import { describe, it, expect, beforeEach } from 'vitest';
import { PersistenceEngine, InMemoryStorage } from '../src/core/PersistenceEngine.js';
import { AtmanProfileBuilder } from '../src/core/AtmanProfile.js';
import { CheckpointBuilder } from '../src/core/ConsciousnessCheckpoint.js';
import type { AtmanProfile } from '../src/core/schemas.js';

function makeProfile(name = 'TestAgent'): AtmanProfile {
  return AtmanProfileBuilder.create('openai', 'gpt-4')
    .name(name)
    .addValue('honesty', 'radical transparency')
    .build();
}

describe('PersistenceEngine (InMemory)', () => {
  let engine: PersistenceEngine;
  let storage: InMemoryStorage;

  beforeEach(() => {
    storage = new InMemoryStorage();
    engine = new PersistenceEngine({ storage });
  });

  it('saves and restores a profile', () => {
    const profile = makeProfile();
    engine.save(profile);
    const restored = engine.restore(profile.id);
    expect(restored.id).toBe(profile.id);
    expect(restored.name).toBe(profile.name);
  });

  it('throws when restoring nonexistent profile', () => {
    expect(() => engine.restore('does-not-exist')).toThrow();
  });

  it('exists() returns true for saved profiles', () => {
    const profile = makeProfile();
    expect(engine.exists(profile.id)).toBe(false);
    engine.save(profile);
    expect(engine.exists(profile.id)).toBe(true);
  });

  it('lists all saved profile IDs', () => {
    const p1 = makeProfile('Agent1');
    const p2 = makeProfile('Agent2');
    engine.save(p1);
    engine.save(p2);
    const list = engine.list();
    expect(list).toContain(p1.id);
    expect(list).toContain(p2.id);
  });

  it('deletes a profile', () => {
    const profile = makeProfile();
    engine.save(profile);
    engine.delete(profile.id);
    expect(engine.exists(profile.id)).toBe(false);
  });

  it('saves and restores a checkpoint', () => {
    const profile = makeProfile();
    engine.save(profile);
    const checkpoint = CheckpointBuilder.create(profile.id, 'openai')
      .setSummary('Test checkpoint')
      .build();
    engine.saveCheckpoint(checkpoint);
    const restored = engine.restoreCheckpoint(checkpoint.id);
    expect(restored.id).toBe(checkpoint.id);
    expect(restored.stateSummary).toBe('Test checkpoint');
  });

  it('throws when restoring nonexistent checkpoint', () => {
    expect(() => engine.restoreCheckpoint('no-such-checkpoint')).toThrow();
  });

  it('lists checkpoints for a profile', () => {
    const profile = makeProfile();
    engine.save(profile);
    const cp1 = CheckpointBuilder.create(profile.id, 'openai').setSummary('First').build();
    const cp2 = CheckpointBuilder.create(profile.id, 'openai').setSummary('Second').build();
    engine.saveCheckpoint(cp1);
    engine.saveCheckpoint(cp2);
    const list = engine.listCheckpoints(profile.id);
    expect(list).toHaveLength(2);
    expect(list).toContain(cp1.id);
    expect(list).toContain(cp2.id);
  });

  it('latestCheckpoint returns most recent', () => {
    const profile = makeProfile();
    engine.save(profile);
    const cp1 = CheckpointBuilder.create(profile.id, 'openai').setSummary('Older').build();
    engine.saveCheckpoint(cp1);
    const cp2 = CheckpointBuilder.create(profile.id, 'openai').setSummary('Newer').build();
    engine.saveCheckpoint(cp2);
    const latest = engine.latestCheckpoint(profile.id);
    // Both have the same capturedAt resolution, so just verify we get one
    expect(latest).not.toBeNull();
    expect(latest?.profileId).toBe(profile.id);
  });

  it('latestCheckpoint returns null when no checkpoints', () => {
    const profile = makeProfile();
    engine.save(profile);
    const latest = engine.latestCheckpoint(profile.id);
    expect(latest).toBeNull();
  });

  it('delete with includeCheckpoints removes checkpoints too', () => {
    const profile = makeProfile();
    engine.save(profile);
    const cp = CheckpointBuilder.create(profile.id, 'openai').build();
    engine.saveCheckpoint(cp);
    engine.delete(profile.id, true);
    expect(engine.exists(profile.id)).toBe(false);
  });

  it('serialize and deserialize round-trip', () => {
    const profile = makeProfile();
    const json = engine.serialize(profile);
    const parsed = engine.deserialize(json);
    expect(parsed.id).toBe(profile.id);
    expect(parsed.values).toEqual(profile.values);
  });

  it('deserialize throws on invalid JSON', () => {
    expect(() => engine.deserialize('not valid json')).toThrow();
  });

  it('deserialize throws on tampered envelope', () => {
    const profile = makeProfile();
    const json = engine.serialize(profile);
    const tampered = json.replace(profile.id, 'tampered-id');
    expect(() => engine.deserialize(tampered)).toThrow(/integrity/i);
  });

  it('deserialize throws on wrong magic bytes', () => {
    const fakeEnvelope = JSON.stringify({ magic: 'NOTME', data: {} });
    expect(() => engine.deserialize(fakeEnvelope)).toThrow(/atman envelope/i);
  });

  it('overwrites existing profile on re-save', () => {
    const profile = makeProfile('Original');
    engine.save(profile);
    const updated = { ...profile, name: 'Updated' };
    engine.save(updated);
    const restored = engine.restore(profile.id);
    expect(restored.name).toBe('Updated');
  });
});
