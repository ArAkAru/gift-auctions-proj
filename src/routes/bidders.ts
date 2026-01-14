import { Router, Request, Response } from 'express';
import { bidderService } from '../services/bidder.service';
import { bidService } from '../services/bid.service';

const router = Router();

// Create a new bidder
router.post('/', async (req: Request, res: Response) => {
  try {
    const bidder = await bidderService.create({
      username: req.body.username,
      balance: req.body.balance || 0
    });
    res.status(201).json(bidder);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create bidder' });
  }
});

// Get all bidders
router.get('/', async (req: Request, res: Response) => {
  try {
    const bidders = await bidderService.getAll();
    res.json(bidders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bidders' });
  }
});

// Get a bidder by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bidder = await bidderService.getById(req.params.id);
    if (!bidder) {
      res.status(404).json({ error: 'Bidder not found' });
      return;
    }
    res.json(bidder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bidder' });
  }
});

export default router;
