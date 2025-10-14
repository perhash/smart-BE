import { PrismaClient } from '@prisma/client';

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

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const ordersToday = await prisma.order.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow
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
    const recentOrders = await prisma.order.findMany({
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

    const activities = recentOrders.map(order => ({
      id: order.id,
      text: `Order ${order.id} from ${order.customer.name}`,
      time: order.createdAt,
      status: order.status.toLowerCase(),
      type: 'order'
    }));

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
