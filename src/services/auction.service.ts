import { Auction, IAuction } from '../models/auction.model';
import { CreateAuctionParams } from '../entities';

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
}

export const auctionService = new AuctionService();
