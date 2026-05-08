import { Router } from 'express';

const createContributionRouter = (prisma, auth) => {
  const router = Router();

  // GET /rooms/:roomId/bank
  // Returns bank summary: total contributed, total spent, balance, profit/loss, per-person breakdown
  router.get('/rooms/:roomId/bank', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { roomId } = req.params;

      // Fetch all periods with their contributions
      const periods = await prisma.contributionPeriod.findMany({
        where: { roomId },
        include: { contributions: true },
      });

      // Fetch all approved expenses
      const approvedExpenses = await prisma.expense.findMany({
        where: { roomId, status: 'approved' },
        select: { amount: true },
      });

      // Fetch all roommates in room
      const roommates = await prisma.roommate.findMany({
        where: { roomId },
        select: { id: true, name: true, email: true },
      });

      const totalContributed = periods
        .flatMap(p => p.contributions)
        .reduce((sum, c) => sum + c.amountPaid, 0);

      const totalSpent = approvedExpenses.reduce((sum, e) => sum + e.amount, 0);
      const bankBalance = totalContributed - totalSpent;

      // Per-person breakdown
      const perPerson = roommates.map(rm => {
        let totalOwed = 0;
        let totalPaid = 0;
        let outstandingDues = 0;

        for (const period of periods) {
          totalOwed += period.amountPerPerson;
          const contribution = period.contributions.find(c => c.roommateId === rm.id);
          const paid = contribution?.amountPaid ?? 0;
          totalPaid += paid;
          const shortfall = period.amountPerPerson - paid;
          if (shortfall > 0) outstandingDues += shortfall;
        }

        return {
          roommateId: rm.id,
          name: rm.name,
          email: rm.email,
          totalOwed: Number(totalOwed.toFixed(2)),
          totalPaid: Number(totalPaid.toFixed(2)),
          outstandingDues: Number(outstandingDues.toFixed(2)),
        };
      });

      res.json({
        totalContributed: Number(totalContributed.toFixed(2)),
        totalSpent: Number(totalSpent.toFixed(2)),
        bankBalance: Number(bankBalance.toFixed(2)),
        profitLoss: Number(bankBalance.toFixed(2)),
        perPerson,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch bank summary' });
    }
  });

  // GET /rooms/:roomId/contribution-periods
  // Returns all periods with their contributions
  router.get('/rooms/:roomId/contribution-periods', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const periods = await prisma.contributionPeriod.findMany({
        where: { roomId: req.params.roomId },
        include: {
          contributions: {
            include: {
              roommate: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      });

      res.json(periods);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch contribution periods' });
    }
  });

  // POST /rooms/:roomId/contribution-periods
  // Create a new contribution period (manager only)
  router.post('/rooms/:roomId/contribution-periods', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { month, year, amountPerPerson } = req.body;
      if (!month || !year || amountPerPerson == null) {
        return res.status(400).json({ error: 'month, year, amountPerPerson required' });
      }
      if (month < 1 || month > 12) {
        return res.status(400).json({ error: 'month must be 1–12' });
      }
      if (amountPerPerson <= 0) {
        return res.status(400).json({ error: 'amountPerPerson must be positive' });
      }

      // Check for duplicate period
      const existing = await prisma.contributionPeriod.findFirst({
        where: {
          roomId: req.params.roomId,
          month: Number(month),
          year: Number(year),
        },
      });
      if (existing) {
        return res.status(409).json({ error: 'A period for this month/year already exists' });
      }

      const period = await prisma.contributionPeriod.create({
        data: {
          roomId: req.params.roomId,
          month: Number(month),
          year: Number(year),
          amountPerPerson: Number(amountPerPerson),
        },
        include: { contributions: true },
      });

      res.json(period);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create contribution period' });
    }
  });

  // PUT /rooms/:roomId/contribution-periods/:periodId/payments/:roommateId
  // Record/update a member's payment for a period (manager only, upsert pattern)
  router.put('/rooms/:roomId/contribution-periods/:periodId/payments/:roommateId', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (!req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { amountPaid } = req.body;
      if (amountPaid == null || Number(amountPaid) < 0) {
        return res.status(400).json({ error: 'amountPaid must be >= 0' });
      }

      // Verify period belongs to the room
      const period = await prisma.contributionPeriod.findUnique({
        where: { id: req.params.periodId },
        select: { roomId: true },
      });
      if (!period) return res.status(404).json({ error: 'Period not found' });
      if (period.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Verify roommate belongs to the room
      const roommate = await prisma.roommate.findUnique({
        where: { id: req.params.roommateId },
        select: { roomId: true },
      });
      if (!roommate || roommate.roomId !== req.params.roomId) {
        return res.status(404).json({ error: 'Roommate not found in this room' });
      }

      // findFirst + create/update pattern (safer than upsert for MongoDB compound keys)
      const existing = await prisma.contribution.findFirst({
        where: {
          periodId: req.params.periodId,
          roommateId: req.params.roommateId,
        },
      });

      let contribution;
      if (existing) {
        contribution = await prisma.contribution.update({
          where: { id: existing.id },
          data: { amountPaid: Number(amountPaid) },
        });
      } else {
        contribution = await prisma.contribution.create({
          data: {
            periodId: req.params.periodId,
            roommateId: req.params.roommateId,
            amountPaid: Number(amountPaid),
          },
        });
      }

      res.json(contribution);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update payment' });
    }
  });

  return router;
};

export default createContributionRouter;
