import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withoutPassword } from './sanitize.js';

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
      if (!roommate || !roommate.password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const storedPassword = roommate.password ?? '';
      const isHashed = /^\$2[aby]\$/.test(storedPassword);
      const passwordMatches = isHashed
        ? await bcrypt.compare(password, storedPassword)
        : storedPassword === password;
      if (!passwordMatches) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!isHashed) {
        const hashedPassword = await bcrypt.hash(password, 12);
        await prisma.roommate.update({
          where: { id: roommate.id },
          data: { password: hashedPassword },
        });
      }
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET is not configured');
        return res.status(500).json({ error: 'Server misconfigured' });
      }
      const token = jwt.sign({ sub: roommate.id }, secret, { expiresIn: '7d' });
      res.json({ token, user: withoutPassword(roommate) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to sign in' });
    }
  });

  return router;
};

export default createAuthRouter;
