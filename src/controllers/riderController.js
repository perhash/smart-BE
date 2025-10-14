import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all riders
export const getAllRiders = async (req, res) => {
  try {
    const riders = await prisma.riderProfile.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: { email: true, phone: true }
        },
        orders: {
          where: {
            status: {
              in: ['ASSIGNED', 'IN_PROGRESS', 'DELIVERED']
            }
          },
          include: {
            customer: {
              select: { name: true, phone: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedRiders = riders.map(rider => ({
      id: rider.id,
      name: rider.name,
      phone: rider.phone,
      email: rider.user.email,
      isActive: rider.isActive,
      totalDeliveries: rider.orders.filter(o => o.status === 'DELIVERED').length,
      pendingDeliveries: rider.orders.filter(o => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').length,
      currentOrders: rider.orders.filter(o => o.status === 'ASSIGNED' || o.status === 'IN_PROGRESS').map(order => ({
        id: `#${order.id.slice(-4)}`,
        customer: order.customer.name,
        phone: order.customer.phone,
        amount: parseFloat(order.totalAmount),
        status: order.status.toLowerCase()
      })),
      createdAt: rider.createdAt.toISOString().split('T')[0]
    }));

    res.json({
      success: true,
      data: formattedRiders
    });
  } catch (error) {
    console.error('Error fetching riders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch riders',
      error: error.message
    });
  }
};

// Get rider by ID
export const getRiderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const rider = await prisma.riderProfile.findUnique({
      where: { id },
      include: {
        user: true,
        orders: {
          orderBy: { createdAt: 'desc' },
          include: {
            customer: {
              select: { name: true, phone: true }
            }
          }
        }
      }
    });

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: 'Rider not found'
      });
    }

    res.json({
      success: true,
      data: rider
    });
  } catch (error) {
    console.error('Error fetching rider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rider',
      error: error.message
    });
  }
};

// Get rider dashboard data
export const getRiderDashboard = async (req, res) => {
  try {
    const { riderId } = req.params;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's deliveries
    const todaysDeliveries = await prisma.order.findMany({
      where: {
        riderId,
        createdAt: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        customer: {
          select: { name: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get completed deliveries
    const completedDeliveries = todaysDeliveries.filter(order => order.status === 'DELIVERED');
    
    // Get assigned deliveries
    const assignedDeliveries = todaysDeliveries.filter(order => 
      order.status === 'ASSIGNED' || order.status === 'IN_PROGRESS'
    );

    const formattedAssigned = assignedDeliveries.map(delivery => ({
      id: `#${delivery.id.slice(-4)}`,
      customer: delivery.customer.name,
      phone: delivery.customer.phone,
      address: `${delivery.customer.houseNo || ''} ${delivery.customer.streetNo || ''} ${delivery.customer.area || ''}`.trim(),
      bottles: Math.floor(Math.random() * 10) + 1, // Mock data
      amount: parseFloat(delivery.totalAmount),
      paymentStatus: delivery.paymentStatus === 'PAID' ? 'paid' : 'unpaid'
    }));

    const formattedCompleted = completedDeliveries.map(delivery => ({
      id: `#${delivery.id.slice(-4)}`,
      customer: delivery.customer.name,
      phone: delivery.customer.phone,
      address: `${delivery.customer.houseNo || ''} ${delivery.customer.streetNo || ''} ${delivery.customer.area || ''}`.trim(),
      bottles: Math.floor(Math.random() * 10) + 1, // Mock data
      amount: parseFloat(delivery.totalAmount),
      paymentStatus: delivery.paymentStatus === 'PAID' ? 'paid' : 'unpaid'
    }));

    res.json({
      success: true,
      data: {
        assignedDeliveries: formattedAssigned,
        completedDeliveries: formattedCompleted,
        stats: {
          totalToday: todaysDeliveries.length,
          completed: completedDeliveries.length,
          pending: assignedDeliveries.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching rider dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rider dashboard',
      error: error.message
    });
  }
};
