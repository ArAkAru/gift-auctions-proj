export {};
const API_URL = process.env.API_URL || 'http://localhost:3000';

interface Bot {
  name: string;
  bidderId?: string;
  balance: number;
  maxBid: number;
  bidInterval: number;
  strategy: 'aggressive' | 'conservative' | 'sniper';
}

interface BotConfig {
  numberOfBots: number;
  initialBalance: number;
  auctionId?: string;
  createAuction?: {
    name: string;
    totalItems: number;
    totalRounds: number;
    itemsPerRound: number;
    firstRoundDuration: number;
    regularRoundDuration: number;
  };
}

async function api<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string };
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  
  return res.json() as Promise<T>;
}

async function createBot(name: string, balance: number): Promise<{ id: string; name: string }> {
  try {
    const bidder = await api('/bidders', {
      method: 'POST',
      body: JSON.stringify({ username: name, balance: balance })
    });
    console.log(`✓ Created bot: ${name} with ${balance} Stars`);
    return { id: bidder._id, name };
  } catch (e: any) {
    const bidders = await api('/bidders');
    const existing = bidders.find((u: any) => u.username === name);
    if (existing) {
      if (existing.balance.available < balance) {
        await api(`/bidders/${existing._id}/deposit`, {
          method: 'POST',
          body: JSON.stringify({ amount: balance - existing.balance.available })
        });
      }
      console.log(`✓ Using existing bot: ${name}`);
      return { id: existing._id, name };
    }
    throw e;
  }
}

async function createAuction(config: NonNullable<BotConfig['createAuction']>): Promise<string> {
  const auction = await api('/auctions', {
    method: 'POST',
    body: JSON.stringify({
      name: config.name,
      description: 'Bot simulation auction',
      totalRounds: config.totalRounds,
      firstRoundDuration: config.firstRoundDuration,
      regularRoundDuration: config.regularRoundDuration,
      minBid: 100,
      minBidIncrement: 10,
      itemsPerRound: config.itemsPerRound,
      totalItems: config.totalItems,
      antiSnipingThreshold: 15,
      antiSnipingExtension: 15,
    })
  });
  console.log(`✓ Created auction: ${auction.name} (${auction._id})`);
  return auction._id;
}

async function startAuction(auctionId: string) {
  await api(`/auctions/${auctionId}/start`, { method: 'POST' });
  console.log(`✓ Auction started!`);
}

async function placeBid(auctionId: string, bidderId: string, amount: number): Promise<any> {
  return api(`/auctions/${auctionId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ auctionId, bidderId, amount })
  });
}

async function getAuction(auctionId: string): Promise<any> {
  return api(`/auctions/${auctionId}`);
}

async function getLeaderboard(auctionId: string): Promise<any[]> {
  return api(`/auctions/${auctionId}/leaderboard`);
}

function calculateBid(bot: Bot, currentTopBid: number, minBid: number, myCurrentBid: number): number | null {
  // Минимальная валидная ставка
  const minValidBid = Math.max(minBid, currentTopBid + 10);
  
  // Если даже минимальная ставка больше нашего лимита — пропускаем
  if (minValidBid > bot.maxBid) {
    return null;
  }
  
  let targetBid: number;
  
  switch (bot.strategy) {
    case 'aggressive':
      // Ставим 10-50% больше топа, но не меньше минимальной валидной ставки
      const extra = Math.floor(Math.random() * (currentTopBid * 0.5)) + 10;
      targetBid = Math.max(minValidBid, currentTopBid + extra);
      break;
      
    case 'conservative':
      // Ставим минимально необходимое
      targetBid = minValidBid;
      break;
      
    case 'sniper':
      // Ставим чуть больше топа (минимальный инкремент)
      targetBid = minValidBid;
      break;
      
    default:
      return null;
  }
  
  // Ограничиваем максимумом бота
  const finalBid = Math.min(targetBid, bot.maxBid);
  
  // Проверяем что новая ставка больше текущей и имеет смысл
  if (finalBid <= myCurrentBid || finalBid < minValidBid) {
    return null;
  }
  
  return finalBid;
}

async function runSimulation(config: BotConfig) {
  console.log('\n🤖 Bot Simulation Starting...\n');
  
  const bots: Bot[] = [];
  const strategies: Array<'aggressive' | 'conservative' | 'sniper'> = ['aggressive', 'conservative', 'sniper'];
  
  for (let i = 0; i < config.numberOfBots; i++) {
    const name = `Bot_${String(i + 1).padStart(3, '0')}`;
    const { id } = await createBot(name, config.initialBalance);
    
    bots.push({
      name,
      bidderId: id,
      balance: config.initialBalance,
      maxBid: Math.floor(config.initialBalance * (0.3 + Math.random() * 0.5)), // 30-80% от баланса
      bidInterval: 2000 + Math.random() * 8000, // 2-10 секунд
      strategy: strategies[i % 3]
    });
  }
  
  console.log(`\n✓ Created ${bots.length} bots\n`);
  
  let auctionId: string;
  if (config.auctionId) {
    auctionId = config.auctionId;
    console.log(`Using existing auction: ${auctionId}`);
  } else if (config.createAuction) {
    auctionId = await createAuction(config.createAuction);
    await startAuction(auctionId);
  } else {
    throw new Error('Either auctionId or createAuction config required');
  }
  
  const botBids: Map<string, number> = new Map();
  let running = true;
  
  async function botLoop(bot: Bot) {
    while (running) {
      try {
        const auction = await getAuction(auctionId);
        
        if (auction.status !== 'ACTIVE') {
          console.log(`\n🏁 Auction ${auction.status}`);
          running = false;
          break;
        }
        
        const leaderboard = await getLeaderboard(auctionId);
        const topBid = leaderboard.length > 0 ? leaderboard[0].amount : 0;
        const myCurrentBid = botBids.get(bot.bidderId!) || 0;
        
        if (bot.strategy === 'sniper' && auction.timeRemaining > 16) {
          await sleep(1000);
          continue;
        }
        
        const newBid = calculateBid(bot, topBid, auction.minBid, myCurrentBid);
        
        if (newBid && newBid > myCurrentBid) {
          try {
            const result = await placeBid(auctionId, bot.bidderId!, newBid);
            botBids.set(bot.bidderId!, newBid);
            
            const emoji = bot.strategy === 'aggressive' ? '🔥' : 
                         bot.strategy === 'sniper' ? '🎯' : '📊';
            console.log(`${emoji} ${bot.name} bid ${newBid} Stars (rank #${result.rank})${result.antiSnipingTriggered ? ' ⏰ ANTI-SNIPE!' : ''}`);
          } catch (e: any) {
          }
        }
      } catch (e: any) {
        if (e.message.includes('not active')) {
          running = false;
          break;
        }
      }
      
      await sleep(bot.bidInterval);
    }
  }
  
  async function statusLoop() {
    while (running) {
      try {
        const auction = await getAuction(auctionId);
        const leaderboard = await getLeaderboard(auctionId);
        
        console.log(`\n📊 Round ${auction.currentRound}/${auction.totalRounds} | Time: ${auction.timeRemaining}s | Bidders: ${leaderboard.length}`);
        
        if (leaderboard.length > 0) {
          console.log(`   Top 3: ${leaderboard.slice(0, 3).map((e: any) => `${e.username}(${e.amount})`).join(', ')}`);
        }
      } catch (e) {
      }
      
      await sleep(5000);
    }
  }
  
  console.log('\n🚀 Starting bot loops...\n');
  
  const loops = [
    ...bots.map(bot => botLoop(bot)),
    statusLoop()
  ];
  
  await Promise.all(loops);
  
  console.log('\n\n🏆 Final Results\n');
  
  try {
    const winners = await api(`/auctions/${auctionId}/winners`);
    
    if (winners.length > 0) {
      console.log('Winners:');
      winners.forEach((w: any) => {
        console.log(`  Item #${w.itemNumber}: ${w.username} (${w.amount} Stars) - Round ${w.round}`);
      });
    }
    
    console.log('\nBot Balances:');
    for (const bot of bots) {
      const user = await api(`/bidders/${bot.bidderId}`);
      const status = user.balance.available < bot.balance ? '🎖️ Won!' : '💰 Refunded';
      console.log(`  ${bot.name}: ${user.balance.available + user.balance.held} Stars (held: ${user.balance.held}) ${status}`);
    }
  } catch (e) {
    console.error('Error fetching results:', e);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const config: BotConfig = {
  numberOfBots: 15,
  initialBalance: 10000,
  createAuction: {
    name: `Bot Battle ${new Date().toLocaleTimeString()}`,
    totalItems: 20,
    totalRounds: 5,
    itemsPerRound: 4,
    firstRoundDuration: 60,
    regularRoundDuration: 30
  }
};

// Позволяет переопределить ID аукциона через аргумент командной строки
if (process.argv[2]) {
  config.auctionId = process.argv[2];
  delete config.createAuction;
}

runSimulation(config).catch(console.error);