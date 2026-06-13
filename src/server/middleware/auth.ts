import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import ws from 'ws';
import { config } from '../utils/config';

declare global {
  namespace Express {
    interface Request {
      supabase: SupabaseClient;
      authUser: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice(7);

  // Per-request Supabase client — all queries through this client enforce RLS.
  // The user's JWT is passed as the Authorization header; Supabase uses auth.uid()
  // from that JWT when evaluating row-level security policies.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as any },
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  req.supabase = supabase;
  req.authUser = user;
  next();
}
