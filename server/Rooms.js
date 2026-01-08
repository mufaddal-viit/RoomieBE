import { Router } from 'express';
import { withoutPasswords } from './sanitize.js';

const createRoomsRouter = (prisma, auth) => {
  const router = Router();

  router.post('/rooms', auth, async (req, res) => {
    try {
      const { name, inviteCode } = req.body;
      if (!name) return res.status(400).json({ error: 'Room name is required' });
      if (!req.user.email) return res.status(403).json({ error: 'Email required' });

      const code = inviteCode ?? `ROOM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const existing = await prisma.room.findFirst({ where: { inviteCode: code } });
      if (existing) return res.status(400).json({ error: 'Invite code already exists' });

      const room = await prisma.$transaction(async tx => {
        const created = await tx.room.create({
          data: { name, inviteCode: code },
        });
        await tx.roommate.update({
          where: { id: req.user.id },
          data: { roomId: created.id, isManager: true },
        });
        return created;
      });
      res.json(room);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  router.get('/rooms/:roomId', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const room = await prisma.room.findUnique({
        where: { id: req.params.roomId },
        include: { roommates: true },
      });
      if (!room) return res.status(404).json({ error: 'Room not found' });
      res.json({
        ...room,
        roommates: withoutPasswords(room.roommates),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch room' });
    }
  });

  return router;
};

export default createRoomsRouter;
