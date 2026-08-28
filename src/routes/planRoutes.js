import { Router } from 'express';
import { getPlans, getPlanById } from '../controllers/planController.js';

const router = Router();

// Publicly readable hosting plans
router.get('/', getPlans);
router.get('/:id', getPlanById);

export default router;
