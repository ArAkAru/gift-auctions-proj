import { Bidder, IBidder } from '../models/bidder.model';

export class BidderService {
  async create(params: { username: string; balance?: number }): Promise<IBidder> {
    const bidder = await Bidder.create(params);
    return bidder;
  }

  async getAll(): Promise<IBidder[]> {
    return Bidder.find();
  }

  async getById(id: string): Promise<IBidder | null> {
    return Bidder.findById(id);
  }

  async charge(bidderId: string, amount: number, auctionId: string, bidId: string): Promise<IBidder> {
    // this is already atomic operation, so we don't need to worry about concurrency
    const result = await Bidder.findOneAndUpdate(
      {
        _id: bidderId,
        'balance.held': { $gte: amount }
      },
      {
        $inc: { 'balance.held': -amount }
      },
      { new: true }
    );

    if (!result) {
      const user = await Bidder.findById(bidderId);
      if (!user) {
        throw new Error('User not found');
      }
      throw new Error('Insufficient held funds');
    }
    return result;
  }

  async refund(bidderId: string, amount: number, auctionId: string, bidId: string): Promise<IBidder> {
    // this is already atomic operation, so we don't need to worry about concurrency
    const result = await Bidder.findOneAndUpdate(
      {
        _id: bidderId,
        'balance.held': { $gte: amount }
      },
      {
        $inc: {
          'balance.held': -amount,
          'balance.available': amount
        }
      },
      { new: true }
    );

    if (!result) {
      const bidder = await Bidder.findById(bidderId);
      if (!bidder) {
        throw new Error('Bidder not found');
      }
      throw new Error('Insufficient held funds');
    }
    return result;
  }

  async holdFunds(bidderId: string, amount: number): Promise<IBidder> {
    const result = await Bidder.findOneAndUpdate(
      {
        _id: bidderId,
        'balance.available': { $gte: amount }
      },
      {
        $inc: {
          'balance.available': -amount,
          'balance.held': amount
        }
      },
      { new: true }
    );

    if (!result) {
      const user = await Bidder.findById(bidderId);
      if (!user) {
        throw new Error('User not found');
      }
      throw new Error('Insufficient funds');
    }

    return result;
  }
}

export const bidderService = new BidderService();