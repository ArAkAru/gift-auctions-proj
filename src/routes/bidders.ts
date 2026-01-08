import { Router, Request, Response } from 'express';

const router = Router();

// Create a new bidder
router.post('/', (req: Request, res: Response) => {
  res.json({ message: 'Create a new bidder' });
});

// Get all bidders
router.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Get all bidders' });
});

// Get a bidder by ID
router.get('/:id', (req: Request, res: Response) => {
  res.json({ message: 'Get a bidder by ID' });
});

export default router;
