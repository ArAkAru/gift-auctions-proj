import mongoose from 'mongoose';
import { Bid, IBid } from '../models/bid.model';
import { Bid as BidEntity } from '../entities/bid';
import { Auction } from '../models/auction.model';
import { BidStatus } from '../entities/bid';
import { AuctionStatus } from '../models/auction.model';
import { bidderService } from './bidder.service';

export class BidService {
  async create(bidEntity: BidEntity): Promise<IBid> {
    const { auctionId, bidderId, amount } = bidEntity;
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('Auction is not accepting bids');
    }

    // Validate bid amount
    if (amount < auction.minBid) {
      throw new Error(`Minimum bid is ${auction.minBid}`);
    }

    const bidderObjId = new mongoose.Types.ObjectId(bidderId);

    const existingBid = await Bid.findOne({
      auctionId: auction._id,
      bidderId: bidderObjId,
      status: BidStatus.ACTIVE
    });

    let bid: IBid;

    if (existingBid) {
      // Increase existing bid
      if (amount <= existingBid.amount) {
        throw new Error(`New bid must be higher than current bid of ${existingBid.amount}`);
      }

      const increase = amount - existingBid.amount;

      if (increase < auction.minBidIncrement) {
        throw new Error(`Minimum bid increment is ${auction.minBidIncrement}`);
      }

      await bidderService.holdFunds(
        existingBid.bidderId,
        increase,
      );

      existingBid.amount = amount;
      await existingBid.save();
      bid = existingBid;
    } else {
      bid = new Bid({
        auctionId: auction._id,
        bidderId: bidderObjId,
        amount: amount,
        status: BidStatus.ACTIVE
      });

      await bidderService.holdFunds(
        bidderId,
        amount
      );

      await bid.save();
    }
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