import { Router } from 'express';

const createHealthRouter = () => {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
};

export default createHealthRouter;
