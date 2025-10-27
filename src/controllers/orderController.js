import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get all orders
export const getAllOrders = async (req, res) => {
  try {
    const { status, date, riderId, startDate, endDate } = req.query;

    const whereClause = {
      ...(status && status !== 'all' ? { status: status.toUpperCase() } : {}),
      ...(riderId ? { riderId } : {}),
      ...(date
        ? {
            createdAt: {
              gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
              lt: new Date(new Date(date).setHours(24, 0, 0, 0))
            }
          }
        : {}),
      ...(startDate && endDate
        ? {
            createdAt: {
              gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
              lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            }
          }
        : startDate
        ? {
            createdAt: {
              gte: new Date(new Date(startDate).setHours(0, 0, 0, 0))
            }
          }
        : endDate
        ? {
            createdAt: {
              lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            }
          }
        : {})
    };

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
      originalId: order.id,
      id: `#${order.id.slice(-4)}`,
      customer: order.customer.name,
      phone: order.customer.phone,
      bottles: order.numberOfBottles,
      amount: parseFloat(order.totalAmount),
      status: order.status.toLowerCase(),
      priority: order.priority.toLowerCase(),
      rider: order.rider?.name || 'Not assigned',
      date: order.createdAt.toISOString().split('T')[0],
      paid: order.paymentStatus === 'PAID' || order.paymentStatus === 'REFUND',
      paidAmount: parseFloat(order.paidAmount),
      paymentStatus: order.paymentStatus.toLowerCase()
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
    const { customerId, notes, priority = 'NORMAL', numberOfBottles = 1, riderId, unitPrice, orderType = 'DELIVERY' } = req.body;

    // Validate constraints based on order type
    if (orderType === 'DELIVERY' && !riderId) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID is required for delivery orders'
      });
    }

    if (orderType === 'WALKIN' && riderId) {
      return res.status(400).json({
        success: false,
        message: 'Rider ID should not be provided for walk-in orders'
      });
    }

    // Handle walk-in customer lookup
    let customer;
    if (customerId === 'walkin') {
      // Find the walk-in customer by name
      customer = await prisma.customer.findFirst({
        where: { name: 'Walk-in Customer' },
        select: { id: true, currentBalance: true }
      });
    } else {
      // Regular customer lookup
      customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, currentBalance: true }
      });
    }

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customerBalance = parseFloat(customer.currentBalance);
    const currentOrderAmount = parseFloat(numberOfBottles) * parseFloat(unitPrice);
    const totalAmount = customerBalance + currentOrderAmount;

    const order = await prisma.$transaction(async (tx) => {
      // Determine initial status based on order type
      let initialStatus = 'PENDING';
      if (orderType === 'WALKIN') {
        initialStatus = 'CREATED';
      } else if (orderType === 'DELIVERY' && riderId) {
        initialStatus = 'ASSIGNED';
      }

      // Create the order with new balance tracking fields
      const newOrder = await tx.order.create({
        data: {
          customerId: customer.id, // Use the actual customer ID
          totalAmount,
          currentOrderAmount,
          customerBalance,
          notes,
          priority: priority.toUpperCase(),
          orderType: orderType.toUpperCase(),
          riderId: orderType === 'DELIVERY' ? riderId : null,
          numberOfBottles: parseInt(numberOfBottles),
          status: initialStatus
        },
        include: {
          customer: true
        }
      });

      // Update customer's current balance to the new total
      await tx.customer.update({
        where: { id: customer.id }, // Use the actual customer ID
        data: { currentBalance: totalAmount }
      });

      return newOrder;
    });

    // If assigned to a rider, create a notification for the rider's user
    if (riderId) {
      try {
        const riderProfile = await prisma.riderProfile.findUnique({
          where: { id: riderId },
          select: { userId: true, name: true }
        });

        if (riderProfile?.userId) {
          await prisma.notification.create({
            data: {
              userId: riderProfile.userId,
              title: 'New order assigned',
              message: `An order has been assigned to you`,
              type: 'ORDER_ASSIGNED',
              data: {
                orderId: order.id,
                priority: order.priority,
                totalAmount: order.totalAmount,
                numberOfBottles: order.numberOfBottles,
                customer: {
                  id: order.customer.id,
                  name: order.customer.name,
                  phone: order.customer.phone
                }
              }
            }
          });
        }
      } catch (notifyErr) {
        console.error('Failed to create rider notification:', notifyErr);
      }
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

// Complete walk-in order with immediate payment
export const completeWalkInOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount = 0, paymentMethod = 'CASH', notes } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.orderType !== 'WALKIN') {
      return res.status(400).json({ success: false, message: 'This endpoint is only for walk-in orders' });
    }

    if (order.status !== 'CREATED') {
      return res.status(400).json({ success: false, message: 'Order is not in CREATED status' });
    }

    const total = parseFloat(order.totalAmount);
    const paid = parseFloat(paymentAmount);
    const remaining = total - paid;

    // Determine payment status
    let paymentStatus = 'NOT_PAID';
    if (paid === 0) paymentStatus = 'NOT_PAID';
    else if (paid < 0) paymentStatus = 'REFUND';
    else if (paid > 0 && paid < total) paymentStatus = 'PARTIAL';
    else if (paid === total) paymentStatus = 'PAID';
    else if (paid > total) paymentStatus = 'OVERPAID';

    // Calculate receivable and payable
    let receivable = 0;
    let payable = 0;
    if (remaining > 0) {
      receivable = remaining;
    } else if (remaining < 0) {
      payable = Math.abs(remaining);
    }

    // Calculate new customer balance: current balance - paid amount
    const newCustomerBalance = parseFloat(order.customer.currentBalance) - paid;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          paidAmount: paid,
          paymentStatus,
          paymentMethod,
          paymentNotes: notes || null,
          receivable,
          payable,
          deliveredAt: new Date()
        },
        include: {
          customer: true,
          rider: true
        }
      });

      await tx.customer.update({
        where: { id: order.customerId },
        data: { currentBalance: newCustomerBalance }
      });

      return updatedOrder;
    });

    return res.json({ success: true, data: updated, message: 'Walk-in order completed successfully' });
  } catch (error) {
    console.error('Error completing walk-in order:', error);
    return res.status(500).json({ success: false, message: 'Failed to complete walk-in order', error: error.message });
  }
};

// Mark order delivered and handle payment + customer balance
export const deliverOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentAmount = 0, paymentMethod = 'CASH', notes } = req.body;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const total = parseFloat(order.totalAmount);
    const paid = parseFloat(paymentAmount);
    const remaining = total - paid;

    // Determine payment status
    let paymentStatus = 'NOT_PAID';
    if (paid === 0) paymentStatus = 'NOT_PAID';
    else if (paid < 0) paymentStatus = 'REFUND'; // Refund given to customer
    else if (paid > 0 && paid < total) paymentStatus = 'PARTIAL';
    else if (paid === total) paymentStatus = 'PAID';
    else if (paid > total) paymentStatus = 'OVERPAID';

    // Calculate receivable and payable
    let receivable = 0;
    let payable = 0;
    if (remaining > 0) {
      receivable = remaining; // Customer owes us money
    } else if (remaining < 0) {
      payable = Math.abs(remaining); // We owe customer money
    }
    // If remaining = 0, both stay 0 (default values)

    // Calculate new customer balance: current balance - paid amount
    const newCustomerBalance = parseFloat(order.customer.currentBalance) - paid;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'DELIVERED',
          paidAmount: paid,
          paymentStatus,
          paymentMethod,
          paymentNotes: notes || null,
          receivable,
          payable,
          deliveredAt: new Date()
        },
        include: {
          customer: true,
          rider: true
        }
      });

      await tx.customer.update({
        where: { id: order.customerId },
        data: { currentBalance: newCustomerBalance }
      });

      return updatedOrder;
    });

    // Create notification for all admin users
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: 'ADMIN', isActive: true },
        select: { id: true }
      });

      for (const adminUser of adminUsers) {
        await prisma.notification.create({
          data: {
            userId: adminUser.id,
            title: 'Order Delivered',
            message: `Order #${id} has been delivered by ${updated.rider?.name || 'Rider'}`,
            type: 'ORDER_DELIVERED',
            data: {
              orderId: id,
              customer: {
                id: order.customerId,
                name: updated.customer.name,
                phone: updated.customer.phone
              },
              rider: updated.rider ? {
                id: updated.rider.id,
                name: updated.rider.name
              } : null,
              paymentAmount: paid,
              paymentStatus,
              totalAmount: total
            }
          }
        });
      }
    } catch (notifyErr) {
      console.error('Failed to create admin notification:', notifyErr);
    }

    return res.json({ success: true, data: updated, message: 'Order delivered and balances updated' });
  } catch (error) {
    console.error('Error delivering order:', error);
    return res.status(500).json({ success: false, message: 'Failed to deliver order', error: error.message });
  }
};

// Cancel order and revert customer balance
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Order is already cancelled' });
    }

    if (order.status === 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a delivered order' });
    }

    // Revert customer balance to the balance before this order
    const originalCustomerBalance = parseFloat(order.customerBalance);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED'
        },
        include: {
          customer: true,
          rider: true
        }
      });

      // Revert customer balance to original balance before this order
      await tx.customer.update({
        where: { id: order.customerId },
        data: { currentBalance: originalCustomerBalance }
      });

      return updatedOrder;
    });

    return res.json({ success: true, data: updated, message: 'Order cancelled and customer balance reverted' });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ success: false, message: 'Failed to cancel order', error: error.message });
  }
};

// Update order details
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { totalAmount, notes, priority, numberOfBottles, status, riderId } = req.body;

    const updateData = {};
    if (totalAmount !== undefined) updateData.totalAmount = parseFloat(totalAmount);
    if (notes !== undefined) updateData.notes = notes;
    if (priority !== undefined) updateData.priority = priority.toUpperCase();
    if (numberOfBottles !== undefined) updateData.numberOfBottles = parseInt(numberOfBottles);
    if (status !== undefined) updateData.status = status.toUpperCase();
    if (riderId !== undefined) updateData.riderId = riderId;

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

// Clear bill - Create CLEARBILL order and mark as completed immediately
export const clearBill = async (req, res) => {
  try {
    const { customerId, paidAmount, paymentMethod = 'CASH', paymentNotes, priority = 'NORMAL' } = req.body;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID is required'
      });
    }

    if (paidAmount === undefined || paidAmount === null) {
      return res.status(400).json({
        success: false,
        message: 'Paid amount is required'
      });
    }

    // Fetch customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true, currentBalance: true }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    const customerBalance = parseFloat(customer.currentBalance);
    const paid = parseFloat(paidAmount);

    // If customer balance is zero, nothing to clear
    if (customerBalance === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer balance is already zero'
      });
    }

    // Determine if it's receivable or payable
    let receivable = 0;
    let payable = 0;
    let totalAmount = customerBalance;
    let paymentStatus = 'NOT_PAID';
    let adjustedPaid = paid;

    if (customerBalance > 0) {
      // Receivable case - customer owes us (positive balance)
      receivable = customerBalance;
      const remainingReceivable = receivable - paid;
      
      if (remainingReceivable === 0) {
        paymentStatus = 'PAID';
        receivable = 0;  // Fully paid, no remaining receivable
        payable = 0;
      } else if (remainingReceivable < 0) {
        paymentStatus = 'OVERPAID';
        receivable = 0;
        payable = Math.abs(remainingReceivable);
      } else if (paid > 0) {
        paymentStatus = 'PARTIAL';
        receivable = remainingReceivable;  // Set to remaining amount
        payable = 0;
      } else {
        paymentStatus = 'NOT_PAID';
        payable = 0;
      }
    } else {
      // Payable case - we owe customer (negative balance)
      payable = Math.abs(customerBalance);
      const remainingPayable = payable - paid;
      
      if (remainingPayable === 0) {
        paymentStatus = 'PAID';
        payable = 0;  // Fully paid, no remaining payable
        receivable = 0;
      } else if (remainingPayable < 0) {
        paymentStatus = 'OVERPAID';
        payable = 0;
        receivable = Math.abs(remainingPayable);
      } else if (paid > 0) {
        paymentStatus = 'PARTIAL';
        payable = remainingPayable;  // Set to remaining amount
        receivable = 0;
      } else {
        paymentStatus = 'NOT_PAID';
        receivable = 0;
      }
      
      // For payable, paidAmount should be negative
      adjustedPaid = -paid;
    }

    // Calculate new customer balance: oldBalance - paidAmount
    const newCustomerBalance = customerBalance - adjustedPaid;

    const order = await prisma.$transaction(async (tx) => {
      // Create the CLEARBILL order and mark as completed immediately
      const newOrder = await tx.order.create({
        data: {
          customerId: customer.id,
          orderType: 'CLEARBILL',
          status: 'COMPLETED',
          numberOfBottles: 0,
          currentOrderAmount: 0,
          customerBalance: customerBalance,
          totalAmount: totalAmount,
          paidAmount: adjustedPaid,
          paymentStatus,
          paymentMethod: paymentMethod.toUpperCase(),
          paymentNotes: paymentNotes || null,
          receivable,
          payable,
          priority: priority.toUpperCase(),
          deliveredAt: new Date()
        },
        include: {
          customer: true,
          rider: true
        }
      });

      // Update customer's current balance
      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: newCustomerBalance }
      });

      return newOrder;
    });

    res.status(201).json({
      success: true,
      data: order,
      message: 'Bill cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing bill:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear bill',
      error: error.message
    });
  }
};
