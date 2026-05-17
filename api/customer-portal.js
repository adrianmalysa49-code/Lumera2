// api/customer-portal.js
// Vercel Edge Function — creates a Stripe Customer Portal session
// Users land here from "Manage subscription" button to cancel/update billing

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const APP_URL           = process.env.APP_URL;

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const { clerkUserId } = body;
  if (!clerkUserId) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Find customer
  const searchRes = await fetch(
    `https://api.stripe.com/v1/customers/search?query=metadata['clerkUserId']:'${encodeURIComponent(clerkUserId)}'&limit=1`,
    { headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY } }
  );
  const searchData = await searchRes.json();
  const customer   = searchData.data?.[0];

  if (!customer) {
    return new Response(JSON.stringify({ error: 'No subscription found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create portal session
  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer:     customer.id,
      return_url:   APP_URL + '/',
    }).toString(),
  });

  const portal = await portalRes.json();

  if (!portalRes.ok) {
    return new Response(JSON.stringify({ error: portal.error?.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: portal.url }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
