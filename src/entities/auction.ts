export interface CreateAuctionParams {
  name: string;
  description?: string;
  totalRounds: number;
  roundDuration: number;
  minBid?: number;
  minBidIncrement?: number;
}

