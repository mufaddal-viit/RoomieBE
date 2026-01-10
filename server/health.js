import { Router } from 'express';

const createHealthRouter = prisma => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/db', async (_req, res) => {
    try {
      await prisma.room.count();
      res.json({ status: 'ok', db: 'ok' });
    } catch (error) {
      console.error('DB health check failed', error);
      res.status(500).json({ status: 'error', db: 'error' });
    }
  });

  return router;
};

export default createHealthRouter;
