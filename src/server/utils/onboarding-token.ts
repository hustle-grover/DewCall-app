import crypto from 'crypto';

function getTokenSecret(): string {
  return process.env['RAZORPAY_WEBHOOK_SECRET'] ?? 'dewcall-onboarding-fallback-not-for-production';
}

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateOnboardingToken(email: string, familyMemberId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ email, fmid: familyMemberId, iat: Date.now() })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyOnboardingToken(token: string): { email: string; fmid: string } | null {
  const dot = token.lastIndexOf('.');
  if (dot === -1) return null;

  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expectedSig = crypto
    .createHmac('sha256', getTokenSecret())
    .update(payload)
    .digest('base64url');

  if (sig.length !== expectedSig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  } catch {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email: string;
      fmid: string;
      iat: number;
    };
    if (Date.now() - data.iat > TOKEN_TTL_MS) return null;
    if (!data.email || !data.fmid) return null;
    return { email: data.email, fmid: data.fmid };
  } catch {
    return null;
  }
}
