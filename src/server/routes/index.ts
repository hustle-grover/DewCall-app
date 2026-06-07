import { Router } from 'express';
import webhookRoutes from './webhooks';
import adminRoutes from './admin';
import authRoutes from './auth';
import apiRoutes from './api';

const router = Router();

router.use('/webhooks/twilio', webhookRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/auth', authRoutes);
router.use('/api', apiRoutes);
// TODO Session 11: router.use('/api/billing', stripeRoutes);

export default router;
