import { PrismaClient } from '@prisma/client';
import { getTodayPktDate, getPktDateRangeUtc, formatPktDate } from '../utils/timezone.js';

const prisma = new PrismaClient();

// Get daily closing summary for today (without saving)
export const getDailyClosingSummary = async (req, res) => {
  try {
    const todayPktDate = getTodayPktDate();
    const { start, end } = getPktDateRangeUtc(todayPktDate);

    // Check if orders are in progress
    const inProgressOrders = await prisma.order.count({
      where: {
        status: 'IN_PROGRESS'
      }
    });

    // Get all active customers
    const activeCustomers = await prisma.customer.findMany({
      where: {
        isActive: true
      },
      select: {
        currentBalance: true
      }
    });

    // Calculate customer payable (sum of negative balances)
    const customerPayable = activeCustomers
      .filter(c => parseFloat(c.currentBalance) < 0)
      .reduce((sum, c) => sum + Math.abs(parseFloat(c.currentBalance)), 0);

    // Calculate customer receivable (sum of positive balances)
    const customerReceivable = activeCustomers
      .filter(c => parseFloat(c.currentBalance) > 0)
      .reduce((sum, c) => sum + parseFloat(c.currentBalance), 0);

    // Get today's orders (excluding cancelled)
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: {
          not: 'CANCELLED'
        }
      },
      select: {
        paidAmount: true,
        currentOrderAmount: true,
        numberOfBottles: true
      }
    });

    // Calculate totals
    const totalPaidAmount = todayOrders.reduce(
      (sum, order) => sum + parseFloat(order.paidAmount),
      0
    );

    const totalCurrentOrderAmount = todayOrders.reduce(
      (sum, order) => sum + parseFloat(order.currentOrderAmount),
      0
    );

    const balanceClearedToday = totalCurrentOrderAmount - totalPaidAmount;

    const totalBottles = todayOrders.reduce(
      (sum, order) => sum + order.numberOfBottles,
      0
    );

    const totalOrders = todayOrders.length;

    // Check if closing already exists for today
    const existingClosing = await prisma.dailyClosing.findUnique({
      where: {
        date: new Date(todayPktDate + 'T00:00:00Z')
      }
    });

    res.json({
      success: true,
      data: {
        date: todayPktDate,
        customerPayable,
        customerReceivable,
        totalPaidAmount,
        totalCurrentOrderAmount,
        balanceClearedToday,
        totalBottles,
        totalOrders,
        canClose: inProgressOrders === 0,
        inProgressOrdersCount: inProgressOrders,
        alreadyExists: !!existingClosing
      }
    });
  } catch (error) {
    console.error('Error fetching daily closing summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily closing summary',
      error: error.message
    });
  }
};

// Create or update daily closing
export const saveDailyClosing = async (req, res) => {
  try {
    const todayPktDate = getTodayPktDate();
    const { start, end } = getPktDateRangeUtc(todayPktDate);

    // Check if orders are in progress
    const inProgressOrders = await prisma.order.count({
      where: {
        status: 'IN_PROGRESS'
      }
    });

    if (inProgressOrders > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot close counter when there are orders in progress'
      });
    }

    // Get all active customers
    const activeCustomers = await prisma.customer.findMany({
      where: {
        isActive: true
      },
      select: {
        currentBalance: true
      }
    });

    // Calculate customer payable (sum of negative balances)
    const customerPayable = activeCustomers
      .filter(c => parseFloat(c.currentBalance) < 0)
      .reduce((sum, c) => sum + Math.abs(parseFloat(c.currentBalance)), 0);

    // Calculate customer receivable (sum of positive balances)
    const customerReceivable = activeCustomers
      .filter(c => parseFloat(c.currentBalance) > 0)
      .reduce((sum, c) => sum + parseFloat(c.currentBalance), 0);

    // Get today's orders (excluding cancelled)
    const todayOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: {
          not: 'CANCELLED'
        }
      },
      select: {
        paidAmount: true,
        currentOrderAmount: true,
        numberOfBottles: true
      }
    });

    // Calculate totals
    const totalPaidAmount = todayOrders.reduce(
      (sum, order) => sum + parseFloat(order.paidAmount),
      0
    );

    const totalCurrentOrderAmount = todayOrders.reduce(
      (sum, order) => sum + parseFloat(order.currentOrderAmount),
      0
    );

    const balanceClearedToday = totalCurrentOrderAmount - totalPaidAmount;

    const totalBottles = todayOrders.reduce(
      (sum, order) => sum + order.numberOfBottles,
      0
    );

    const totalOrders = todayOrders.length;

    // Create or update the daily closing
    const closingDate = new Date(todayPktDate + 'T00:00:00Z');
    
    const dailyClosing = await prisma.dailyClosing.upsert({
      where: {
        date: closingDate
      },
      update: {
        customerPayable,
        customerReceivable,
        totalPaidAmount,
        totalCurrentOrderAmount,
        balanceClearedToday,
        totalBottles,
        totalOrders
      },
      create: {
        date: closingDate,
        customerPayable,
        customerReceivable,
        totalPaidAmount,
        totalCurrentOrderAmount,
        balanceClearedToday,
        totalBottles,
        totalOrders
      }
    });

    res.json({
      success: true,
      message: 'Daily closing saved successfully',
      data: dailyClosing
    });
  } catch (error) {
    console.error('Error saving daily closing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save daily closing',
      error: error.message
    });
  }
};

// Get all daily closings
export const getAllDailyClosings = async (req, res) => {
  try {
    const dailyClosings = await prisma.dailyClosing.findMany({
      orderBy: {
        date: 'desc'
      }
    });

    const formattedClosings = dailyClosings.map(closing => ({
      id: closing.id,
      date: formatPktDate(closing.date),
      customerPayable: parseFloat(closing.customerPayable),
      customerReceivable: parseFloat(closing.customerReceivable),
      totalPaidAmount: parseFloat(closing.totalPaidAmount),
      totalCurrentOrderAmount: parseFloat(closing.totalCurrentOrderAmount),
      balanceClearedToday: parseFloat(closing.balanceClearedToday),
      totalBottles: closing.totalBottles,
      totalOrders: closing.totalOrders,
      createdAt: closing.createdAt,
      updatedAt: closing.updatedAt
    }));

    res.json({
      success: true,
      data: formattedClosings
    });
  } catch (error) {
    console.error('Error fetching daily closings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily closings',
      error: error.message
    });
  }
};

