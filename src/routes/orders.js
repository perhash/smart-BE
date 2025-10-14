import express from 'express';
import { getAllOrders, getOrderById, createOrder, updateOrderStatus } from '../controllers/orderController.js';

const router = express.Router();

// GET /api/orders
router.get('/', getAllOrders);

// GET /api/orders/:id
router.get('/:id', getOrderById);

// POST /api/orders
router.post('/', createOrder);

// PATCH /api/orders/:id
router.patch('/:id', updateOrderStatus);

export default router;
