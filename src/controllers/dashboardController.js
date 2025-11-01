import { PrismaClient } from '@prisma/client';
import { getTodayPktUtcRange, formatPktDate } from '../utils/timezone.js';

const prisma = new PrismaClient();

// Get dashboard statistics
export const getDashboardStats = async (req, res) => {
  try {
    // Get total customers
    const totalCustomers = await prisma.customer.count({
      where: { isActive: true }
    });

    // Get total riders
    const totalRiders = await prisma.riderProfile.count({
      where: { isActive: true }
    });

    // Get today's orders (using PKT timezone)
    const todayRange = getTodayPktUtcRange();

    const ordersToday = await prisma.order.count({
      where: {
        createdAt: {
          gte: todayRange.start,
          lte: todayRange.end
        }
      }
    });

    // Get pending orders
    const pendingOrders = await prisma.order.count({
      where: { status: 'PENDING' }
    });

    // Get pending payments
    const pendingPayments = await prisma.order.aggregate({
      where: {
        paymentStatus: 'NOT_PAID'
      },
      _sum: {
        totalAmount: true
      }
    });

    const stats = {
      totalCustomers,
      totalRiders,
      ordersToday,
      pendingOrders,
      pendingPayments: pendingPayments._sum.totalAmount || 0
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// Get recent activities
export const getRecentActivities = async (req, res) => {
  try {
    // Only get today's orders in PKT timezone
    const todayRange = getTodayPktUtcRange();

    const recentOrders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: todayRange.start,
          lte: todayRange.end
        }
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { name: true }
        },
        rider: {
          select: { name: true }
        }
      }
    });

    const activities = recentOrders.map(order => {
      // Convert Prisma Decimal to number - Decimal types need toString() first
      const totalAmount = order.totalAmount ? parseFloat(order.totalAmount.toString()) : 0;
      const paidAmount = order.paidAmount ? parseFloat(order.paidAmount.toString()) : 0;
      
      // orderType is enum: WALKIN, DELIVERY, CLEARBILL
      const orderType = order.orderType || 'DELIVERY';
      
      return {
        id: order.id,
        text: `Order #${order.id.slice(-4)} from ${order.customer.name}`,
        time: order.createdAt, // Frontend will format this
        date: formatPktDate(order.createdAt), // Add PKT date for reference
        status: order.status.toLowerCase(),
        type: 'order',
        orderType: orderType, // Keep as enum: WALKIN, DELIVERY, CLEARBILL
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        paymentStatus: order.paymentStatus, // PAID, NOT_PAID, PARTIAL, OVERPAID, REFUND
        deliveredAt: order.deliveredAt || null // Will be formatted in PKT on frontend
      };
    });

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: error.message
    });
  }
};
