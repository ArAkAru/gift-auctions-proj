import { Router, Request, Response } from 'express';
import { auctionService } from '../services/auction.service';
import { bidService } from '../services/bid.service';

const router = Router();

// Создание нового аукциона
router.post('/', async (req: Request, res: Response) => {
  try {
    const auction = await auctionService.create(req.body);
    res.status(201).json(auction);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create auction' });
  }
});

// Получение всех аукционов
router.get('/', async (req: Request, res: Response) => {
  try {
    const auctions = await auctionService.getAll();
    res.json(auctions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get auctions' });
  }
});

// Получение аукциона по ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const auction = await auctionService.getById(req.params.id);
    if (!auction) {
      res.status(404).json({ error: 'Auction not found' });
      return;
    }
    res.json(auctionService.getAuctionWithTimeRemaining(auction));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get auction' });
  }
});

// Запуск аукциона
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const auction = await auctionService.start(req.params.id);
    res.status(200).json(auction);
  } catch (error) {
    res.status(400).json({ error: 'Failed to start auction' });
  }
});

// Отмена аукциона
router.post('/:id/cancel', (req: Request, res: Response) => {
  res.json({ message: 'Cancel an auction' });
});

// Создание новой ставки
router.post('/:id/bids', async (req: Request, res: Response) => {
  try {
    const result = await bidService.create({
      ...req.body,
      auctionId: req.params.id
    });
    
    res.status(201).json({
      ...result.bid.toObject(),
      rank: result.rank,
      antiSnipingTriggered: result.antiSnipingTriggered
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to place bid' });
  }
});

// Получение всех ставок аукциона
router.get('/:id/bids', async (req: Request, res: Response) => {
  try {
    const bids = await bidService.getBidByAuctionId(req.params.id);
    res.json(bids);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bids' });
  }
});

// Получение лидеров аукциона
router.get('/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const leaderboard = await auctionService.getLeaderboard(req.params.id);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Получение статистики аукциона
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const stats = await bidService.getStatsByAuctionId(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Получение победителей аукциона
router.get('/:id/winners', async (req: Request, res: Response) => {
  try {
    const winners = await auctionService.getWinners(req.params.id);
    res.json(winners);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get winners' });
  }
});

export default router;