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
}

export const bidderService = new BidderService();