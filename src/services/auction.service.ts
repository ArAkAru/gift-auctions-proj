import { Auction, IAuction } from '../models/auction.model';
import { CreateAuctionParams } from '../entities';
import { AuctionStatus } from '../models/auction.model';
import { Bid } from '../models/bid.model';
import { BidStatus } from '../entities/bid';
import { bidderService } from './bidder.service';

export class AuctionService {
  async create(params: CreateAuctionParams): Promise<IAuction> {
    const auction = await Auction.create(params);
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

    if (auction.status !== AuctionStatus.DRAFT) {
      throw new Error('Auction is not in draft status');
    }
    const now = new Date();
    const roundDuration = auction.roundDuration;
    const roundEndTime = new Date(now.getTime() + roundDuration * 1000);
    auction.status = AuctionStatus.ACTIVE;
    auction.currentRound = 1;
    auction.roundEndTime = roundEndTime;
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
      await this.endRound(auction._id.toString());
    }
  }

  async endRound(auctionId: string): Promise<string[]> {
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }

    if (auction.status !== AuctionStatus.ACTIVE) {
      throw new Error('Auction is not active');
    }
    const currentRound = auction?.currentRound;
    const winners: string[] = [];
    const topBids = await Bid.find({
      auctionId: auction._id,
      status: BidStatus.ACTIVE
    })
      .sort({ amount: -1, createdAt: 1 })
      .limit(10); // TODO: forget about set how many items per round, just take top 10 bids for now

    for (const bid of topBids) {
      await bidderService.charge(
        bid.bidderId, 
        bid.amount, 
        auction.id, 
        bid.id
      );
      winners.push(bid.bidderId);
      // TODO: charge logic here
    }

    // Check if we should continue to next round
    const hasMoreRounds = currentRound < auction.totalRounds;
  
    if (hasMoreRounds) {
      const now = new Date();
      const roundDuration = auction.roundDuration;
      auction.currentRound = currentRound + 1;
      auction.roundEndTime = new Date(now.getTime() + roundDuration * 1000);
      await auction.save();
    } else {
      auction.status = AuctionStatus.COMPLETED;
      await auction.save();

      const remainingBids = await Bid.find({
        auctionId: auction._id,
        status: BidStatus.ACTIVE
      });

      for (const bid of remainingBids) {
        await bidderService.refund(
          bid.bidderId, 
          bid.amount, 
          auction.id, 
          bid.id
        );
      }
    }
    return winners;
  }
}
export const auctionService = new AuctionService();
