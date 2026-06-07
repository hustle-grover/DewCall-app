import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { initiateCall } from '../services/call-engine';
import { logger } from '../utils/logger';

const router = Router();

function requireAdminSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = req.headers['x-admin-secret'];
  if (!config.ADMIN_SECRET || secret !== config.ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

router.use(requireAdminSecret);

/**
 * POST /api/admin/test-call/:seniorId
 * Triggers an immediate call to the given senior — dev/test only.
 * Requires X-Admin-Secret header.
 */
router.post('/test-call/:seniorId', async (req: Request, res: Response) => {
  const seniorId = req.params['seniorId'] as string;
  logger.info('Admin: triggering test call', { seniorId });

  try {
    const callSid = await initiateCall(seniorId);
    res.json({ ok: true, callSid });
  } catch (err) {
    logger.error('Admin: test call failed', { seniorId, error: err });
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
