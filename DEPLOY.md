# Deploying the portfolio

## The decision: Cloudflare Pages, not Vercel

| | Cloudflare Pages (Free) | Vercel (Hobby) |
|---|---|---|
| Static bandwidth | **Unmetered** | 100 GB / month |
| Builds | 500 / month | 6,000 minutes / month |
| Custom domains | 100 per project, free SSL | free SSL |
| **Commercial use** | **Permitted** | **Prohibited on Hobby** |
| Edge network | 300+ cities | Large |

**Vercel's Hobby plan is explicitly restricted to non-commercial personal use**
([Vercel Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)).
This portfolio exists to win paying clients for Imbirt, so putting it on Hobby is
both a terms-of-service breach and a takedown risk. Cloudflare's free plan has no
such restriction and no bandwidth cap.

A brochure QR can send a few hundred people in one afternoon. Cloudflare will not
meter that, and will not send a bill or a warning.

---

## Option A — Git integration (recommended)

1. Create the repository. It must be its own repo, not a folder inside
   `ethio-erp-addons`:

   ```powershell
   cd C:\src\portfolio
   git init
   git add -A
   git commit -m "feat: portfolio and the Imbirt case study"
   gh repo create Hayouprogrammer/portfolio --public --source=. --push
   ```

2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
   Pick `Hayouprogrammer/portfolio`.

3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | `Astro` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | `22` (or higher) |

4. **Environment variables** — none are needed. The site has no secrets and no
   server. If a build ever asks for one, that is a bug.

5. Deploy. Every push to `main` ships; every pull request gets a preview URL.

## Option B — direct upload (no Git)

```powershell
cd C:\src\portfolio
npm run build
npx wrangler pages deploy dist --project-name hayelom-portfolio
```

Wrangler will ask you to log in through the browser once.

---

## After the first deploy

1. **Set the site URL.** `astro.config.mjs` currently declares
   `https://hayelom.pages.dev`. Once a real domain exists, change `site` there
   and in `public/robots.txt` and `src/pages/sitemap.xml.ts`, then rebuild.

2. **Verify the QR target.** The brochure QR encodes
   `https://hayelom.pages.dev/imbirt`. Confirm in a browser that it 301s to
   `/work/imbirt` (Cloudflare serves the redirect from `public/_redirects`;
   the page itself also carries a meta-refresh fallback).

3. **Turn on Web Analytics.** Cloudflare dashboard → the Pages project →
   **Analytics → Web Analytics → Enable**. It is cookieless and needs no
   consent banner, which is the whole point: a QR scanner is one tap from
   leaving.

4. **Give the print run its own target** so you know which leaflet worked:

   ```powershell
   $env:QR_TARGET = "https://<domain>/imbirt?utm_source=brochure&utm_medium=print&utm_campaign=<event>-2026-10"
   node scripts/make-qr.mjs
   node scripts/verify-qr.mjs
   ```

   The case study reads that parameter and carries it into the contact links.

---

## Pre-flight checklist

- [ ] `npm run build` exits clean
- [ ] `node scripts/audit.mjs` reports PASS on every route, light + dark + mobile
- [ ] `node scripts/contrast.mjs` reports 0 failing pairs
- [ ] `node scripts/verify-qr.mjs` reports every code decodes
- [ ] `/imbirt` returns a 301 to `/work/imbirt`
- [ ] `https://<domain>/sitemap.xml` and `/robots.txt` resolve
- [ ] No `*.vercel.app` or `*.pages.dev` URL appears on anything printed
- [ ] The LinkedIn URL in `src/data/contact.json` is the real one
- [ ] Every screenshot under `public/screens/` is a real capture of a reachable
      product state, not a placeholder

---

## When you buy the domain

Buy it in **your own** account at Cloudflare Registrar (at-cost, free WHOIS
privacy) or Porkbun. Expect roughly $10–15/year for a `.com` or `.dev`.

An Ethiopian `.et` domain is a poor trade for this purpose: $99–278/year
through most registrars and days of manual provisioning, for a URL nobody will
type — they will scan it.

Then:

1. Add the domain to the Cloudflare Pages project (Pages → Custom domains).
2. `QR_TARGET=https://<new-domain>/imbirt node scripts/make-qr.mjs`
3. Update `site` in `astro.config.mjs`, `public/robots.txt`,
   `src/pages/sitemap.xml.ts` and the footer of `src/pages/cv.astro`.
4. `npm run build` and push.
5. **Reprint.**

Every QR code already handed out keeps working, because the code points at a
domain you control and not at a host's subdomain.
