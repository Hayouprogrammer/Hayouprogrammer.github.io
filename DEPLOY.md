# Deploying the portfolio

## Where it is now

**GitHub Pages, from a user site: https://hayouprogrammer.github.io/**

The repository is `Hayouprogrammer/Hayouprogrammer.github.io`. Every push to
`main` runs `.github/workflows/pages.yml`, which installs, builds with
`SITE_URL=https://hayouprogrammer.github.io`, and publishes `dist/`. Nothing is
deployed by hand.

### Why GitHub Pages and not Vercel

**Vercel's Hobby plan is explicitly restricted to non-commercial personal use**
([their fair-use guidelines](https://vercel.com/docs/limits/fair-use-guidelines)).
This site exists to win paying clients for Imbirt, so putting it there is both a
terms-of-service breach and a takedown risk.

GitHub Pages was chosen for the *first* launch for a different reason: it needs no
third-party account. The repository already existed, Actions was already
available, and the site is static. It is a stepping stone, not the destination —
Cloudflare Pages is the better long-term home, because its free tier permits
commercial use and has **no bandwidth cap**. That matters when one brochure scan
can send a few hundred people in one afternoon.

### Why a *user* site and not a project site

This is the load-bearing decision, and it is easy to get wrong.

A project site is served under `/<repo>/`. Astro **does not rewrite literal
internal links** — `href="/about"` stays `/about` — so on a project site every
route 404s. The alternatives are to prefix every `href` by hand through a
`withBase()` helper, or to set `base` and accept that one day somebody forgets.

A *user* site (`<username>.github.io`) is served from the domain root. `base`
stays `/`, `href="/about"` is already correct, and the same build works unchanged
once a custom domain is bought. The cost is that the username namespace is
occupied — which for a personal site is what it is for.

### What GitHub Pages does not do

| Feature | Status here | Consequence |
|---|---|---|
| `_headers` | ignored | No CSP, HSTS or `X-Content-Type-Options`. Deliberately **not** patched with `<meta>`: a meta CSP blocks the theme bootstrap and Astro's transition runtime, and a rule that breaks the page is worse than no rule. |
| `_redirects` | ignored | `/imbirt` redirects via Astro's meta-refresh page rather than a real 301. Browsers and scanners follow it; search engines treat it as a soft redirect. |
| Analytics | none | Cloudflare Web Analytics is the plan — see below. |

`public/_headers` and `public/_redirects` are committed and take effect the
moment the site moves to Cloudflare.

---

## Moving to Cloudflare Pages

### A. Git integration (recommended)

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
2. Pick `Hayouprogrammer/Hayouprogrammer.github.io`.
3. Build settings:

   | Setting | Value |
   |---|---|
   | Framework preset | `Astro` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Node version | `22` or higher |

4. **Environment variable:** `SITE_URL=https://<your-domain>`. Nothing else — the
   site has no secrets, and if a build ever asks for one that is a bug.
5. Custom domain → add it, point DNS at Cloudflare, done.

### B. Direct upload

```powershell
cd C:\src\portfolio
npm run build
npx wrangler pages deploy dist --project-name=hayelom-portfolio
```

Wrangler asks you to log in through the browser once.

---

## After the first deploy

1. **Turn on Web Analytics.** Cloudflare dashboard → the Pages project →
   **Analytics → Web Analytics → Enable**. It is cookieless and needs no consent
   banner, which is the whole point: a QR scanner is one tap from leaving.
   GitHub Pages has no equivalent, so until the move there is no analytics at
   all — and the site is built so that is survivable (no trackers by design).
2. **Verify the QR target.** The brochure QR encodes `https://<domain>/imbirt`.
   Confirm it lands on the case study. Source PNGs are untouched; re-run
   `node scripts/make-qr.mjs` after changing `qr.config.json`.
3. **Give a print run its own target** so you learn which one worked:

   ```powershell
   $env:QR_TARGET = "https://<domain>/imbirt?utm_source=brochure&utm_medium=print&utm_campaign=<event>-2026-11"
   node scripts/make-qr.mjs
   node scripts/verify-qr.mjs
   ```

   The case study reads that parameter and stamps it onto the visitor's email
   and WhatsApp drafts, so a reply tells you which leaflet it came from even
   without analytics.

---

## When you buy the domain

Buy it in **your own** account at Cloudflare Registrar (at-cost, free WHOIS
privacy) or Porkbun. Expect roughly $10–15/year for a `.com` or `.dev`. An
Ethiopian `.et` domain is a poor trade for this purpose: $99–278/year through
most registrars and days of manual provisioning, for a URL nobody will type —
they will scan it.

Then:

1. Add the domain to the Pages project and point DNS at Cloudflare.
2. Set `SITE_URL=https://<new-domain>` — Cloudflare env var, or edit the default
   in `astro.config.mjs`. `public/robots.txt` and `src/pages/sitemap.xml.ts` also
   carry the origin; update both.
3. `QR_TARGET=https://<new-domain>/imbirt node scripts/make-qr.mjs`
4. `npm run build` and push.
5. **Reprint.**

Every QR code already handed out keeps working, because the code points at a
domain you control and not at a host's subdomain.

## Pre-flight checklist

- [x] `npm run build` exits clean
- [x] `node scripts/audit.mjs` reports PASS on every route, light + dark + mobile
- [x] `node scripts/contrast.mjs` reports 0 failing pairs
- [x] `node scripts/verify-qr.mjs` reports every code decodes
- [x] `node scripts/test-plate-viewer.mjs` reports every viewer assertion passes
- [x] `/imbirt` redirects to `/work/imbirt`
- [ ] `https://hayouprogrammer.github.io/sitemap.xml` and `/robots.txt` resolve
- [ ] No `*.github.io` URL appears on anything printed
- [ ] The LinkedIn URL in `src/data/contact.json` is the real one
