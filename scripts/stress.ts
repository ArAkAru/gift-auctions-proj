const API_URL = process.env.API_URL || 'http://localhost:3000';

interface LoadTestConfig {
  concurrentBidders: number;
  bidDelayMs: number;
  testDurationMs: number;
}

interface TestResults {
  totalRequests: number;
  successfulBids: number;
  failedBids: number;
  antiSnipingTriggers: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errors: Map<string, number>;
}

async function api(endpoint: string, options?: RequestInit) {
  const start = Date.now();
  
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  
  const duration = Date.now() - start;
  
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { error: `Non-JSON response: ${res.statusText}` };
  }
  
  return { ok: res.ok, status: res.status, data, duration };
}

async function createTestBidders(count: number, balance: number): Promise<string[]> {
  const bidderIds: string[] = [];
  
  console.log(`Creating ${count} test bidders...`);
  
  const promises: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const username = `LoadTest_${Date.now()}_${i}`;
    promises.push(
      api('/bidders', {
        method: 'POST',
        body: JSON.stringify({ username, balance: balance })
      }).then(res => {
        if (res.ok) {
          bidderIds.push(res.data._id);
        }
      })
    );
  }
  
  await Promise.all(promises);
  console.log(`✓ Created ${bidderIds.length} bidders\n`);
  
  return bidderIds;
}

async function createTestAuction(): Promise<string> {
  const res = await api('/auctions', {
    method: 'POST',
    body: JSON.stringify({
      name: `Load Test ${new Date().toISOString()}`,
      totalItems: 100,
      totalRounds: 5,
      itemsPerRound: 20,
      firstRoundDuration: 120,
      regularRoundDuration: 60,
      minBid: 100,
      minBidIncrement: 10,
      antiSnipingThreshold: 30,
      antiSnipingExtension: 15
    })
  });
  
  if (!res.ok) {
    throw new Error(`Failed to create auction: ${res.data.error || res.status}`);
  }
  
  return res.data._id;
}

async function runConcurrentBidTest(
  auctionId: string,
  bidderIds: string[],
  config: LoadTestConfig
): Promise<TestResults> {
  const results: TestResults = {
    totalRequests: 0,
    successfulBids: 0,
    failedBids: 0,
    antiSnipingTriggers: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errors: new Map()
  };
  
  const responseTimes: number[] = [];
  let running = true;
  
  setTimeout(() => { running = false; }, config.testDurationMs);
  
  async function bidderWorker(bidderId: string) {
    let bidAmount = 100 + Math.floor(Math.random() * 200);
    
    while (running) {
      try {
        results.totalRequests++;
        
        const res = await api(`/auctions/${auctionId}/bids`, {
          method: 'POST',
          body: JSON.stringify({ bidderId, amount: bidAmount })
        });
        
        responseTimes.push(res.duration);
        results.minResponseTime = Math.min(results.minResponseTime, res.duration);
        results.maxResponseTime = Math.max(results.maxResponseTime, res.duration);
        
        if (res.ok) {
          results.successfulBids++;
          if (res.data.antiSnipingTriggered) {
            results.antiSnipingTriggers++;
          }
          bidAmount += 10 + Math.floor(Math.random() * 50);
        } else {
          results.failedBids++;
          const errorMsg = res.data.error || 'Unknown error';
          results.errors.set(errorMsg, (results.errors.get(errorMsg) || 0) + 1);
          
          if (errorMsg.includes('Insufficient') || errorMsg.includes('higher')) {
            bidAmount += 50;
          }
        }
      } catch (e: any) {
        results.failedBids++;
        results.errors.set(e.message, (results.errors.get(e.message) || 0) + 1);
      }
      
      await sleep(config.bidDelayMs);
    }
  }
  
  console.log(`Starting ${bidderIds.length} concurrent bidders for ${config.testDurationMs / 1000}s...\n`);
  
  await Promise.all(bidderIds.map(bidderId => bidderWorker(bidderId)));
  
  if (responseTimes.length > 0) {
    results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  }
  
  return results;
}

async function verifyFinancialConsistency(auctionId: string, bidderIds: string[]): Promise<boolean> {
  console.log('\n🔍 Verifying financial consistency...\n');
  
  let totalAvailable = 0;
  let totalHeld = 0;
  const issues: string[] = [];
  
  for (const bidderId of bidderIds) {
    const res = await api(`/bidders/${bidderId}`);
    if (res.ok) {
      const bidder = res.data;
      totalAvailable += bidder.balance.available;
      totalHeld += bidder.balance.held;
      
      if (bidder.balance.available < 0 || bidder.balance.held < 0) {
        issues.push(`Bidder ${bidderId} has negative balance!`);
      }
    }
  }
  
  const winnersRes = await api(`/auctions/${auctionId}/winners`);
  
  console.log('Balance Summary:');
  console.log(`  Total Available: ${totalAvailable}`);
  console.log(`  Total Held: ${totalHeld}`);
  console.log(`  Total in System: ${totalAvailable + totalHeld}`);
  
  if (winnersRes.ok && winnersRes.data.length > 0) {
    const totalCharged = winnersRes.data.reduce((sum: number, w: any) => sum + w.amount, 0);
    console.log(`  Total Charged (winners): ${totalCharged}`);
  }
  
  if (issues.length > 0) {
    console.log('\n❌ Issues found:');
    issues.forEach(i => console.log(`  - ${i}`));
    return false;
  }
  
  console.log('\n✅ Financial consistency verified');
  return true;
}

async function antiSnipingStressTest(auctionId: string, bidderIds: string[]): Promise<number> {
  console.log('\n🎯 Running anti-sniping stress test...\n');
  
  let triggers = 0;
  const burstSize = Math.min(10, bidderIds.length);
  
  let auction = await api(`/auctions/${auctionId}`).then(r => r.data);
  
  while (auction.status === 'ACTIVE' && auction.timeRemaining > 20) {
    await sleep(1000);
    auction = await api(`/auctions/${auctionId}`).then(r => r.data);
  }
  
  if (auction.status !== 'ACTIVE') {
    console.log('Auction not active for anti-sniping test');
    return 0;
  }
  
  console.log(`Time remaining: ${auction.timeRemaining}s - sending burst of bids...`);
  
  const leaderboard = await api(`/auctions/${auctionId}/leaderboard`).then(r => r.data);
  const topBid = leaderboard.length > 0 ? leaderboard[0].amount : 100;
  
  const promises = bidderIds.slice(0, burstSize).map((bidderId, i) => {
    return api(`/auctions/${auctionId}/bids`, {
      method: 'POST',
      body: JSON.stringify({ bidderId, amount: topBid + (i + 1) * 100 })
    }).then(res => {
      if (res.ok && res.data.antiSnipingTriggered) {
        triggers++;
        console.log(`  ⏰ Anti-sniping triggered by bid ${topBid + (i + 1) * 100}`);
      }
      return res;
    });
  });
  
  await Promise.all(promises);
  
  const newAuction = await api(`/auctions/${auctionId}`).then(r => r.data);
  console.log(`\nNew time remaining: ${newAuction.timeRemaining}s`);
  console.log(`Anti-sniping triggers: ${triggers}`);
  
  return triggers;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runLoadTest() {
  console.log('═'.repeat(60));
  console.log('          AUCTION SYSTEM LOAD TEST');
  console.log('═'.repeat(60));
  console.log();
  
  const config: LoadTestConfig = {
    concurrentBidders: 50,
    bidDelayMs: 100,
    testDurationMs: 30000
  };
  
  console.log('Configuration:');
  console.log(`  Concurrent Bidders: ${config.concurrentBidders}`);
  console.log(`  Bid Delay: ${config.bidDelayMs}ms`);
  console.log(`  Test Duration: ${config.testDurationMs / 1000}s`);
  console.log();
  
  const bidderIds = await createTestBidders(config.concurrentBidders, 50000);
  const auctionId = await createTestAuction();
  
  console.log(`Created auction: ${auctionId}\n`);
  
  const startRes = await api(`/auctions/${auctionId}/start`, { method: 'POST' });
  if (!startRes.ok) {
    throw new Error(`Failed to start auction: ${startRes.data.error || startRes.status}`);
  }
  console.log('✓ Auction started\n');
  
  console.log('─'.repeat(60));
  console.log('TEST 1: Concurrent Bidding');
  console.log('─'.repeat(60));
  
  const results = await runConcurrentBidTest(auctionId, bidderIds, config);
  
  console.log('\nResults:');
  console.log(`  Total Requests: ${results.totalRequests}`);
  console.log(`  Successful Bids: ${results.successfulBids}`);
  console.log(`  Failed Bids: ${results.failedBids}`);
  const successRate = results.totalRequests > 0
    ? ((results.successfulBids / results.totalRequests) * 100).toFixed(1)
    : '0.0';
  console.log(`  Success Rate: ${successRate}%`);
  console.log(`  Anti-Sniping Triggers: ${results.antiSnipingTriggers}`);
  console.log();
  console.log('Response Times:');
  console.log(`  Average: ${results.avgResponseTime.toFixed(0)}ms`);
  const minTime = results.minResponseTime === Infinity ? 'N/A' : `${results.minResponseTime}ms`;
  const maxTime = results.maxResponseTime === 0 && results.totalRequests === 0 ? 'N/A' : `${results.maxResponseTime}ms`;
  console.log(`  Min: ${minTime}`);
  console.log(`  Max: ${maxTime}`);
  
  if (results.errors.size > 0) {
    console.log('\nError Distribution:');
    results.errors.forEach((count, error) => {
      console.log(`  ${error}: ${count}`);
    });
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log('TEST 2: Anti-Sniping Mechanism');
  console.log('─'.repeat(60));
  
  const snipingTriggers = await antiSnipingStressTest(auctionId, bidderIds);
  
  console.log('\n' + '─'.repeat(60));
  console.log('TEST 3: Financial Consistency');
  console.log('─'.repeat(60));
  
  const consistent = await verifyFinancialConsistency(auctionId, bidderIds);
  
  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  Concurrent Bidding: ${results.successfulBids > 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`  Anti-Sniping: ${snipingTriggers > 0 ? '✅ PASS' : '⚠️ NOT TRIGGERED'}`);
  console.log(`  Financial Consistency: ${consistent ? '✅ PASS' : '❌ FAIL'}`);
  console.log('═'.repeat(60));
}

runLoadTest().catch(console.error);