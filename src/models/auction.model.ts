import mongoose, { Schema, Document } from 'mongoose';

export enum AuctionStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

export interface IAuction extends Document {
  name: string;
  description?: string;
  totalRounds: number;
  roundDuration: number;
  minBid: number;
  minBidIncrement: number;
  status: AuctionStatus;
  roundEndTime?: Date;
  currentRound: number;
  itemsPerRound: number;
  itemsDistributed: number;
  totalItems: number;
  antiSnipingThreshold: number;  // seconds before end to trigger
  antiSnipingCount: number; // how many times extended this round
  maxAntiSnipingExtensions: number; // max extensions per round
  antiSnipingExtension: number; // how much to extend the round
  createdAt: Date;
  updatedAt: Date;
}

const AuctionSchema = new Schema<IAuction>(
  {
    name: { type: String, required: true },
    description: { type: String },
    totalRounds: { type: Number, required: true },
    roundDuration: { type: Number, required: true },
    minBid: { type: Number, default: 1 },
    minBidIncrement: { type: Number, default: 1 },
    status: { type: String, enum: AuctionStatus, default: AuctionStatus.DRAFT },
    roundEndTime: { type: Date },
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

export const Auction = mongoose.model<IAuction>('Auction', AuctionSchema);

