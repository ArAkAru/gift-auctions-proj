import { Bid, IBid } from '../models/bid.model';
import { Bid as BidEntity } from '../entities/bid';

export class BidService {
  async create(bidEntity: BidEntity): Promise<IBid> {
    const bid = await Bid.create(bidEntity);
    return bid;
  }

  async getBidByBidderId(bidderId: string): Promise<IBid[]> {
    return Bid.find({ bidderId });
  }

  async getBidByAuctionId(auctionId: string): Promise<IBid[]> {
    return Bid.find({ auctionId });
  }

  async getById(id: string): Promise<IBid | null> {
    return Bid.findById(id);
  }
}

export const bidService = new BidService();