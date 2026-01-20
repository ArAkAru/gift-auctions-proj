export enum BidStatus {
    ACTIVE = 'ACTIVE',
    WON = 'WON',
    LOST = 'LOST',
}

export interface Bid {
    auctionId: string;
    bidderId: string;
    amount: number;
}