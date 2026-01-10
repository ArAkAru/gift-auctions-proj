import { Bid, IBid } from '../models/bid.model';
import { Bid as BidEntity } from '../entities/bid';
import { Auction } from '../models/auction.model';
import { BidStatus } from '../entities/bid';
import { AuctionStatus } from '../models/auction.model';

export class BidService {
  async create(bidEntity: BidEntity): Promise<IBid> {
    const { auctionId, bidderId, amount } = bidEntity;
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('Auction is not in active status');
    }
    if (amount < auction.minBid) {
      throw new Error('Bid amount is less than the minimum bid');
    }
    if (amount < auction.minBidIncrement) {
      throw new Error('Bid amount is less than the minimum bid increment');
    }

    const existingBid = await Bid.findOne({
        auctionId: auction._id,
        bidderId: bidderId,
        status: BidStatus.ACTIVE
      });

      if (existingBid) {
        if (amount <= existingBid.amount) {
            throw new Error(`New bid must be higher than current bid of ${existingBid.amount}`);
          }
          const increase = amount - existingBid.amount;
      
          if (increase < auction.minBidIncrement) {
            throw new Error(`Minimum bid increment is ${auction.minBidIncrement}`);
          }
          existingBid.amount = amount;
          existingBid.status = BidStatus.ACTIVE;
          await existingBid.save();
          return existingBid;
      } else {
        const bid = await Bid.create(bidEntity);
        return bid;
      }
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