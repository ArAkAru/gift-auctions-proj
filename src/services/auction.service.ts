import { Auction, IAuction } from '../models/auction.model';
import { CreateAuctionParams } from '../entities';
import { AuctionStatus } from '../models/auction.model';

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

    auction.status = AuctionStatus.ACTIVE;
    await auction.save();
    return auction;
  }

  async endRound(auctionId: string): Promise<IAuction | null> {
    const now = new Date();
    const auction = await Auction.findById(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    const roundDuration = auction.roundDuration;
    const roundEndTime = new Date(now.getTime() + roundDuration * 1000);
    if (now > roundEndTime) {
      throw new Error('Round has not ended');
    }
    
    auction.status = AuctionStatus.COMPLETED;
    await auction.save();
    return auction;
  }
}
export const auctionService = new AuctionService();
