import { Router } from 'express';
import {
  getMetrics,
  getUsers,
  deleteUser,
  getMessages,
  updateMessageStatus,
  createPlan,
  updatePlan,
  deletePlan,
  getAdminDomains,
  createAdminDomain,
  updateAdminDomain,
  deleteAdminDomain,
} from '../controllers/adminController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireAdmin } from '../middleware/rbacMiddleware.js';

const router = Router();

// Protect all admin endpoints with both Auth and Admin RBAC
router.use(authMiddleware);
router.use(requireAdmin);

// Platform metrics
router.get('/metrics', getMetrics);

// Registered users directory
router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);

// Contact messages inbox & status toggle
router.get('/messages', getMessages);
router.patch('/messages/:id', updateMessageStatus);

// Hosting plans management
router.post('/plans', createPlan);
router.put('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// Admin Domain Management (Create, Edit, Delete platform-wide)
router.get('/domains', getAdminDomains);
router.post('/domains', createAdminDomain);
router.put('/domains/:id', updateAdminDomain);
router.delete('/domains/:id', deleteAdminDomain);

export default router;

