import { Router } from 'express';

const createAuthRouter = prisma => {
  const router = Router();

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
      const normalizedEmail = email.trim().toLowerCase();
      const roommate = await prisma.roommate.findFirst({
        where: { email: normalizedEmail },
        include: { room: true },
      });
      if (!roommate || roommate.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      res.json(roommate);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to sign in' });
    }
  });

  return router;
};

export default createAuthRouter;
