import { Auction, IAuction } from '../models/auction.model';
import { CreateAuctionParams } from '../entities';
import { AuctionStatus } from '../models/auction.model';
import { Bid } from '../models/bid.model';
import { BidStatus } from '../entities/bid';
import { bidderService } from './bidder.service';

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
    const roundDuration = auction.roundDuration;
    const roundEndTime = new Date(now.getTime() + roundDuration * 1000);
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
      await this.endRound(auction._id.toString());
    }
  }

  async endRound(auctionId: string): Promise<{ winners: string[], nextRound: boolean }> {
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
      .limit(auction.itemsPerRound);

    for (const bid of topBids) {
      bid.status = BidStatus.WON;
      bid.wonInRound = auction.currentRound;
      await bid.save();
      await bidderService.charge(
        bid.bidderId, 
        bid.amount, 
        auction.id, 
        bid.id
      );
      winners.push(bid.bidderId);
    }
    auction.itemsDistributed += topBids.length;

    // Check if we should continue to next round
    const hasMoreRounds = currentRound < auction.totalRounds;
    const hasMoreItems = auction.itemsDistributed < auction.totalItems;
    const activeBidsCount = await Bid.countDocuments({
      auctionId: auction._id,
      status: BidStatus.ACTIVE
    });
  
    if (hasMoreRounds && hasMoreItems && activeBidsCount > 0) {
      const now = new Date();
      const roundDuration = auction.roundDuration;
      auction.currentRound = currentRound + 1;
      auction.roundEndTime = new Date(now.getTime() + roundDuration * 1000);
      auction.antiSnipingCount = 0;
      await auction.save();
      return { winners, nextRound: true };
    } else {
      auction.status = AuctionStatus.COMPLETED;
      await auction.save();

      const remainingBids = await Bid.find({
        auctionId: auction._id,
        status: BidStatus.ACTIVE
      });

      for (const bid of remainingBids) {
        bid.status = BidStatus.LOST;
        await bid.save();
        await bidderService.refund(
          bid.bidderId, 
          bid.amount, 
          auction.id, 
          bid.id
        );
      }
      return { winners, nextRound: false };
    }
  }

  async processScheduledAuctions(): Promise<void> {
    const now = new Date();
    const scheduledAuctions = await Auction.find({
      status: AuctionStatus.SCHEDULED,
      scheduledStartTime: { $lte: now }
    });
    
    for (const auction of scheduledAuctions) {
      await this.start(auction.id);
    }
  }
}
export const auctionService = new AuctionService();
