import mongoose, { Schema, Document } from 'mongoose';

export enum AuctionStatus {
    DRAFT = 'DRAFT',
    SCHEDULED = 'SCHEDULED',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export interface IAuction extends Document {
  name: string;
  description?: string;
  totalRounds: number;
  firstRoundDuration: number;
  regularRoundDuration: number;
  minBid: number;
  minBidIncrement: number;
  status: AuctionStatus;
  roundEndTime?: Date;
  scheduledStartTime?: Date;
  currentRound: number;
  itemsPerRound: number;
  itemsDistributed: number;
  totalItems: number;
  antiSnipingThreshold: number;  // секунд до конца для срабатывания
  antiSnipingCount: number; // сколько раз продлён этот раунд
  maxAntiSnipingExtensions: number; // макс. продлений за раунд
  antiSnipingExtension: number; // на сколько продлевать раунд
  createdAt: Date;
  updatedAt: Date;
}

const AuctionSchema = new Schema<IAuction>(
  {
    name: { type: String, required: true },
    description: { type: String },
    totalRounds: { type: Number, required: true },
    firstRoundDuration: { type: Number, required: true },
    regularRoundDuration: { type: Number, required: true },
    minBid: { type: Number, default: 1 },
    minBidIncrement: { type: Number, default: 1 },
    status: { type: String, enum: AuctionStatus, default: AuctionStatus.DRAFT },
    roundEndTime: { type: Date },
    scheduledStartTime: { type: Date },
    currentRound: { type: Number, default: 0 },
    itemsPerRound: { type: Number, required: true, min: 1 },
    itemsDistributed: { type: Number, default: 0, min: 0 },
    totalItems: { type: Number, required: true, min: 1 },
    antiSnipingThreshold: { type: Number, default: 10, min: 1 },
    antiSnipingCount: { type: Number, default: 0 },
    maxAntiSnipingExtensions: { type: Number, default: 10, min: 0 },
    antiSnipingExtension: { type: Number, default: 10, min: 1 },
  }, {
    timestamps: true
  }
);

AuctionSchema.index({ status: 1, roundEndTime: 1 });

AuctionSchema.index({ status: 1, scheduledStartTime: 1 });

export const Auction = mongoose.model<IAuction>('Auction', AuctionSchema);