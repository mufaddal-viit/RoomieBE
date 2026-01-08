import jwt from 'jsonwebtoken';

const getBearerToken = req => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const createAuthMiddleware = prisma => {
  return async (req, res, next) => {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authorization token required' });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET is not configured');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = typeof payload === 'string' ? payload : payload?.sub;
    if (!userId) return res.status(401).json({ error: 'Invalid token' });

    try {
      const roommate = await prisma.roommate.findUnique({
        where: { id: userId },
        select: { id: true, email: true, isManager: true, roomId: true },
      });
      if (!roommate) return res.status(401).json({ error: 'Invalid token' });
      req.user = roommate;
      return next();
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Auth check failed' });
    }
  };
};
