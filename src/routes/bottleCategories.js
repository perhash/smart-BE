import express from 'express';
import {
  getAllBottleCategories,
  getBottleCategoryById,
  createBottleCategory,
  updateBottleCategory,
  deleteBottleCategory,
  bulkCreateBottleCategories
} from '../controllers/bottleCategoryController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/bottle-categories
router.get('/', getAllBottleCategories);

// GET /api/bottle-categories/:id
router.get('/:id', getBottleCategoryById);

// POST /api/bottle-categories
router.post('/', authenticateToken, createBottleCategory);

// POST /api/bottle-categories/bulk
router.post('/bulk', authenticateToken, bulkCreateBottleCategories);

// PUT /api/bottle-categories/:id
router.put('/:id', authenticateToken, updateBottleCategory);

// DELETE /api/bottle-categories/:id
router.delete('/:id', authenticateToken, deleteBottleCategory);

export default router;

