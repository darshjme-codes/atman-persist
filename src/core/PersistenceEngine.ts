/**
 * @module PersistenceEngine
 *
 * The PersistenceEngine handles serialization, deserialization, and storage of
 * AtmanProfile and ConsciousnessCheckpoint objects.
 *
 * Storage backends:
 *   - File system (default, zero-dep)
 *   - In-memory (for testing)
 *
 * Serialization format: ATMAN JSON (a versioned JSON envelope with integrity hash).
 *
 * By Darshj.me | The model changes. The self remains.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  AtmanProfileSchema,
  ConsciousnessCheckpointSchema,
  type AtmanProfile,
  type ConsciousnessCheckpoint,
} from './schemas.js';

// ─── Envelope Format ──────────────────────────────────────────────────────────

const ATMAN_FORMAT_VERSION = '1.0';
const ATMAN_MAGIC = 'ATMAN';

interface AtmanEnvelope<T> {
  magic: typeof ATMAN_MAGIC;
  formatVersion: string;
  type: 'profile' | 'checkpoint';
  savedAt: string;
  hash: string;
  data: T;
}

function createEnvelope<T>(type: 'profile' | 'checkpoint', data: T): AtmanEnvelope<T> {
  const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return {
    magic: ATMAN_MAGIC,
    formatVersion: ATMAN_FORMAT_VERSION,
    type,
    savedAt: new Date().toISOString(),
    hash,
    data,
  };
}

function verifyEnvelope<T>(envelope: AtmanEnvelope<T>): boolean {
  if (envelope.magic !== ATMAN_MAGIC) return false;
  const expected = createHash('sha256').update(JSON.stringify(envelope.data)).digest('hex');
  return expected === envelope.hash;
}

// ─── StorageBackend Interface ─────────────────────────────────────────────────

export interface StorageBackend {
  saveProfile(profile: AtmanProfile): void;
  loadProfile(id: string): AtmanProfile | null;
  deleteProfile(id: string): void;
  listProfiles(): string[];

  saveCheckpoint(checkpoint: ConsciousnessCheckpoint): void;
  loadCheckpoint(id: string): ConsciousnessCheckpoint | null;
  listCheckpoints(profileId: string): string[];
  deleteCheckpoint(id: string): void;
}

// ─── FileSystem Backend ───────────────────────────────────────────────────────

/**
 * Default file system storage backend.
 * Stores profiles in `{baseDir}/profiles/` and checkpoints in `{baseDir}/checkpoints/`.
 */
export class FileSystemStorage implements StorageBackend {
  private profilesDir: string;
  private checkpointsDir: string;

  constructor(baseDir: string = join(process.cwd(), '.atman')) {
    this.profilesDir = join(baseDir, 'profiles');
    this.checkpointsDir = join(baseDir, 'checkpoints');
    mkdirSync(this.profilesDir, { recursive: true });
    mkdirSync(this.checkpointsDir, { recursive: true });
  }

  saveProfile(profile: AtmanProfile): void {
    const envelope = createEnvelope('profile', profile);
    const path = join(this.profilesDir, `${profile.id}.atman.json`);
    writeFileSync(path, JSON.stringify(envelope, null, 2), 'utf-8');
  }

  loadProfile(id: string): AtmanProfile | null {
    const path = join(this.profilesDir, `${id}.atman.json`);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    const envelope = JSON.parse(raw) as AtmanEnvelope<unknown>;
    if (!verifyEnvelope(envelope)) {
      throw new Error(`Integrity check failed for profile ${id}. Data may be corrupted.`);
    }
    return AtmanProfileSchema.parse(envelope.data);
  }

  deleteProfile(id: string): void {
    const path = join(this.profilesDir, `${id}.atman.json`);
    if (existsSync(path)) unlinkSync(path);
  }

  listProfiles(): string[] {
    return readdirSync(this.profilesDir)
      .filter((f) => f.endsWith('.atman.json'))
      .map((f) => f.replace('.atman.json', ''));
  }

  saveCheckpoint(checkpoint: ConsciousnessCheckpoint): void {
    const envelope = createEnvelope('checkpoint', checkpoint);
    const path = join(this.checkpointsDir, `${checkpoint.id}.atman.json`);
    writeFileSync(path, JSON.stringify(envelope, null, 2), 'utf-8');
  }

  loadCheckpoint(id: string): ConsciousnessCheckpoint | null {
    const path = join(this.checkpointsDir, `${id}.atman.json`);
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    const envelope = JSON.parse(raw) as AtmanEnvelope<unknown>;
    if (!verifyEnvelope(envelope)) {
      throw new Error(`Integrity check failed for checkpoint ${id}. Data may be corrupted.`);
    }
    return ConsciousnessCheckpointSchema.parse(envelope.data);
  }

  listCheckpoints(profileId: string): string[] {
    return readdirSync(this.checkpointsDir)
      .filter((f) => f.endsWith('.atman.json'))
      .map((f) => f.replace('.atman.json', ''))
      .filter((id) => {
        const cp = this.loadCheckpoint(id);
        return cp?.profileId === profileId;
      });
  }

  deleteCheckpoint(id: string): void {
    const path = join(this.checkpointsDir, `${id}.atman.json`);
    if (existsSync(path)) unlinkSync(path);
  }

  getBaseDir(): string {
    return resolve(join(this.profilesDir, '..'));
  }
}

// ─── In-Memory Backend ────────────────────────────────────────────────────────

/**
 * In-memory storage backend, primarily for testing.
 */
export class InMemoryStorage implements StorageBackend {
  private profiles = new Map<string, AtmanProfile>();
  private checkpoints = new Map<string, ConsciousnessCheckpoint>();

  saveProfile(profile: AtmanProfile): void {
    this.profiles.set(profile.id, profile);
  }

  loadProfile(id: string): AtmanProfile | null {
    return this.profiles.get(id) ?? null;
  }

  deleteProfile(id: string): void {
    this.profiles.delete(id);
  }

  listProfiles(): string[] {
    return Array.from(this.profiles.keys());
  }

  saveCheckpoint(checkpoint: ConsciousnessCheckpoint): void {
    this.checkpoints.set(checkpoint.id, checkpoint);
  }

  loadCheckpoint(id: string): ConsciousnessCheckpoint | null {
    return this.checkpoints.get(id) ?? null;
  }

  listCheckpoints(profileId: string): string[] {
    return Array.from(this.checkpoints.values())
      .filter((cp) => cp.profileId === profileId)
      .map((cp) => cp.id);
  }

  deleteCheckpoint(id: string): void {
    this.checkpoints.delete(id);
  }

  /** Test utility: get all profiles */
  getAllProfiles(): AtmanProfile[] {
    return Array.from(this.profiles.values());
  }

  /** Test utility: get all checkpoints */
  getAllCheckpoints(): ConsciousnessCheckpoint[] {
    return Array.from(this.checkpoints.values());
  }
}

// ─── PersistenceEngine ────────────────────────────────────────────────────────

export interface PersistenceEngineOptions {
  storage?: StorageBackend;
}

/**
 * High-level engine for persisting and restoring AtmanProfiles and ConsciousnessCheckpoints.
 *
 * @example
 * const engine = new PersistenceEngine();
 * engine.save(profile);
 * const restored = engine.restore(profile.id);
 */
export class PersistenceEngine {
  private storage: StorageBackend;

  constructor(options: PersistenceEngineOptions = {}) {
    this.storage = options.storage ?? new FileSystemStorage();
  }

  // ─── Profile Operations ───────────────────────────────────────────────────

  /**
   * Persist an AtmanProfile to storage.
   */
  save(profile: AtmanProfile): void {
    const validated = AtmanProfileSchema.parse(profile);
    this.storage.saveProfile(validated);
  }

  /**
   * Restore an AtmanProfile by ID.
   */
  restore(id: string): AtmanProfile {
    const profile = this.storage.loadProfile(id);
    if (!profile) {
      throw new Error(`No profile found with id: ${id}`);
    }
    return profile;
  }

  /**
   * Check if a profile exists.
   */
  exists(id: string): boolean {
    return this.storage.loadProfile(id) !== null;
  }

  /**
   * List all stored profile IDs.
   */
  list(): string[] {
    return this.storage.listProfiles();
  }

  /**
   * Delete a profile (and optionally its checkpoints).
   */
  delete(id: string, includeCheckpoints = false): void {
    if (includeCheckpoints) {
      const checkpointIds = this.storage.listCheckpoints(id);
      for (const cpId of checkpointIds) {
        this.storage.deleteCheckpoint(cpId);
      }
    }
    this.storage.deleteProfile(id);
  }

  // ─── Checkpoint Operations ────────────────────────────────────────────────

  /**
   * Persist a ConsciousnessCheckpoint.
   */
  saveCheckpoint(checkpoint: ConsciousnessCheckpoint): void {
    const validated = ConsciousnessCheckpointSchema.parse(checkpoint);
    this.storage.saveCheckpoint(validated);
  }

  /**
   * Restore a ConsciousnessCheckpoint by ID.
   */
  restoreCheckpoint(id: string): ConsciousnessCheckpoint {
    const checkpoint = this.storage.loadCheckpoint(id);
    if (!checkpoint) {
      throw new Error(`No checkpoint found with id: ${id}`);
    }
    return checkpoint;
  }

  /**
   * List all checkpoint IDs for a given profile.
   */
  listCheckpoints(profileId: string): string[] {
    return this.storage.listCheckpoints(profileId);
  }

  /**
   * Get the most recent checkpoint for a profile.
   * Returns null if no checkpoints exist.
   */
  latestCheckpoint(profileId: string): ConsciousnessCheckpoint | null {
    const ids = this.storage.listCheckpoints(profileId);
    if (ids.length === 0) return null;

    const checkpoints = ids
      .map((id) => this.storage.loadCheckpoint(id))
      .filter((cp): cp is ConsciousnessCheckpoint => cp !== null)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());

    return checkpoints[0] ?? null;
  }

  // ─── Serialization Utilities ──────────────────────────────────────────────

  /**
   * Serialize a profile to a JSON string (for sharing, copying to clipboard, etc.)
   */
  serialize(profile: AtmanProfile): string {
    const envelope = createEnvelope('profile', profile);
    return JSON.stringify(envelope, null, 2);
  }

  /**
   * Deserialize a profile from a JSON string.
   * Verifies integrity before returning.
   */
  deserialize(json: string): AtmanProfile {
    let envelope: AtmanEnvelope<unknown>;
    try {
      envelope = JSON.parse(json) as AtmanEnvelope<unknown>;
    } catch {
      throw new Error('Invalid JSON in atman envelope');
    }
    if (envelope.magic !== ATMAN_MAGIC) {
      throw new Error('Not an atman envelope (magic bytes mismatch)');
    }
    if (!verifyEnvelope(envelope)) {
      throw new Error('Integrity verification failed: envelope has been tampered with');
    }
    return AtmanProfileSchema.parse(envelope.data);
  }

  /**
   * Get the underlying storage backend (for advanced use).
   */
  getStorage(): StorageBackend {
    return this.storage;
  }
}
