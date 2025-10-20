import express from 'express';
import { getAllOrders, getOrderById, createOrder, updateOrderStatus, updateOrder, deliverOrder } from '../controllers/orderController.js';

const router = express.Router();

// GET /api/orders
router.get('/', getAllOrders);

// GET /api/orders/:id
router.get('/:id', getOrderById);

// POST /api/orders
router.post('/', createOrder);

// PATCH /api/orders/:id/status
router.patch('/:id/status', updateOrderStatus);

// PUT /api/orders/:id
router.put('/:id', updateOrder);

// POST /api/orders/:id/deliver
router.post('/:id/deliver', deliverOrder);

export default router;
