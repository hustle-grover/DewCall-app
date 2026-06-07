import { Router, Request, Response } from 'express';
import { supabaseAnon } from '../db/supabase';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const { data, error } = await supabaseAnon.auth.signUp({ email, password });
  if (error) {
    logger.warn('Auth: signup failed', { email, error: error.message });
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ user: data.user, session: data.session });
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (error) {
    logger.warn('Auth: login failed', { email, error: error.message });
    res.status(401).json({ error: error.message });
    return;
  }

  res.json({ user: data.user, session: data.session });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  await req.supabase.auth.signOut();
  res.json({ ok: true });
});

// GET /api/auth/me — current user + family member profile (null if onboarding not yet done)
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  const { data: familyMember, error } = await req.supabase
    .from('family_members')
    .select('*')
    .eq('auth_user_id', req.authUser.id)
    .maybeSingle();

  if (error) {
    logger.error('GET /auth/me: query failed', { error });
    res.status(500).json({ error: 'Failed to load profile' });
    return;
  }

  res.json({ user: req.authUser, familyMember: familyMember ?? null });
});

export default router;
