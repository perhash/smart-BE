import express from 'express';
import { login, verifyToken, updatePassword, checkAdminExists, completeOnboarding } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/verify
router.get('/verify', verifyToken);

// POST /api/auth/update-password
router.post('/update-password', authenticateToken, updatePassword);

// GET /api/auth/check-admin
router.get('/check-admin', checkAdminExists);

// POST /api/auth/onboarding
router.post('/onboarding', completeOnboarding);

export default router;
