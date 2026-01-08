
import { Router } from 'express';
import { ExpenseStatus } from '@prisma/client';

const createExpensesRouter = prisma => {
  const router = Router();

  router.get('/rooms/:roomId/expenses', async (req, res) => {
    try {
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
        addedByName: expense.addedBy?.name,
        approvedByName: expense.approvedBy?.name,
      }));
      res.json(shaped);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch expenses' });
    }
  });

  router.post('/rooms/:roomId/expenses', async (req, res) => {
    try {
      const { description, amount, category, date, addedById } = req.body;
      if (!description || !amount || !category || !date || !addedById) {
        return res.status(400).json({ error: 'description, amount, category, date, addedById required' });
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

  router.post('/expenses/:expenseId/status', async (req, res) => {
    try {
      const { status, approverId } = req.body;
      if (!status || !Object.values(ExpenseStatus).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const expense = await prisma.expense.update({
        where: { id: req.params.expenseId },
        data: {
          status,
          approvedById: approverId ?? null,
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
