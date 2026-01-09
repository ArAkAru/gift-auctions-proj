import mongoose, { Schema, Document } from 'mongoose';

export interface IBidder extends Document {
  username: string;
  balance: number;
}

const BidderSchema = new Schema<IBidder>(
  {
    username: { type: String, required: true, unique: true },
    balance: { type: Number, default: 0 },
  }
);

export const Bidder = mongoose.model<IBidder>('Bidder', BidderSchema);


