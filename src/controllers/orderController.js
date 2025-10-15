import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all orders
export const getAllOrders = async (req, res) => {
  try {
    const { status } = req.query;
    
    const whereClause = status && status !== 'all' ? { status: status.toUpperCase() } : {};
    
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { name: true, phone: true }
        },
        rider: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedOrders = orders.map(order => ({
      id: `#${order.id.slice(-4)}`,
      customer: order.customer.name,
      phone: order.customer.phone,
      bottles: Math.floor(Math.random() * 10) + 1, // Mock data for bottles
      amount: parseFloat(order.totalAmount),
      status: order.status.toLowerCase(),
      rider: order.rider?.name || 'Not assigned',
      date: order.createdAt.toISOString().split('T')[0],
      paid: order.paymentStatus === 'PAID'
    }));

    res.json({
      success: true,
      data: formattedOrders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders',
      error: error.message
    });
  }
};

// Get order by ID
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        rider: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order',
      error: error.message
    });
  }
};

// Create new order
export const createOrder = async (req, res) => {
  try {
    const { customerId, riderId, totalAmount, notes, priority = 'NORMAL' } = req.body;

    // Validate required fields
    if (!customerId || !totalAmount) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID and total amount are required'
      });
    }

    // If riderId is provided, set status to ASSIGNED, otherwise PENDING
    const status = riderId ? 'ASSIGNED' : 'PENDING';

    const order = await prisma.order.create({
      data: {
        customerId,
        riderId: riderId || null,
        totalAmount: parseFloat(totalAmount),
        notes,
        priority: priority.toUpperCase(),
        status: status
      },
      include: {
        customer: {
          select: { name: true, phone: true }
        },
        rider: {
          select: { name: true }
        }
      }
    });

    // Emit real-time event for new order
    if (global.io) {
      console.log('📤 Emitting new-order event to admin room');
      console.log('📊 Available rooms:', Array.from(global.io.sockets.adapter.rooms.keys()));
      global.io.to('admin').emit('new-order', order);
      
      if (riderId) {
        // Get the user ID from the rider profile
        const riderProfile = await prisma.riderProfile.findUnique({
          where: { id: riderId },
          select: { userId: true }
        });
        
        if (riderProfile) {
          console.log(`📤 Emitting new-order event to rider-${riderProfile.userId} room`);
          global.io.to(`rider-${riderProfile.userId}`).emit('new-order', order);
        } else {
          console.log(`❌ Rider profile not found for ID: ${riderId}`);
        }
      }
    } else {
      console.log('❌ global.io is not available');
    }

    res.status(201).json({
      success: true,
      data: order,
      message: 'Order created successfully'
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
};

// Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, riderId } = req.body;

    const updateData = { status: status.toUpperCase() };
    if (riderId) {
      updateData.riderId = riderId;
    }

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        rider: true
      }
    });

    res.json({
      success: true,
      data: order,
      message: 'Order updated successfully'
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update order',
      error: error.message
    });
  }
};
