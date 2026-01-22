import crypto from 'crypto';
import { Lock } from '../models/lock.model';

const PROCESS_ID = crypto.randomUUID();

export class LockService {
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 30000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  async acquire(lockId: string, ttlMs?: number): Promise<boolean> {
    const ttl = ttlMs || this.defaultTtlMs;
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + ttl);

    try {
      await Lock.findOneAndUpdate(
        {
          _id: lockId,
          $or: [
            { lockedUntil: { $lt: now } },
            { lockedUntil: { $exists: false } }
          ]
        },
        {
          $set: {
            lockedUntil,
            lockedBy: PROCESS_ID
          }
        },
        { upsert: true }
      );
      
      const lock = await Lock.findById(lockId);
      return lock?.lockedBy === PROCESS_ID;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        return false;
      }
      throw error;
    }
  }

  async release(lockId: string): Promise<void> {
    await Lock.deleteOne({
      _id: lockId,
      lockedBy: PROCESS_ID
    });
  }

  async withLock<T>(
    lockId: string,
    fn: () => Promise<T>,
    ttlMs?: number
  ): Promise<T | null> {
    const acquired = await this.acquire(lockId, ttlMs);
    
    if (!acquired) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.release(lockId);
    }
  }
}

export const lockService = new LockService();
