import mongoose, { Schema, Document } from 'mongoose';
import { BidStatus } from '../entities/bid';

export interface IBid extends Document {
    auctionId: string;
    bidderId: string;
    amount: number;
    status: BidStatus;
}

const BidSchema = new Schema<IBid>(
  {
    auctionId: { type: String, required: true },
    bidderId: { type: String, required: true }, 
    amount: { type: Number, required: true },
    status: { type: String, enum: BidStatus, default: BidStatus.ACTIVE },
  }
);

export const Bid = mongoose.model<IBid>('Bid', BidSchema);