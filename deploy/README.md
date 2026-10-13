# The VPS runbook

Everything here is prepared and untested against a real box, because there is no
box yet. That is stated plainly rather than hidden: the configuration is
reviewable, and the first deploy is five commands.

## The shape

```
your machine                    the VPS
-----------                     -------
npm run build  ──rsync──►       /opt/portfolio/dist/     (read-only mount)
deploy.sh      ──ssh──►         /opt/portfolio/deploy/   (Caddyfile, compose, .env)
                              └─ one Caddy container, ports 80 + 443
```

The box has no Node, no npm, no git and no build toolchain. It serves a finished
directory. That is deliberate: the smallest possible production surface, and
nothing in it that needs patching at 3am.

## Why Caddy

| Need | How Caddy does it |
|---|---|
| HTTPS | Obtains and renews the certificate itself. No certbot, no cron, no expiry outage — the most common way a small VPS goes dark. |
| HTTP/2 + HTTP/3 | On by default. |
| Compression | zstd, Brotli and gzip, on by default. |
| The `/imbirt` 301 | A real server-side redirect, not a meta refresh. This is the main reason to leave GitHub Pages for a print-driven site. |
| Security headers | One `header` block, in one file. |
| A custom 404 | `handle_errors` rewrites to Astro's generated `404.html`. |

## Deploying

1. **Get a domain, in your own account.** Cloudflare Registrar (at-cost, free
   WHOIS privacy) or Porkbun. Roughly $10–15/year for a `.com` or `.dev`.
   Point its DNS at the VPS's IP address.

   The domain matters more than the hosting. Every QR code you print encodes it,
   and print is permanent — a hosting subdomain you do not own cannot be
   re-pointed after the leaflets are out.

2. **Copy the deploy configuration to the box and set the domain:**

   ```bash
   scp -r deploy/ user@your-vps:/opt/portfolio/
   ssh user@your-vps
   cd /opt/portfolio/deploy
   cp .env.example .env
   $EDITOR .env          # SITE_DOMAIN and ACME_EMAIL
   ```

3. **Build and ship:**

   ```bash
   # from your machine, in the repository root
   ./deploy/deploy.sh user@your-vps your-domain.example.com
   ```

   That builds with `SITE_URL` set to the real domain, rsyncs `dist/` and the
   deploy configuration, writes `.env` on the box, and reloads Caddy.

4. **Verify the redirect, which is what the QR depends on:**

   ```bash
   curl -I https://your-domain.example.com/imbirt
   # HTTP/2 301
   # location: /work/imbirt
   ```

5. **Regenerate and re-verify the QR codes** — this is the step that must not be
   skipped, because it is the one that cannot be fixed later:

   ```bash
   QR_TARGET=https://your-domain.example.com/imbirt node scripts/make-qr.mjs
   node scripts/verify-qr.mjs
   ```

   Then reprint. Any QR already handed out still works, because the code points
   at a domain you own and not at a host's subdomain.

## First-box setup (once, on the VPS)

```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # log out and back in

# Firewall: 22 for you, 80 and 443 for the world. Nothing else.
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# The deployment directory
sudo mkdir -p /opt/portfolio && sudo chown "$USER":"$USER" /opt/portfolio
```

And that is the whole server. PostgreSQL, backups and monitoring belong with the
ERP on its own box, not here.

## What to back up

Named volume `portfolio_caddy_data` holds the certificate and the Let's Encrypt
account key. Losing it costs a re-issue, not an outage — Caddy will simply
request a new certificate on the next start — but it is the only state on the
box, so a weekly `docker run --rm -v portfolio_caddy_data:/data -v "$PWD":/backup alpine tar czf /backup/caddy.tgz /data` is enough.

## What is deliberately not here

- **No analytics server-side.** Cloudflare Web Analytics (cookieless, free, no
  consent banner) sits in front once the domain is on Cloudflare's nameservers.
  If you stay on the VPS's own DNS, add a privacy-respecting counter or accept
  that you will know nothing about traffic — and design a fallback that does not
  depend on it, which this site already does: the QR can carry a campaign
  parameter and the contact links carry it into the visitor's draft message.
- **No database, no application server, no Node on the box.** Nothing to patch.
- **No `docker-compose` on your machine.** The build is local, the serving is
  remote.
