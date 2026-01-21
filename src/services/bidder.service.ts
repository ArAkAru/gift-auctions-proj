import { Bidder, IBidder } from '../models/bidder.model';

export class BidderService {
  async create(params: { username: string; balance: number }): Promise<IBidder> {
    const bidder = new Bidder({
      username: params.username,
      balance: {
        available: params.balance,
        held: 0
      }
    });
    await bidder.save();
  
    return bidder;
  }

  async getAll(): Promise<IBidder[]> {
    return Bidder.find();
  }

  async getById(id: string): Promise<IBidder | null> {
    return Bidder.findById(id);
  }

  async charge(bidderId: string, amount: number): Promise<IBidder> {
    // Это уже атомарная операция, поэтому не нужно беспокоиться о конкурентности
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
      const bidder = await Bidder.findById(bidderId);
      if (!bidder) {
        throw new Error('Bidder not found');
      }
      throw new Error('Insufficient held funds');
    }
    return result;
  }

  async refund(bidderId: string, amount: number): Promise<IBidder> {
    // Это уже атомарная операция, поэтому не нужно беспокоиться о конкурентности
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
      const bidder = await Bidder.findById(bidderId);
      if (!bidder) {
        throw new Error('Bidder not found');
      }
      throw new Error('Insufficient funds');
    }

    return result;
  }

  async deposit(bidderId: string, amount: number): Promise<IBidder> {
    if (amount <= 0) {
      throw new Error('Deposit amount must be positive');
    }
    
    const bidder = await Bidder.findById(bidderId);
    if (!bidder) {
      throw new Error('Bidder not found');
    }
    
    const updatedBidder = await Bidder.findByIdAndUpdate(
      bidderId,
      { $inc: { 'balance.available': amount } },
      { new: true }
    );
    
    if (!updatedBidder) {
      throw new Error('Failed to update bidder');
    }
    
    return updatedBidder;
  }
}

export const bidderService = new BidderService();