import { Router } from 'express';
import {
  getSubscriptions,
  createSubscription,
  cancelSubscription,
} from '../controllers/subscriptionController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all subscription routes
router.use(authMiddleware);

router.get('/', getSubscriptions);
router.post('/', createSubscription);
router.delete('/:id', cancelSubscription);

export default router;
