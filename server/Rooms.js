import { Router } from 'express';

const createRoomsRouter = prisma => {
  const router = Router();

  router.post('/rooms', async (req, res) => {
    try {
      const { name, inviteCode } = req.body;
      if (!name) return res.status(400).json({ error: 'Room name is required' });

      const code = inviteCode ?? `ROOM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const existing = await prisma.room.findFirst({ where: { inviteCode: code } });
      if (existing) return res.status(400).json({ error: 'Invite code already exists' });

      const room = await prisma.room.create({
        data: { name, inviteCode: code },
      });
      res.json(room);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  router.get('/rooms/:roomId', async (req, res) => {
    try {
      const room = await prisma.room.findUnique({
        where: { id: req.params.roomId },
        include: { roommates: true },
      });
      if (!room) return res.status(404).json({ error: 'Room not found' });
      res.json(room);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  return router;
};

export default createRoomsRouter;
