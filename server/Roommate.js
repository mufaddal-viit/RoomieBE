import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { withoutPassword, withoutPasswords } from './sanitize.js';

const createRoommateRouter = (prisma, auth) => {
  const router = Router();

  router.get('/rooms/:roomId/roommates', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const roommates = await prisma.roommate.findMany({
        where: { roomId: req.params.roomId },
        orderBy: { createdAt: 'asc' },
      });
      res.json(withoutPasswords(roommates));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch roommates' });
    }
  });

  router.post('/roommates/register', async (req, res) => {
  try {
    const { name, email, password, roomId: inviteCode } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email, and password are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailExists = await prisma.roommate.findFirst({
      where: { email: normalizedEmail },
    });

    if (emailExists) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    let room = null;
    let isManager = false;

    if (typeof inviteCode === 'string' && inviteCode.trim()) {
      const trimmedInviteCode = inviteCode.trim();

      room = await prisma.room.findUnique({
        where: { inviteCode: trimmedInviteCode },
      });

      if (!room) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      const existingRoommate = await prisma.roommate.findFirst({
        where: { roomId: room.id },
      });

      // First person in the room becomes manager
      isManager = !existingRoommate;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const roommate = await prisma.roommate.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        isManager,
        ...(room ? { roomId: room.id } : {}),
      },
    });

    res.json(withoutPassword(roommate));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create roommate' });
  }
});


  router.post('/roommates/add-member', auth, async (req, res) => {
    try {
      if (!req.user.roomId) {
        return res.status(400).json({ error: 'User must belong to a room' });
      }
      if (!req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { roommateId, email } = req.body;
      if (!roommateId && !email) {
        return res.status(400).json({ error: 'roommateId or email is required' });
      }

      const normalizedEmail = email?.trim().toLowerCase();
      const roommate = await prisma.roommate.findFirst({
        where: roommateId
          ? { id: roommateId }
          : { email: normalizedEmail },
      });

      if (!roommate) {
        return res.status(404).json({ error: 'Roommate not found' });
      }
      if (roommate.roomId && roommate.roomId !== req.user.roomId) {
        return res.status(409).json({ error: 'Roommate already in another room' });
      }
      if (roommate.roomId === req.user.roomId) {
        return res.status(409).json({ error: 'Roommate already in this room' });
      }

      const updatedRoommate = await prisma.roommate.update({
        where: { id: roommate.id },
        data: { roomId: req.user.roomId, isManager: false },
      });
      res.json(withoutPassword(updatedRoommate));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to add roommate to room' });
    }
  });

  return router;
};

export default createRoommateRouter;
