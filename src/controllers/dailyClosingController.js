import { PrismaClient } from '@prisma/client';
import { getTodayPktDate, getPktDateRangeUtc, formatPktDate } from '../utils/timezone.js';

const prisma = new PrismaClient();

// Get daily closing summary for today (without saving)
export const getDailyClosingSummary = async (req, res) => {
  try {
    const todayPktDate = getTodayPktDate();
    const { start, end } = getPktDateRangeUtc(todayPktDate);

    // Check if orders are in progress (PENDING, ASSIGNED, IN_PROGRESS, CREATED)
    // These statuses indicate orders that are not completed and should block daily closing
    const inProgressOrders = await prisma.order.count({
      where: {
        status: {
          in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'CREATED']
        }
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

    // Get today's orders (excluding cancelled) with more details
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
        numberOfBottles: true,
        riderId: true,
        paymentMethod: true,
        orderType: true
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

    const walkInAmount = todayOrders
      .filter(order => order.orderType === 'WALKIN')
      .reduce((sum, order) => sum + parseFloat(order.paidAmount), 0);

    const clearBillAmount = todayOrders
      .filter(order => order.orderType === 'CLEARBILL')
      .reduce((sum, order) => sum + parseFloat(order.paidAmount), 0);

    const balanceClearedToday = totalCurrentOrderAmount - totalPaidAmount;

    const totalBottles = todayOrders.reduce(
      (sum, order) => sum + order.numberOfBottles,
      0
    );

    const totalOrders = todayOrders.length;

    // Group by rider for collections
    const riderCollectionsMap = new Map();
    todayOrders.forEach(order => {
      if (!order.riderId) return; // Skip orders without riders
      if (riderCollectionsMap.has(order.riderId)) {
        const existing = riderCollectionsMap.get(order.riderId);
        existing.amount += parseFloat(order.paidAmount);
        existing.ordersCount += 1;
      } else {
        riderCollectionsMap.set(order.riderId, {
          amount: parseFloat(order.paidAmount),
          ordersCount: 1
        });
      }
    });

    // Fetch rider names
    const riderIds = Array.from(riderCollectionsMap.keys());
    const riders = await prisma.riderProfile.findMany({
      where: { id: { in: riderIds } },
      select: { id: true, name: true }
    });

    const ridersMap = new Map(riders.map(r => [r.id, r.name]));

    const riderCollections = Array.from(riderCollectionsMap.entries()).map(([riderId, data]) => ({
      riderId,
      riderName: ridersMap.get(riderId) || 'Unknown',
      amount: data.amount,
      ordersCount: data.ordersCount
    }));

    // Group by payment method
    const paymentMethodsMap = new Map();
    todayOrders.forEach(order => {
      const method = order.paymentMethod;
      if (paymentMethodsMap.has(method)) {
        const existing = paymentMethodsMap.get(method);
        existing.amount += parseFloat(order.paidAmount);
        existing.ordersCount += 1;
      } else {
        paymentMethodsMap.set(method, {
          amount: parseFloat(order.paidAmount),
          ordersCount: 1
        });
      }
    });

    const paymentMethods = Array.from(paymentMethodsMap.entries()).map(([method, data]) => ({
      method,
      amount: data.amount,
      ordersCount: data.ordersCount
    }));

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
        walkInAmount,
        clearBillAmount,
        balanceClearedToday,
        totalBottles,
        totalOrders,
        riderCollections,
        paymentMethods,
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

    // Check if orders are in progress (PENDING, ASSIGNED, IN_PROGRESS, CREATED)
    // These statuses indicate orders that are not completed and should block daily closing
    const inProgressOrders = await prisma.order.count({
      where: {
        status: {
          in: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'CREATED']
        }
      }
    });

    if (inProgressOrders > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot close counter when there are ${inProgressOrders} order(s) in progress. Please complete all pending orders first.`,
        inProgressOrdersCount: inProgressOrders
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

    // Get today's orders (excluding cancelled) with more details
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
        numberOfBottles: true,
        riderId: true,
        paymentMethod: true,
        orderType: true
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

    const walkInAmount = todayOrders
      .filter(order => order.orderType === 'WALKIN')
      .reduce((sum, order) => sum + parseFloat(order.paidAmount), 0);

    const clearBillAmount = todayOrders
      .filter(order => order.orderType === 'CLEARBILL')
      .reduce((sum, order) => sum + parseFloat(order.paidAmount), 0);

    const balanceClearedToday = totalCurrentOrderAmount - totalPaidAmount;

    const totalBottles = todayOrders.reduce(
      (sum, order) => sum + order.numberOfBottles,
      0
    );

    const totalOrders = todayOrders.length;

    // Group by rider for collections
    const riderCollectionsMap = new Map();
    todayOrders.forEach(order => {
      if (!order.riderId) return; // Skip orders without riders
      if (riderCollectionsMap.has(order.riderId)) {
        const existing = riderCollectionsMap.get(order.riderId);
        existing.amount += parseFloat(order.paidAmount);
        existing.ordersCount += 1;
      } else {
        riderCollectionsMap.set(order.riderId, {
          amount: parseFloat(order.paidAmount),
          ordersCount: 1
        });
      }
    });

    // Group by payment method
    const paymentMethodsMap = new Map();
    todayOrders.forEach(order => {
      const method = order.paymentMethod;
      if (paymentMethodsMap.has(method)) {
        const existing = paymentMethodsMap.get(method);
        existing.amount += parseFloat(order.paidAmount);
        existing.ordersCount += 1;
      } else {
        paymentMethodsMap.set(method, {
          amount: parseFloat(order.paidAmount),
          ordersCount: 1
        });
      }
    });

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
        walkInAmount,
        clearBillAmount,
        balanceClearedToday,
        totalBottles,
        totalOrders,
        // Delete old rider collections and payment methods
        riderCollections: {
          deleteMany: {}
        },
        paymentMethods: {
          deleteMany: {}
        }
      },
      create: {
        date: closingDate,
        customerPayable,
        customerReceivable,
        totalPaidAmount,
        totalCurrentOrderAmount,
        walkInAmount,
        clearBillAmount,
        balanceClearedToday,
        totalBottles,
        totalOrders
      }
    });

    // Create rider collections
    const riderCollections = Array.from(riderCollectionsMap.entries()).map(([riderId, data]) => ({
      dailyClosingId: dailyClosing.id,
      riderId: riderId,
      amount: data.amount,
      ordersCount: data.ordersCount
    }));

    if (riderCollections.length > 0) {
      await prisma.dailyClosingRider.createMany({
        data: riderCollections
      });
    }

    // Create payment method breakdowns
    const paymentMethods = Array.from(paymentMethodsMap.entries()).map(([method, data]) => ({
      dailyClosingId: dailyClosing.id,
      paymentMethod: method,
      amount: data.amount,
      ordersCount: data.ordersCount
    }));

    if (paymentMethods.length > 0) {
      await prisma.dailyClosingPayment.createMany({
        data: paymentMethods
      });
    }

    // Fetch the complete closing with relations
    const completeClosing = await prisma.dailyClosing.findUnique({
      where: { id: dailyClosing.id },
      include: {
        riderCollections: {
          include: {
            rider: {
              select: { name: true }
            }
          }
        },
        paymentMethods: true
      }
    });

    res.json({
      success: true,
      message: 'Daily closing saved successfully',
      data: completeClosing
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
      },
      include: {
        riderCollections: {
          include: {
            rider: {
              select: { name: true }
            }
          }
        },
        paymentMethods: true
      }
    });

    const formattedClosings = dailyClosings.map(closing => ({
      id: closing.id,
      date: formatPktDate(closing.date),
      customerPayable: parseFloat(closing.customerPayable),
      customerReceivable: parseFloat(closing.customerReceivable),
      totalPaidAmount: parseFloat(closing.totalPaidAmount),
      totalCurrentOrderAmount: parseFloat(closing.totalCurrentOrderAmount),
      walkInAmount: parseFloat(closing.walkInAmount),
      clearBillAmount: parseFloat(closing.clearBillAmount),
      balanceClearedToday: parseFloat(closing.balanceClearedToday),
      totalBottles: closing.totalBottles,
      totalOrders: closing.totalOrders,
      riderCollections: closing.riderCollections.map(rc => ({
        riderName: rc.rider?.name || 'Unknown',
        amount: parseFloat(rc.amount),
        ordersCount: rc.ordersCount
      })),
      paymentMethods: closing.paymentMethods.map(pm => ({
        method: pm.paymentMethod,
        amount: parseFloat(pm.amount),
        ordersCount: pm.ordersCount
      })),
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

