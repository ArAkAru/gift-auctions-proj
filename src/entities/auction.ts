export interface CreateAuctionParams {
  name: string;
  description?: string;
  totalRounds: number;
  firstRoundDuration: number;
  regularRoundDuration: number;
  minBid?: number;
  minBidIncrement?: number;
  itemsPerRound: number;
  totalItems: number;
  scheduledStartTime?: Date;
}

