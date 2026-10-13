# Portfolio — Hayelom Gebrewahid

A static portfolio and case-study site for **Imbirt**, a multi-tenant ERP built on
Odoo 19.0 Community for Ethiopian hospitality, property and trading businesses.

Built with Astro, Tailwind CSS v4 and self-hosted type. No client-side framework,
no third-party font request, no trackers, no cookie banner.

**Live:** https://hayouprogrammer.github.io/

```powershell
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
npm run gate     # build + QR decode + contrast + accessibility, one command
```

## Documents

| File | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | What this site is for, the stack, the route map, the quality gates |
| [`DEPLOY.md`](DEPLOY.md) | Why a VPS with Caddy, and the deploy runbook |
| [`deploy/README.md`](deploy/README.md) | The VPS runbook: Caddyfile, compose, first deploy, backups |
| [`BROCHURE.md`](BROCHURE.md) | The printed-leaflet strategy, the QR specification, and the copy |
| [`public/qr/README.md`](public/qr/README.md) | Print-ready QR codes and the exact spec for the print shop |
| [`DESIGN.md`](DESIGN.md) | The visual system — tokens, type, motion, components, and why |

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Production build to `dist/` |
| `npm run check` | Astro type and content check |
| `npm run capture` | Re-capture the Imbirt product screenshots |
| `npm run figures` | Re-derive every published number from `ethio-erp-addons` |
| `npm run apps` | Re-derive the application catalog from `ethio-erp-addons` |
| `npm run images` | Optimise the captures to WebP + JPEG |
| `npm run qr` | Regenerate the print QR codes |
| `npm run verify-qr` | Decode the generated QR codes back to text and prove the payload |
| `npm run audit` | Accessibility, overflow, console and request gate — light, dark, mobile |
| `npm run viewer` | Behavioural test of the plate viewer in a real browser |
| `npm run contrast` | WCAG contrast check on every token pair |
| `npm run verify-features` | The motion and navigation actually fire — scroll timelines, loupe, tabs, contents bar |
| `npm run verify-dark` | Captures Sheet and Binding side by side in `output/verify/` |
| `npm run verify-headers` | Loads the site under the production CSP and proves nothing breaks |
| `npm run verify-live` | Drives the deployed origin in a real browser |
| `npm run gate` | Build + QR decode + contrast + audit, in one command |

## Derived data

`src/data/figures.json` and `src/data/applications.json` are **committed derived
data**, produced by reading the `ethio-erp-addons` working tree on the machine
that has it. They are generated locally and committed, exactly like a lockfile:
CI cannot see that tree, and the committed files are what the build consumes.

Something in Imbirt moved a published number? Run `npm run figures` and
`npm run apps`, then commit the result.

## The one rule

Every number on this site is generated from the repository by
`scripts/collect-figures.mjs`. If a figure cannot be re-derived, it does not go on
the page.
