import express from 'express';
import authRoutes from './auth.js';
import dashboardRoutes from './dashboard.js';
import orderRoutes from './orders.js';
import customerRoutes from './customers.js';
import riderRoutes from './riders.js';
import paymentRoutes from './payments.js';

const router = express.Router();

// API routes
router.use('/auth', authRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/orders', orderRoutes);
router.use('/customers', customerRoutes);
router.use('/riders', riderRoutes);
router.use('/payments', paymentRoutes);

export default router;
