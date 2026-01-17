import mongoose, { Schema, Document } from 'mongoose';
import { BidStatus } from '../entities/bid';

export interface IBid extends Document {
  auctionId: string;
  bidderId: string;
  amount: number;
  status: BidStatus;
  wonInRound?: number;
  round: number;
  createdAt: Date;
  updatedAt: Date;
}

const BidSchema = new Schema<IBid>(
  {
    auctionId: { type: String, required: true },
    bidderId: { type: String, required: true }, 
    amount: { type: Number, required: true },
    status: { type: String, enum: BidStatus, default: BidStatus.ACTIVE },
    wonInRound: { type: Number, min: 1 },
    round: { type: Number, min: 1 },
  }, {
    timestamps: true
  }
);

export const Bid = mongoose.model<IBid>('Bid', BidSchema);