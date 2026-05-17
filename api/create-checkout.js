// api/create-checkout.js
// Vercel Edge Function — creates a Stripe Checkout Session
// Called by the frontend when user clicks "Upgrade now"

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_PRICE_ID   = process.env.STRIPE_PRICE_ID;
  const APP_URL           = process.env.APP_URL; // e.g. https://lumera.app

  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID || !APP_URL) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await req.json(); } catch { body = {}; }

  // clerkUserId and email come from the frontend (window.__clerk.user)
  const { clerkUserId, email } = body;

  if (!clerkUserId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create Stripe Checkout Session
  const params = new URLSearchParams({
    'mode': 'subscription',
    'line_items[0][price]': STRIPE_PRICE_ID,
    'line_items[0][quantity]': '1',
    'success_url': APP_URL + '/?checkout=success',
    'cancel_url':  APP_URL + '/?checkout=cancel',
    'client_reference_id': clerkUserId,       // links Stripe → Clerk user
    'subscription_data[metadata][clerkUserId]': clerkUserId,
    'allow_promotion_codes': 'true',
  });

  // Pre-fill email if available
  if (email) params.set('customer_email', email);

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
