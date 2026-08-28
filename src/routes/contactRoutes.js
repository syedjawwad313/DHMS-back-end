import { Router } from 'express';
import { submitContact } from '../controllers/contactController.js';

const router = Router();

// Public contact submission endpoint
router.post('/', submitContact);

export default router;
