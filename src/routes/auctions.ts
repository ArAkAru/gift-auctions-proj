import { Router, Request, Response } from 'express';
import { auctionService } from '../services/auction.service';

const router = Router();

// Create a new auction
router.post('/', async (req: Request, res: Response) => {
  try {
    const auction = await auctionService.create(req.body);
    res.status(201).json(auction);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create auction' });
  }
});

// Get all auctions
router.get('/', async (req: Request, res: Response) => {
  try {
    const auctions = await auctionService.getAll();
    res.json(auctions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get auctions' });
  }
});

// Get an auction by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const auction = await auctionService.getById(req.params.id);
    if (!auction) {
      res.status(404).json({ error: 'Auction not found' });
      return;
    }
    res.json(auction);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get auction' });
  }
});

// Start an auction
router.post('/:id/start', (req: Request, res: Response) => {
  res.json({ message: 'Start an auction' });
});

// Cancel an auction
router.post('/:id/cancel', (req: Request, res: Response) => {
  res.json({ message: 'Cancel an auction' });
});

export default router;