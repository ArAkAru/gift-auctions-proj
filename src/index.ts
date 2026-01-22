import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from './config/database';
import auctionsRouter from './routes/auctions';
import biddersRouter from './routes/bidders';
import { roundScheduler } from './scheduler/RoundScheduler';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

app.use('/auctions', auctionsRouter);
app.use('/bidders', biddersRouter);

const startServer = async () => {
  try {
    await connectDatabase();
    
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      roundScheduler.start();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  roundScheduler.stop();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  roundScheduler.stop();
  await disconnectDatabase();
  process.exit(0);
});
