// api/check-subscription.js
// Vercel Edge Function — checks if a Clerk user has an active Stripe subscription
// Looks up Stripe customers by clerkUserId stored in metadata
// No database required

export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

  let body;
  try { body = await req.json(); } catch { body = {}; }

  const { clerkUserId } = body;

  if (!clerkUserId) {
    return new Response(JSON.stringify({ isPremium: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Search for Stripe customer by clerkUserId stored in metadata
    const searchRes = await fetch(
      `https://api.stripe.com/v1/customers/search?query=metadata['clerkUserId']:'${encodeURIComponent(clerkUserId)}'&limit=1`,
      {
        headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY },
      }
    );

    const searchData = await searchRes.json();
    const customer   = searchData.data?.[0];

    if (!customer) {
      // No Stripe customer yet → free user
      return new Response(JSON.stringify({ isPremium: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Check metadata flag set by webhook
    const isPremium = customer.metadata?.isPremium === 'true';

    // Double-check with live subscriptions for safety
    if (isPremium) {
      const subsRes  = await fetch(
        `https://api.stripe.com/v1/subscriptions?customer=${customer.id}&status=active&limit=1`,
        { headers: { 'Authorization': 'Bearer ' + STRIPE_SECRET_KEY } }
      );
      const subsData = await subsRes.json();
      const hasActiveSub = subsData.data?.length > 0;

      return new Response(JSON.stringify({ isPremium: hasActiveSub, customerId: customer.id }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    return new Response(JSON.stringify({ isPremium: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });

  } catch (err) {
    console.error('check-subscription error:', err);
    return new Response(JSON.stringify({ isPremium: false }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
