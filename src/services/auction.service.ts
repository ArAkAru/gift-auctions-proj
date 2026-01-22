import mongoose from 'mongoose';
import { Auction, IAuction } from '../models/auction.model';
import { CreateAuctionParams } from '../entities';
import { AuctionStatus } from '../models/auction.model';
import { Bid } from '../models/bid.model';
import { BidStatus } from '../entities/bid';
import { bidderService } from './bidder.service';
import { lockService } from './lock.service';

export class AuctionService {

  async create(params: CreateAuctionParams): Promise<IAuction> {
    if (params.itemsPerRound * params.totalRounds > params.totalItems) {
      throw new Error('itemsPerRound * totalRounds cannot exceed totalItems');
    }
    const status = params.scheduledStartTime ? AuctionStatus.SCHEDULED : AuctionStatus.DRAFT;
    const auction = await Auction.create({ ...params, status });
    return auction;
  }

  async getAll(): Promise<IAuction[]> {
    return Auction.find();
  }

  async getById(id: string): Promise<IAuction | null> {
    return Auction.findById(id);
  }

  async start(auctionId: string): Promise<IAuction | null> {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status !== AuctionStatus.DRAFT && auction.status !== AuctionStatus.SCHEDULED) {
      throw new Error(`Cannot start auction in ${auction.status} status`);
    }
    const now = new Date();
    const firstRoundDuration = auction.firstRoundDuration;
    const roundEndTime = new Date(now.getTime() + firstRoundDuration * 1000);
    auction.status = AuctionStatus.ACTIVE;
    auction.currentRound = 1;
    auction.roundEndTime = roundEndTime;
    auction.antiSnipingCount = 0;
    await auction.save();
    return auction;
  }

  async processEndingRounds(): Promise<void> {
    const now = new Date();
    const activeAuctions = await Auction.find({
      status: AuctionStatus.ACTIVE,
      roundEndTime: { $lte: now }
    });
    for (const auction of activeAuctions) {
      const auctionId = auction._id.toString();
      await lockService.withLock(
        `auction:endRound:${auctionId}`,
        () => this.endRound(auctionId)
      );
    }
  }

  async endRound(auctionId: string): Promise<{ winners: string[], nextRound: boolean }> {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();

      const auction = await Auction.findById(auctionId).session(session);
      if (!auction) {
        throw new Error('Auction not found');
      }

      if (auction.status !== AuctionStatus.ACTIVE) {
        throw new Error('Auction is not active');
      }
      
      const currentRound = auction.currentRound;
      const winners: string[] = [];
      const topBids = await Bid.find({
        auctionId: auction._id,
        status: BidStatus.ACTIVE
      })
        .sort({ amount: -1, createdAt: 1 })
        .limit(auction.itemsPerRound)
        .session(session);

      for (const bid of topBids) {
        bid.status = BidStatus.WON;
        bid.wonInRound = auction.currentRound;
        await bid.save({ session });
        await bidderService.charge(bid.bidderId, bid.amount, session);
        winners.push(bid.bidderId);
      }
      auction.itemsDistributed += topBids.length;

      const hasMoreRounds = currentRound < auction.totalRounds;
      const hasMoreItems = auction.itemsDistributed < auction.totalItems;
      const activeBidsCount = await Bid.countDocuments({
        auctionId: auction._id,
        status: BidStatus.ACTIVE
      }).session(session);
    
      let nextRound: boolean;
      
      if (hasMoreRounds && hasMoreItems && activeBidsCount > 0) {
        const now = new Date();
        const roundDuration = auction.regularRoundDuration;
        auction.currentRound = currentRound + 1;
        auction.roundEndTime = new Date(now.getTime() + roundDuration * 1000);
        auction.antiSnipingCount = 0;
        await auction.save({ session });
        nextRound = true;
      } else {
        auction.status = AuctionStatus.COMPLETED;
        await auction.save({ session });

        const remainingBids = await Bid.find({
          auctionId: auction._id,
          status: BidStatus.ACTIVE
        }).session(session);

        for (const bid of remainingBids) {
          bid.status = BidStatus.LOST;
          await bid.save({ session });
          await bidderService.refund(bid.bidderId, bid.amount, session);
        }
        nextRound = false;
      }

      await session.commitTransaction();
      return { winners, nextRound };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async processScheduledAuctions(): Promise<void> {
    const now = new Date();
    const scheduledAuctions = await Auction.find({
      status: AuctionStatus.SCHEDULED,
      scheduledStartTime: { $lte: now }
    });
    
    for (const auction of scheduledAuctions) {
      const auctionId = auction._id.toString();
      await lockService.withLock(
        `auction:start:${auctionId}`,
        () => this.start(auctionId)
      );
    }
  }

  async getLeaderboard(auctionId: string): Promise<Array<{ bidderId: string; username: string; amount: number; rank: number; isWinningPosition: boolean }>> {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    const bids = await Bid.find({
      auctionId,
      status: BidStatus.ACTIVE
    })
      .sort({ amount: -1, createdAt: 1 });
    
    const leaderboard = [];
    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const bidder = await bidderService.getById(bid.bidderId);
      leaderboard.push({
        bidderId: bid.bidderId,
        username: bidder?.username || 'Unknown',
        amount: bid.amount,
        rank: i + 1,
        isWinningPosition: i < auction.itemsPerRound
      });
    }
    return leaderboard;
  }

  async getWinners(auctionId: string): Promise<Array<{ bidderId: string; username: string; amount: number; round: number; itemNumber: number }>> {
    const winningBids = await Bid.find({
      auctionId,
      status: BidStatus.WON
    })
      .sort({ wonInRound: 1, amount: -1 });
    
    const winners = [];
    let itemNumber = 1;
    for (const bid of winningBids) {
      const bidder = await bidderService.getById(bid.bidderId);
      winners.push({
        bidderId: bid.bidderId,
        username: bidder?.username || 'Unknown',
        amount: bid.amount,
        round: bid.wonInRound || 0,
        itemNumber: itemNumber++
      });
    }
    return winners;
  }

  getAuctionWithTimeRemaining(auction: IAuction): IAuction & { timeRemaining: number | null } {
    const timeRemaining = auction.roundEndTime
      ? Math.max(0, Math.floor((auction.roundEndTime.getTime() - Date.now()) / 1000))
      : null;
    return {
      ...auction.toObject(),
      timeRemaining
    };
  }
}

export const auctionService = new AuctionService();