import { Router } from 'express';
import {
  getDomains,
  getDomainById,
  createDomain,
  updateDomain,
  deleteDomain,
} from '../controllers/domainController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// Protect all domain routes with JWT authentication
router.use(authMiddleware);

router.get('/', getDomains);
router.get('/:id', getDomainById);
router.post('/', createDomain);
router.put('/:id', updateDomain);
router.delete('/:id', deleteDomain);

export default router;
