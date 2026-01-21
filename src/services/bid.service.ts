import mongoose from 'mongoose';
import { Bid, IBid } from '../models/bid.model';
import { Bid as BidEntity } from '../entities/bid';
import { Auction, IAuction } from '../models/auction.model';
import { BidStatus } from '../entities/bid';
import { AuctionStatus } from '../models/auction.model';
import { bidderService } from './bidder.service';

export interface BidResult {
  bid: IBid;
  rank: number;
  antiSnipingTriggered: boolean;
}

export class BidService {
  async create(bidEntity: BidEntity): Promise<BidResult> {
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
    let antiSnipingTriggered = false;

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

      // Check for anti-sniping before updating bid
      antiSnipingTriggered = await this.checkAndTriggerAntiSniping(
        auction,
        amount
      );

      existingBid.amount = amount;
      existingBid.round = auction.currentRound;
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

      // Check for anti-sniping before updating bid
      antiSnipingTriggered = await this.checkAndTriggerAntiSniping(
        auction,
        amount
      );

      await bid.save();
    }
    const rank = await this.calculateRank(auctionId, bid._id.toString());

    return { bid, rank, antiSnipingTriggered };
  }

  private async calculateRank(auctionId: string, bidId: string): Promise<number> {
    const bid = await Bid.findById(bidId);
    if (!bid) {
      throw new Error('Bid not found');
    }
    
    // Count bids with higher amount, or same amount but earlier timestamp
    const higherBids = await Bid.countDocuments({
      auctionId: new mongoose.Types.ObjectId(auctionId),
      status: BidStatus.ACTIVE,
      $or: [
        { amount: { $gt: bid.amount } },
        { amount: bid.amount, createdAt: { $lt: bid.createdAt } }
      ]
    });
    
    return higherBids + 1;
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

  async getStatsByAuctionId(auctionId: string): Promise<{ totalActiveBids: number; highestBid: number }> {
    const totalActiveBids = await Bid.countDocuments({
      auctionId: new mongoose.Types.ObjectId(auctionId),
      status: BidStatus.ACTIVE
    });
    
    const highestBid = await Bid.findOne({
      auctionId: new mongoose.Types.ObjectId(auctionId),
      status: BidStatus.ACTIVE
    }).sort({ amount: -1 });

    return {
      totalActiveBids,
      highestBid: highestBid?.amount || 0
    };
  }

  private async checkAndTriggerAntiSniping(
    auction: IAuction,
    newAmount: number
  ): Promise<boolean> {
    if (!auction.roundEndTime) {
      return false;
    }
    
    const now = new Date();
    const timeUntilEnd = (auction.roundEndTime.getTime() - now.getTime()) / 1000;
    
    // Check if we're within the anti-sniping threshold
    if (timeUntilEnd > auction.antiSnipingThreshold) {
      return false;
    }
    
    // Check if max extensions reached
    if (auction.antiSnipingCount >= auction.maxAntiSnipingExtensions) {
      return false;
    }
    
    // Here we check if the new bid is in the top N positions
    // Otherwise we don't need to extend the round
    const topBids = await Bid.find({
      auctionId: auction._id,
      status: BidStatus.ACTIVE
    })
      .sort({ amount: -1, createdAt: 1 })
      .limit(auction.itemsPerRound);
    
    // Edge case: if bidders are not enough to fill the top N positions, we need to use the minimum amount
    const minTopAmount = topBids.length >= auction.itemsPerRound 
      ? topBids[topBids.length - 1].amount 
      : 0;
    
    if (newAmount >= minTopAmount) {
      // Trigger anti-sniping - use atomic update
      await Auction.findByIdAndUpdate(
        auction._id,
        {
          $set: {
            roundEndTime: new Date(auction.roundEndTime.getTime() + auction.antiSnipingExtension * 1000)
          },
          $inc: { antiSnipingCount: 1 }
        }
      );
      
      return true;
    }
    
    return false;
  }
}

export const bidService = new BidService();