# Deploying the portfolio

## Where it is going

**A VPS, with Caddy in front.** The box is not bought yet — it comes with the
first client — but everything is prepared so the first deploy is five commands.
See [`deploy/README.md`](deploy/README.md) for the runbook.

It is currently **live at https://hayouprogrammer.github.io/** on GitHub Pages,
which needs no third-party account and nothing to maintain. That is a
stepping stone, not the destination: Pages cannot serve custom headers, cannot
serve a real `301`, and has no analytics.

### Why Caddy is the best practice for this box

The brief was "we will use the best practice", so the reasoning is recorded:

| Need | Caddy |
|---|---|
| HTTPS | Obtains **and renews** certificates itself. No certbot, no cron, no expiry outage — the most common way a small VPS goes dark. |
| HTTP/2 + HTTP/3 | On by default. |
| Compression | zstd, Brotli, gzip — on by default. |
| The printed `/imbirt` short link | A real server-side `301`, not a meta refresh. |
| Security headers | One `header` block in one file. |
| Custom 404 | `handle_errors` rewrites to Astro's generated `404.html`. |

And the whole thing is one container with one read-only bind mount of the build
output. No Node, no npm, no git, no build toolchain on the box — nothing in
production that can be exploited, patched or woken at 3am.

## What GitHub Pages does not do

| Feature | Status there | Consequence |
|---|---|---|
| `_headers` | ignored | No CSP, HSTS, `X-Content-Type-Options` |
| `_redirects` | ignored | `/imbirt` redirects by meta refresh, which is a soft redirect |
| Analytics | none | Nothing is measured at all |
| Build controls | ~1 build/min | Not a constraint for a site that changes monthly |

`public/_headers` and `public/_redirects` are committed and were written for
Cloudflare, but **`deploy/Caddyfile` is now the source of truth** for both, and
the files under `public/` are kept in sync so the site is portable to any host.

## The first deploy

```bash
# on the VPS, once
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker "$USER"
sudo ufw allow 22,80,443/tcp && sudo ufw enable
sudo mkdir -p /opt/portfolio && sudo chown "$USER":"$USER" /opt/portfolio

# from your machine, in the repository root
./deploy/deploy.sh user@your-vps.example.com your-domain.example.com
```

`deploy.sh` builds with `SITE_URL` set to the real domain, rsyncs `dist/` and the
deploy configuration, writes `.env` on the box, and reloads Caddy. The box never
runs a build.

## The domain, and why it comes first

**Buy the domain before printing anything.** Every QR code encodes it, and print
is permanent. Buy it in your own account — Cloudflare Registrar (at-cost, free
WHOIS privacy) or Porkbun — roughly $10–15/year for a `.com` or `.dev`.

An `.et` domain is a poor trade here: $99–278/year through most registrars and
days of manual provisioning, for a URL nobody will type. They will scan it.

Once it is pointed at the VPS:

```bash
QR_TARGET=https://<your-domain>/imbirt node scripts/make-qr.mjs
node scripts/verify-qr.mjs
```

Then reprint. Codes already handed out keep working, because the code points at
a domain you own and not at a host's subdomain.

## After the first deploy

1. **Verify the redirect the QR depends on:** `curl -I https://<domain>/imbirt`
   must be a `301` to `/work/imbirt`.
2. **Run the production verification set:**
   `npm run verify-headers` (the CSP holds and nothing breaks),
   `npm run verify-live <url>` (the deployed site behaves in a real browser).
3. **Analytics.** Cloudflare Web Analytics is cookieless, free and needs no
   consent banner — which matters because a QR scanner is one tap from leaving.
   It requires the domain on Cloudflare's nameservers; if you stay on the VPS's
   own DNS, the fallback is already built: the QR can carry a campaign parameter
   and the contact links carry it into the visitor's draft message, so a reply
   still tells you which leaflet it came from.
4. **Back up the one piece of state:** the `portfolio_caddy_data` volume holds
   the certificate and the Let's Encrypt account key. Losing it costs a re-issue,
   not an outage.

## Pre-flight checklist

- [x] `npm run build` exits clean
- [x] `npm run audit` reports PASS on every route, light + dark + mobile
- [x] `npm run contrast` reports 0 failing pairs
- [x] `npm run verify-qr` reports every code decodes
- [x] `npm run viewer` reports every viewer assertion passes
- [x] `npm run verify-headers` reports the production CSP holds in both schemes
- [x] `npm run verify-features` reports the motion and navigation actually fire
- [ ] `./deploy/deploy.sh` has run against the real VPS
- [ ] `curl -I https://<domain>/imbirt` returns `301` → `/work/imbirt`
- [ ] QR codes regenerated against the real domain and re-verified
- [ ] No `*.github.io` or `*.pages.dev` URL appears on anything printed
- [ ] The LinkedIn URL in `src/data/contact.json` is the real one
