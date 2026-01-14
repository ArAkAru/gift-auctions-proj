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
  }
);

export const Auction = mongoose.model<IAuction>('Auction', AuctionSchema);

