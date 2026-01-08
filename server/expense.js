
import { Router } from 'express';
import { ExpenseStatus } from '@prisma/client';
import { withoutPassword } from './sanitize.js';

const createExpensesRouter = (prisma, auth) => {
  const router = Router();

  router.get('/rooms/:roomId/expenses', auth, async (req, res) => {
    try {
      if (req.user.roomId !== req.params.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      const expenses = await prisma.expense.findMany({
        where: { roomId: req.params.roomId },
        include: {
          addedBy: true,
          approvedBy: true,
        },
        orderBy: { date: 'desc' },
      });
      const shaped = expenses.map(expense => ({
        ...expense,
        addedBy: withoutPassword(expense.addedBy),
        approvedBy: withoutPassword(expense.approvedBy),
        addedByName: expense.addedBy?.name,
        approvedByName: expense.approvedBy?.name,
      }));
      res.json(shaped);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  router.post('/rooms/:roomId/expenses', auth, async (req, res) => {
    try {
      const { description, amount, category, date, addedById } = req.body;
      if (!description || !amount || !category || !date || !addedById) {
        return res.status(400).json({ error: 'description, amount, category, date, addedById required' });
      }
      if (req.user.roomId !== req.params.roomId || req.user.id !== addedById) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const expense = await prisma.expense.create({
        data: {
          description: description.trim(),
          amount: Number(amount),
          category,
          date: new Date(date),
          roomId: req.params.roomId,
          addedById,
        },
      });
      const withNames = await prisma.expense.findUnique({
        where: { id: expense.id },
        include: { addedBy: true },
      });
      res.json({
        ...expense,
        addedByName: withNames?.addedBy?.name,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to create expense' });
    }
  });

  router.post('/expenses/:expenseId/status', auth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status || !Object.values(ExpenseStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      if (!req.user.isManager) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const existing = await prisma.expense.findUnique({
        where: { id: req.params.expenseId },
        select: { roomId: true },
      });
      if (!existing) return res.status(404).json({ error: 'Expense not found' });
      if (existing.roomId !== req.user.roomId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const expense = await prisma.expense.update({
        where: { id: req.params.expenseId },
        data: {
          status,
          approvedById: status === 'pending' ? null : req.user.id,
          approvedAt: status === 'pending' ? null : new Date(),
        },
      });
      const withNames = await prisma.expense.findUnique({
        where: { id: expense.id },
        include: { addedBy: true, approvedBy: true },
      });
      res.json({
        ...expense,
        addedByName: withNames?.addedBy?.name,
        approvedByName: withNames?.approvedBy?.name,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update expense status' });
    }
  });

  return router;
};

export default createExpensesRouter;
