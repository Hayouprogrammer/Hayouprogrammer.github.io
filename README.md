# Portfolio — Hayelom Gebrewahid

A static portfolio and case-study site for **Imbirt**, a multi-tenant ERP built on
Odoo 19.0 Community for Ethiopian hospitality, property and trading businesses.

Built with Astro, Tailwind CSS v4 and self-hosted type. No client-side framework,
no third-party font request, no trackers, no cookie banner.

```powershell
npm install
npm run dev      # http://localhost:4321
npm run build    # → dist/
```

## Documents

| File | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | What this site is for, the stack, the route map, the quality gates |
| [`DEPLOY.md`](DEPLOY.md) | Why Cloudflare Pages, how to deploy, and the domain migration path |
| [`BROCHURE.md`](BROCHURE.md) | The printed-leaflet strategy, the QR specification, and the copy |
| [`public/qr/README.md`](public/qr/README.md) | Print-ready QR codes and the exact spec for the print shop |
| [`DESIGN.md`](DESIGN.md) | The visual system — tokens, type, components, and why |

## Scripts

| Command | What it does |
|---|---|
| `npm run build` | Production build to `dist/` |
| `npm run check` | Astro type and content check |
| `npm run capture` | Re-capture the Imbirt product screenshots |
| `npm run figures` | Re-derive every published number from `ethio-erp-addons` |
| `node scripts/audit.mjs` | Accessibility, overflow, console and request gate across light / dark / mobile |
| `node scripts/contrast.mjs` | WCAG contrast check on every token pair |
| `node scripts/make-qr.mjs` | Regenerate the print QR codes |
| `node scripts/verify-qr.mjs` | Decode the generated QR codes back to text and prove the payload |

## The one rule

Every number on this site is generated from the repository by
`scripts/collect-figures.mjs`. If a figure cannot be re-derived, it does not go on
the page.
