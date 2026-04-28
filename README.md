# Lumera — Learn Psychology

A mobile-first learning platform with quiz-gated lessons, freemium paywall, and multilingual support (EN/DE).

## Stack

Pure static site — no build step, no dependencies.

| File | Purpose |
|------|---------|
| `index.html` | HTML shell & page containers |
| `css/style.css` | All styles & design tokens |
| `js/app.js` | All logic: routing, translations, rendering |
| `vercel.json` | Vercel config |

## Deploy to Vercel via GitHub

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import the GitHub repo
4. Framework preset: **Other** (no build needed)
5. Click **Deploy** — that's it ✅

## Local development

Just open `index.html` in your browser — or use any static server:

```bash
npx serve .
# or
python3 -m http.server 3000
```

## Customisation

- **Content & translations** — edit the `T` object at the top of `js/app.js`
- **Colours / fonts** — edit `:root` variables at the top of `css/style.css`
- **Add real auth** — replace the login/signup pages with Clerk, Supabase Auth, or Firebase
- **Add payments** — wire the paywall CTA to Stripe Checkout
- **Add video** — set `lesson.videoUrl` in the lesson data inside `js/app.js`

## Pages

| Route (JS) | Screen |
|-----------|--------|
| `landing` | Marketing landing page |
| `login` / `signup` | Auth screens |
| `onboarding` | 3-step onboarding flow |
| `dashboard` | User home |
| `courses` | Course catalogue |
| `course-detail` | Modules & lessons list |
| `lesson` | Full lesson (Goal → Video → Notes → Terms → Challenge → Quiz) |
| `progress` | Progress stats |
| `paywall` | Free vs Premium comparison |
| `admin` | Content management panel |
