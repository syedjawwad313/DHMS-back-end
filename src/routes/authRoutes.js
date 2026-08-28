import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);

// Authenticated user profile route
router.get('/me', authMiddleware, getMe);

export default router;
