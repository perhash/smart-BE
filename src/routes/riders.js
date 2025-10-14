import express from 'express';
import { getAllRiders, getRiderById, getRiderDashboard } from '../controllers/riderController.js';

const router = express.Router();

// GET /api/riders
router.get('/', getAllRiders);

// GET /api/riders/:id
router.get('/:id', getRiderById);

// GET /api/riders/:riderId/dashboard
router.get('/:riderId/dashboard', getRiderDashboard);

export default router;
