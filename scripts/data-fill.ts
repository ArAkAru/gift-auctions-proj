const API_URL = process.env.API_URL || 'http://localhost:3000';

async function api(endpoint: string, options?: RequestInit): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  
  const data = await res.json();
  return { ok: res.ok, data };
}

async function fillDatabase() {
  console.log('Filling database...\n');
  
  const bidders = [
    { username: 'alice', balance: 10000 },
    { username: 'bob', balance: 8000 },
    { username: 'carol', balance: 12000 },
    { username: 'dave', balance: 5000 },
    { username: 'eve', balance: 15000 }
  ];
  
  const createdBidders: Array<{ id: string; username: string }> = [];
  
  for (const bidder of bidders) {
    const res = await api('/bidders', {
      method: 'POST',
      body: JSON.stringify({ username: bidder.username, balance: bidder.balance })
    });
    
    if (res.ok) {
      console.log(`✓ Created bidder: ${bidder.username} (${bidder.balance} Stars)`);
      createdBidders.push({ id: res.data._id, username: bidder.username });
    } else if (res.data.error?.includes('already exists')) {
      console.log(`→ Bidder ${bidder.username} already exists`);
      const allBidders = await api('/bidders');
      const existing = allBidders.data.find((u: any) => u.username === bidder.username);
      if (existing) {
        createdBidders.push({ id: existing._id, username: bidder.username });
      }
    } else {
      console.log(`✗ Failed to create ${bidder.username}: ${res.data.error}`);
    }
  }
  
  // Create demo auction
  console.log('\nCreating demo auction...');
  
  const auctionRes = await api('/auctions', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Demo Auction - Digital Collectibles',
      description: 'A demo auction with fast rounds for testing',
      totalRounds: 10,
      firstRoundDuration: 120,  // 2 minutes
      regularRoundDuration: 60,  // 1 minute
      minBid: 100,
      minBidIncrement: 10,
      itemsPerRound: 5,
      totalItems: 50,
      scheduledStartTime: new Date(Date.now() + 1000 * 60) // 1 minute from now
    })
  });
  
  if (auctionRes.ok) {
    console.log(`\n✓ Created auction: ${auctionRes.data.name}`);
    console.log(`  ID: ${auctionRes.data._id}`);
    console.log(`  Items: ${auctionRes.data.totalItems}`);
    console.log(`  Rounds: ${auctionRes.data.totalRounds}`);
    console.log(`  Items per round: ${auctionRes.data.itemsPerRound}`);
  } else {
    console.log(`✗ Failed to create auction: ${auctionRes.data.error}`);
  }
  
  console.log('\n─────────────────────────────────────');
  console.log('Database filled!');
}

fillDatabase().catch(console.error);

