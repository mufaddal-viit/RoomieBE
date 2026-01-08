import { Router } from 'express';

const createHealthRouter = prisma => {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', db: 'connected' });
    } catch (error) {
      console.error('Health check failed', error);
      res.status(500).json({ status: 'error', db: 'unavailable' });
    }
  });

  return router;
};

export default createHealthRouter;
