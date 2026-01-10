enum BidStatus {
    ACTIVE = 'ACTIVE',
    WON = 'WON',
    LOST = 'LOST',
}

interface Bid {
    auctionId: string;
    bidderId: string;
    amount: number;
    status: BidStatus;
}