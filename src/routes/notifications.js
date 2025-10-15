import express from 'express';
import { sendNotification, getNotifications, markAsRead, subscribeToPush } from '../controllers/notificationController.js';

const router = express.Router();

// POST /api/notifications
router.post('/', sendNotification);

// GET /api/notifications
router.get('/', getNotifications);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', markAsRead);

// POST /api/notifications/subscribe
router.post('/subscribe', subscribeToPush);

export default router;
