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

  router.post('/roommates', auth, async (req, res) => {
    try {
      const { name, email, password, roomId, isManager } = req.body;
      if (!name || !email || !password || !roomId) {
        return res.status(400).json({ error: 'name, email, password, and roomId are required' });
      }
      if (req.user.roomId !== roomId || !req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const emailExists = await prisma.roommate.findFirst({
        where: { email: normalizedEmail },
      });
      if (emailExists) return res.status(400).json({ error: 'Email already exists' });

      const managerExists = await prisma.roommate.findFirst({
        where: { roomId },
      });

      const hashedPassword = await bcrypt.hash(password, 12);
      const roommate = await prisma.roommate.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          password: hashedPassword,
          isManager: managerExists ? Boolean(isManager) : true,
          roomId,
        },
      });
      res.json(withoutPassword(roommate));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create roommate' });
    }
  });

  return router;
};

export default createRoommateRouter;
