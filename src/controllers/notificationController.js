import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Send notification
export const sendNotification = async (req, res) => {
  try {
    const { userId, title, message, type, data } = req.body;

    // Validate required fields
    if (!title || !message || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title, message, and type are required'
      });
    }

    const notification = await prisma.notification.create({
      data: {
        userId: userId || null, // If null, it's a system-wide notification
        title,
        message,
        type: type.toUpperCase(),
        data: data ? JSON.stringify(data) : null
      }
    });

    // Emit real-time notification
    if (global.io && userId) {
      console.log(`📤 Emitting new-notification event to rider-${userId} room`);
      console.log('📊 Available rooms:', Array.from(global.io.sockets.adapter.rooms.keys()));
      global.io.to(`rider-${userId}`).emit('new-notification', notification);
    } else {
      console.log('❌ Cannot emit notification - global.io:', !!global.io, 'userId:', userId);
    }

    res.status(201).json({
      success: true,
      data: notification,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
};

// Get notifications for a user
export const getNotifications = async (req, res) => {
  try {
    const { userId } = req.query;

    const whereClause = userId ? { userId } : {};

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to last 50 notifications
    });

    res.json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// Mark notification as read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true }
    });

    res.json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// Subscribe to push notifications
export const subscribeToPush = async (req, res) => {
  try {
    const { subscription, userId } = req.body;

    if (!subscription || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Subscription and userId are required'
      });
    }

    // Store subscription in database (you might want to create a PushSubscription model)
    // For now, we'll just log it
    console.log('Push subscription received:', {
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys
    });

    res.json({
      success: true,
      message: 'Push subscription saved successfully'
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save push subscription',
      error: error.message
    });
  }
};
