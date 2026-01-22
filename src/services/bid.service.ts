import mongoose from 'mongoose';
import { Bid, IBid } from '../models/bid.model';
import { Bid as BidEntity } from '../entities/bid';
import { Auction, IAuction } from '../models/auction.model';
import { BidStatus } from '../entities/bid';
import { AuctionStatus } from '../models/auction.model';
import { bidderService } from './bidder.service';
import { lockService } from './lock.service';

export interface BidResult {
  bid: IBid;
  rank: number;
  antiSnipingTriggered: boolean;
}

export class BidService {
  
  async create(bidEntity: BidEntity): Promise<BidResult> {
    const { auctionId, bidderId, amount } = bidEntity;
    
    // Валидации без lock (быстрые проверки)
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('Auction is not accepting bids');
    }

    if (amount < auction.minBid) {
      throw new Error(`Minimum bid is ${auction.minBid}`);
    }

    // Критическая секция под lock
    const lockKey = `bid:${auctionId}:${bidderId}`;
    const result = await lockService.withLock(lockKey, async () => {
      return this.processBid(auction, bidderId, amount);
    });

    if (result === null) {
      throw new Error('Another bid operation is in progress. Please try again.');
    }

    return result;
  }

  private async processBid(auction: IAuction, bidderId: string, amount: number): Promise<BidResult> {
    const bidderObjId = new mongoose.Types.ObjectId(bidderId);

    const existingBid = await Bid.findOne({
      auctionId: auction._id,
      bidderId: bidderObjId,
      status: BidStatus.ACTIVE
    });

    let bid: IBid;

    if (existingBid) {
      if (amount <= existingBid.amount) {
        throw new Error(`New bid must be higher than current bid of ${existingBid.amount}`);
      }

      const increase = amount - existingBid.amount;

      if (increase < auction.minBidIncrement) {
        throw new Error(`Minimum bid increment is ${auction.minBidIncrement}`);
      }

      existingBid.amount = amount;
      existingBid.round = auction.currentRound;
      
      await this.holdFundsAndSaveBid(existingBid.bidderId, increase, existingBid);
      bid = existingBid;
    } else {
      bid = new Bid({
        auctionId: auction._id,
        bidderId: bidderObjId,
        amount: amount,
        status: BidStatus.ACTIVE
      });

      await this.holdFundsAndSaveBid(bidderId, amount, bid);
    }
    
    const antiSnipingTriggered = await this.checkAndTriggerAntiSniping(auction, amount);
    const rank = await this.calculateRank(auction._id.toString(), bid._id.toString());

    return { bid, rank, antiSnipingTriggered };
  }

  private async holdFundsAndSaveBid(bidderId: string, amount: number, bid: IBid): Promise<void> {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      await bidderService.holdFunds(bidderId, amount, session);
      await bid.save({ session });
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async calculateRank(auctionId: string, bidId: string): Promise<number> {
    const bid = await Bid.findById(bidId);
    if (!bid) {
      throw new Error('Bid not found');
    }
    
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

  async getBidByAuctionId(auctionId: string): Promise<IBid[]> {
    return Bid.find({ auctionId });
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
    
    if (timeUntilEnd > auction.antiSnipingThreshold) {
      return false;
    }
    
    if (auction.antiSnipingCount >= auction.maxAntiSnipingExtensions) {
      return false;
    }
    
    const topBids = await Bid.find({
      auctionId: auction._id,
      status: BidStatus.ACTIVE
    })
      .sort({ amount: -1, createdAt: 1 })
      .limit(auction.itemsPerRound);
    
    const minTopAmount = topBids.length >= auction.itemsPerRound 
      ? topBids[topBids.length - 1].amount 
      : 0;
    
    if (newAmount >= minTopAmount) {
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