import express from 'express';
import { 
  getCompanySetup,
  createCompanySetup,
  updateCompanySetup
} from '../controllers/companySetupController.js';

const router = express.Router();

// GET /api/company-setup
router.get('/', getCompanySetup);

// POST /api/company-setup
router.post('/', createCompanySetup);

// PUT /api/company-setup
router.put('/', updateCompanySetup);

export default router;

