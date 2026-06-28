import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Resend } from 'resend';
import { config } from '../utils/config';
import { supabaseAdmin } from '../db/supabase';
import { logger } from '../utils/logger';
import { generateOnboardingToken } from '../utils/onboarding-token';

const router = Router();
const resend = new Resend(config.RESEND_API_KEY);
const FROM_EMAIL = 'DewCall <onboarding@dewcall.app>';

// POST /webhooks/razorpay/payment
// Receives raw Buffer body (mounted with express.raw() in index.ts — must stay before express.json()).
// Uses subscription.charged with paid_count === 1 for first-payment detection because that event
// includes the customer email directly in payload.payment.entity; subscription.activated does not.
router.post('/payment', async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;

  // Verify Razorpay HMAC-SHA256 webhook signature
  const signature = req.headers['x-razorpay-signature'] as string | undefined;
  if (config.RAZORPAY_WEBHOOK_SECRET) {
    if (!signature) {
      logger.warn('Razorpay webhook: missing X-Razorpay-Signature');
      res.status(400).send('Missing signature');
      return;
    }
    const expectedSig = crypto
      .createHmac('sha256', config.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    let signaturesMatch = false;
    try {
      signaturesMatch = crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSig, 'hex'),
      );
    } catch {
      signaturesMatch = false;
    }
    if (!signaturesMatch) {
      logger.warn('Razorpay webhook: invalid signature — request rejected');
      res.status(400).send('Invalid signature');
      return;
    }
  } else {
    logger.warn('RAZORPAY_WEBHOOK_SECRET not set — skipping signature verification');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }

  const event = payload['event'] as string | undefined;
  logger.info('Razorpay webhook', { event });

  // Only subscription.charged carries the customer email; we gate on paid_count === 1
  // so recurring monthly charges don't trigger duplicate account creation.
  if (event !== 'subscription.charged') {
    res.status(200).send('ok');
    return;
  }

  const payloadData = payload['payload'] as Record<string, unknown> | undefined;
  const sub = ((payloadData?.['subscription'] as Record<string, unknown>)?.['entity'] ?? {}) as Record<string, unknown>;
  const payment = ((payloadData?.['payment'] as Record<string, unknown>)?.['entity'] ?? {}) as Record<string, unknown>;

  const paidCount = sub['paid_count'] as number | undefined;
  const subscriptionId = sub['id'] as string | undefined;
  const email = (payment['email'] as string | undefined)?.toLowerCase().trim();
  const contact = (payment['contact'] as string | undefined) ?? null;

  if (!email || !subscriptionId) {
    logger.warn('Razorpay webhook: subscription.charged payload missing email or subscription id');
    res.status(200).send('ok');
    return;
  }

  // On recurring charges: keep subscription_status in sync and exit
  if (paidCount !== 1) {
    logger.info('Razorpay webhook: recurring charge — updating subscription_status', { paidCount, subscriptionId });
    await supabaseAdmin
      .from('family_members')
      .update({ subscription_status: 'active', razorpay_subscription_id: subscriptionId })
      .eq('email', email);
    res.status(200).send('ok');
    return;
  }

  // First charge — check idempotency before creating anything
  const { data: existing } = await supabaseAdmin
    .from('family_members')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    logger.info('Razorpay webhook: family_member already exists — activating', { email });
    await supabaseAdmin
      .from('family_members')
      .update({ subscription_status: 'active', razorpay_subscription_id: subscriptionId })
      .eq('id', existing.id as string);
    res.status(200).send('ok');
    return;
  }

  // Create the family_members row — full_name and phone are NULL here,
  // filled in during onboarding (/api/onboarding/family links by email)
  const { data: newMember, error: insertErr } = await supabaseAdmin
    .from('family_members')
    .insert({
      email,
      phone: contact,
      subscription_status: 'active',
      razorpay_subscription_id: subscriptionId,
      trial_ends_at: null,
      preferred_brief_channel: 'email',
      timezone: 'Asia/Kolkata',
    })
    .select('id')
    .single();

  if (insertErr || !newMember) {
    logger.error('Razorpay webhook: failed to create family_member', { email, error: insertErr });
    res.status(500).send('Internal error');
    return;
  }

  logger.info('Razorpay webhook: family_member created', { email, id: newMember.id });

  // Generate a 7-day signed onboarding token and email it
  const token = generateOnboardingToken(email, newMember.id as string);
  const frontendUrl = config.FRONTEND_URL ?? config.APP_URL;
  const onboardingUrl = `${frontendUrl}/signup?token=${encodeURIComponent(token)}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Welcome to DewCall — let's set up your first call",
      html: buildWelcomeEmailHtml(onboardingUrl),
      text: buildWelcomeEmailText(onboardingUrl),
    });
    logger.info('Razorpay webhook: welcome email sent', { email });
  } catch (err) {
    // Email failure does not fail the webhook — account was created successfully
    logger.error('Razorpay webhook: welcome email failed', { email, error: err });
  }

  res.status(200).send('ok');
});

function buildWelcomeEmailHtml(onboardingUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Welcome to DewCall</title>
</head>
<body style="margin:0;padding:0;background:#FDFAF6;font-family:Inter,Helvetica,Arial,sans-serif;color:#2C2C2C;">
  <div style="max-width:520px;margin:48px auto;background:#fff;border-radius:16px;padding:40px 36px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    <p style="margin:0 0 6px;font-size:13px;color:#4A7C6F;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">DewCall</p>
    <h1 style="margin:0 0 20px;font-size:26px;font-weight:700;color:#2C2C2C;line-height:1.3;">
      You're in. Let's set up your parent's first call.
    </h1>
    <p style="margin:0 0 8px;font-size:15px;line-height:1.7;color:#555;">
      Welcome to DewCall — we're glad you're here.
    </p>
    <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#555;">
      Click below to create your account and tell us a little about your parent. It takes about 3 minutes, and their first call can happen within 48 hours of finishing setup.
    </p>
    <a href="${onboardingUrl}" style="display:inline-block;background:#4A7C6F;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
      Set up your account →
    </a>
    <p style="margin:28px 0 8px;font-size:13px;color:#999;line-height:1.6;">
      If the button doesn't work, paste this link into your browser:<br>
      <a href="${onboardingUrl}" style="color:#4A7C6F;word-break:break-all;">${onboardingUrl}</a>
    </p>
    <hr style="border:none;border-top:1px solid #EEE;margin:28px 0 20px;">
    <p style="margin:0;font-size:12px;color:#BBB;line-height:1.7;">
      Sent by DewCall &middot; <a href="mailto:hello@dewcall.app" style="color:#BBB;">hello@dewcall.app</a><br>
      DewCall, a product of Massive Impact Media Pvt. Ltd.
    </p>
  </div>
</body>
</html>`;
}

function buildWelcomeEmailText(onboardingUrl: string): string {
  return `Welcome to DewCall

You're in. Let's set up your parent's first call.

Click the link below to create your account — it takes about 3 minutes, and their first call can happen within 48 hours of finishing setup.

${onboardingUrl}

Questions? Reply to this email or reach us at hello@dewcall.app.

—
DewCall, a product of Massive Impact Media Pvt. Ltd.`;
}

export default router;
