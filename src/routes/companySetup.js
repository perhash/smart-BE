import express from 'express';
import {
  getCompanySetup,
  createCompanySetup,
  updateCompanySetup,
  deleteCompanySetup
} from '../controllers/companySetupController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/company-setup
router.get('/', getCompanySetup);

// POST /api/company-setup
router.post('/', authenticateToken, createCompanySetup);

// PUT /api/company-setup/:id
router.put('/:id', authenticateToken, updateCompanySetup);

// DELETE /api/company-setup/:id
router.delete('/:id', authenticateToken, deleteCompanySetup);

export default router;

