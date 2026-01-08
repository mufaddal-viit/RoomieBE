import { Router } from 'express';

const createRoommateRouter = prisma => {
  const router = Router();

  router.get('/rooms/:roomId/roommates', async (req, res) => {
    try {
      const roommates = await prisma.roommate.findMany({
        where: { roomId: req.params.roomId },
        orderBy: { createdAt: 'asc' },
      });
      res.json(roommates);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch roommates' });
    }
  });

  router.post('/roommates', async (req, res) => {
    try {
      const { name, email, password, roomId, isManager } = req.body;
      if (!name || !email || !password || !roomId) {
        return res.status(400).json({ error: 'name, email, password, and roomId are required' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const emailExists = await prisma.roommate.findFirst({
        where: { email: normalizedEmail },
      });
      if (emailExists) return res.status(400).json({ error: 'Email already exists' });

      const managerExists = await prisma.roommate.findFirst({
        where: { roomId },
      });

      const roommate = await prisma.roommate.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password,
          isManager: managerExists ? Boolean(isManager) : true,
          roomId,
        },
      });
      res.json(roommate);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create roommate' });
    }
  });

  return router;
};

export default createRoommateRouter;
