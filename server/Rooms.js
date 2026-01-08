import { Router } from 'express';
import { withoutPasswords } from './sanitize.js';

const generateInviteCode = () => `ROOM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

const getUniqueInviteCode = async prisma => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateInviteCode();
    const existing = await prisma.room.findFirst({ where: { inviteCode: code } });
    if (!existing) return code;
  }
  throw new Error('Failed to generate unique invite code');
};

const createRoomsRouter = (prisma, auth) => {
  const router = Router();

  router.get('/rooms', auth, async (req, res) => {
    try {
      if (!req.user.roomId) return res.json([]);
      const rooms = await prisma.room.findMany({
        where: { id: req.user.roomId },
      });
      res.json(rooms);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch rooms' });
    }
  });

  router.post('/rooms/join', auth, async (req, res) => {
    try {
      const { inviteCode } = req.body;
      if (!inviteCode) return res.status(400).json({ error: 'inviteCode required' });

      const room = await prisma.room.findFirst({
        where: { inviteCode: inviteCode.trim() },
      });
      if (!room) return res.status(404).json({ error: 'Room not found' });

      if (req.user.roomId && req.user.roomId !== room.id) {
        return res.status(409).json({ error: 'Already in a room' });
      }
      if (!req.user.roomId) {
        await prisma.roommate.update({
          where: { id: req.user.id },
          data: { roomId: room.id, isManager: false },
        });
      }

      res.json(room);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to join room' });
    }
  });

  router.post('/rooms', auth, async (req, res) => {
    try {
      const { name, inviteCode } = req.body;
      if (!name) return res.status(400).json({ error: 'Room name is required' });
      if (!req.user.email) return res.status(403).json({ error: 'Email required' });

      const trimmedCode = inviteCode?.trim();
      const code = trimmedCode ? trimmedCode : await getUniqueInviteCode(prisma);
      if (trimmedCode) {
        const existing = await prisma.room.findFirst({ where: { inviteCode: code } });
        if (existing) return res.status(400).json({ error: 'Invite code already exists' });
      }

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

  router.patch('/rooms/:roomId', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId || !req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { name, inviteCode } = req.body;
      const data = {};
      if (name) data.name = name.trim();
      if (inviteCode) data.inviteCode = inviteCode.trim();

      if (!data.name && !data.inviteCode) {
        return res.status(400).json({ error: 'name or inviteCode required' });
      }

      if (data.inviteCode) {
        const existing = await prisma.room.findFirst({
          where: { inviteCode: data.inviteCode },
        });
        if (existing && existing.id !== req.params.roomId) {
          return res.status(400).json({ error: 'Invite code already exists' });
        }
      }

      const room = await prisma.room.update({
        where: { id: req.params.roomId },
        data,
      });
      res.json(room);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update room' });
    }
  });

  router.post('/rooms/:roomId/invite-code', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId || !req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const inviteCode = await getUniqueInviteCode(prisma);
      const room = await prisma.room.update({
        where: { id: req.params.roomId },
        data: { inviteCode },
      });
      res.json(room);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to regenerate invite code' });
    }
  });

  router.delete('/rooms/:roomId', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId || !req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const existing = await prisma.room.findUnique({
        where: { id: req.params.roomId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ error: 'Room not found' });

      await prisma.$transaction(async tx => {
        await tx.expense.deleteMany({ where: { roomId: req.params.roomId } });
        await tx.roommate.deleteMany({ where: { roomId: req.params.roomId } });
        await tx.room.delete({ where: { id: req.params.roomId } });
      });

      res.json({ status: 'deleted' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

  return router;
};

export default createRoomsRouter;
