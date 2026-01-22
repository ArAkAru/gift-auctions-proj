import mongoose, { Schema } from 'mongoose';

export interface ILock {
  _id: string;
  lockedUntil: Date;
  lockedBy: string;
}

const LockSchema = new Schema<ILock>({
  _id: { type: String, required: true },
  lockedUntil: { type: Date, required: true },
  lockedBy: { type: String, required: true }
});

LockSchema.index({ lockedUntil: 1 }, { expireAfterSeconds: 0 });

export const Lock = mongoose.model<ILock>('Lock', LockSchema);
