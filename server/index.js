import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import createAuthRouter from './auth.js';
import createExpensesRouter from './expense.js';
import createHealthRouter from './health.js';
import createRoommateRouter from './Roommate.js';
import createRoomsRouter from './Rooms.js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 4003;

app.use(cors());
app.use(express.json());

app.use('/health', createHealthRouter(prisma));
app.use('/api', createRoomsRouter(prisma));
app.use('/api', createRoommateRouter(prisma));
app.use('/api', createAuthRouter(prisma));
app.use('/api', createExpensesRouter(prisma));

async function startServer() {
  console.log('Connecting to the database...');
  try {
    await prisma.$connect();
    console.log('Database connection established');
  } catch (error) {
    console.error('Failed to connect to the database', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

startServer();
