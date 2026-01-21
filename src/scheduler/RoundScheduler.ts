import { auctionService } from '../services/auction.service';

export class RoundScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number;
  
  constructor(checkIntervalMs: number = 1000) {
    this.checkIntervalMs = checkIntervalMs;
  }
  
  start(): void {
    if (this.isRunning()) {
      console.log('Scheduler already running');
      return;
    }
    
    console.log(`Starting round scheduler (check interval: ${this.checkIntervalMs}ms)`);
    
    this.intervalId = setInterval(async () => {
      await this.tick();
    }, this.checkIntervalMs);
  }
  
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Scheduler stopped');
    }
  }

  private async tick(): Promise<void> {
    try {
      await auctionService.processScheduledAuctions();
      await auctionService.processEndingRounds();
    } catch (error) {
      console.error('Scheduler tick error:', error);
    }
  }
  
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}

export const roundScheduler = new RoundScheduler();