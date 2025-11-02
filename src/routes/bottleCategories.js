import express from 'express';
import { 
  getAllBottleCategories,
  getBottleCategoryById,
  createBottleCategory,
  updateBottleCategory,
  deleteBottleCategory
} from '../controllers/bottleCategoryController.js';

const router = express.Router();

// GET /api/bottle-categories
router.get('/', getAllBottleCategories);

// POST /api/bottle-categories
router.post('/', createBottleCategory);

// GET /api/bottle-categories/:id
router.get('/:id', getBottleCategoryById);

// PUT /api/bottle-categories/:id
router.put('/:id', updateBottleCategory);

// DELETE /api/bottle-categories/:id
router.delete('/:id', deleteBottleCategory);

export default router;

