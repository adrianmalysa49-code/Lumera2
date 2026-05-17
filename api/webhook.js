// api/webhook.js
// Vercel Edge Function — receives Stripe webhook events
// Stores subscription status in Stripe Customer metadata (no DB needed)

export const config = { runtime: 'edge' };

// Minimal Stripe webhook signature verification for Edge runtime
async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = sigHeader.split(',');
  let timestamp = '';
  const signatures = [];

  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key === 't') timestamp = val;
    if (key === 'v1') signatures.push(val);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const signedPayload = timestamp + '.' + payload;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload)
  );
  const computed = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return signatures.includes(computed);
}

async function updateCustomerMeta(customerId, clerkUserId, isActive, stripeKey) {
  // Store subscription status directly on the Stripe Customer object
  // This lets check-subscription.js verify without a database
  await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + stripeKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'metadata[clerkUserId]': clerkUserId || '',
      'metadata[isPremium]':   isActive ? 'true' : 'false',
      'metadata[updatedAt]':   new Date().toISOString(),
    }).toString(),
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const STRIPE_SECRET_KEY      = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET  = process.env.STRIPE_WEBHOOK_SECRET;

  const sig     = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  // Verify webhook signature
  const isValid = await verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const obj = event.data?.object;

  // ── Handle relevant events ──────────────────────────────────────────────
  switch (event.type) {

    // Payment succeeded → subscription is active
    case 'checkout.session.completed': {
      const clerkUserId  = obj.client_reference_id || obj.subscription_data?.metadata?.clerkUserId;
      const customerId   = obj.customer;
      if (customerId) {
        await updateCustomerMeta(customerId, clerkUserId, true, STRIPE_SECRET_KEY);
      }
      break;
    }

    // Subscription renewed
    case 'invoice.paid': {
      const customerId = obj.customer;
      if (customerId) {
        // Get clerkUserId from existing metadata
        const custRes  = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
          headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY },
        });
        const cust     = await custRes.json();
        const clerkId  = cust.metadata?.clerkUserId || '';
        await updateCustomerMeta(customerId, clerkId, true, STRIPE_SECRET_KEY);
      }
      break;
    }

    // Subscription cancelled or payment failed → revoke access
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const customerId = obj.customer;
      if (customerId) {
        const custRes  = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
          headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY },
        });
        const cust     = await custRes.json();
        const clerkId  = cust.metadata?.clerkUserId || '';
        await updateCustomerMeta(customerId, clerkId, false, STRIPE_SECRET_KEY);
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
