import mongoose, { Schema, Document } from 'mongoose';

export interface IBalance {
  available: number;
  held: number;
}

export interface IBidder extends Document {
  username: string;
  balance: IBalance;
}

const BidderSchema = new Schema<IBidder>(
  {
    username: { type: String, required: true, unique: true },
    balance: {
      available: {
        type: Number,
        default: 0,
        min: 0
      },
      held: {
        type: Number,
        default: 0,
        min: 0
      }
    }
  }
);

export const Bidder = mongoose.model<IBidder>('Bidder', BidderSchema);


