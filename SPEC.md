# Spec: Hayelom Gebrewahid — Portfolio & Imbirt Case Study

> Status: **approved by the principal on 2026-10-09** (answers captured in the
> structured interview). Living document — update before implementing a change.

## Objective

Build a single, fast, permanent public home for **Hayelom Gebrewahid** whose
primary job is **to win clients for Imbirt** — the multi-tenant Ethiopian ERP
platform he built on Odoo 19.0 Community.

Success is a visitor who scanned a brochure QR code (or clicked a LinkedIn
signature link) and, within **15 seconds**, can answer three questions:
1. What is Imbirt and who is it for?
2. Is this person really capable of building and running it?
3. What is the single next action?

The site's flagship artifact is the **Imbirt case study**. Everything else
(about, contact, CV) exists to support it.

Secondary job (deliberately subordinated): give a hiring manager enough
engineering depth to take him seriously — but never at the cost of the client
path.

## Answers that locked this spec

| Question | Answer |
|---|---|
| Primary job | Win clients for Imbirt |
| Projects featured | Imbirt only, in depth |
| Domain | Start on a free `*.pages.dev`; buy a custom domain later |
| Product imagery | Boot the real demo rig and capture real screenshots |
| Contact channels | Email · Telegram/WhatsApp · Phone · LinkedIn (GitHub is on the case-study, not the header) |
| Language | English only |
| QR/brochure | Yes — QR lands on a **case-study page**, not the home page |

## Tech Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Astro 5** (static output) | Content collections for case studies, zero client JS by default → fast on Ethiopian 4G |
| Styling | **Tailwind CSS v4** via `@tailwindcss/vite` | Tokens in `@theme`; fast responsive iteration |
| Fonts | **self-hosted** via Fontsource | No `fonts.googleapis.com` request; faster and private |
| Display face | Bodoni Moda | Engraved ledger masthead authority |
| Text face | Archivo (variable) | Sturdy grotesque, real tabular figures |
| Ge'ez face | Noto Sans Ethiopic | One brand wordmark only (እምብርብት) |
| Hosting | **Cloudflare Pages** (free) | Unlimited static bandwidth, commercial use permitted |
| Analytics | Cloudflare Web Analytics | Cookieless — no consent banner to break the QR funnel |
| QR generation | `segno` / `qrcode` (local) | No third-party QR API for something going to print |

## Commands

```powershell
cd C:\src\portfolio
npm install                 # first time only
npm run dev                 # http://localhost:4321
npm run build               # → dist/
npm run preview             # serve the production build locally
npm run capture             # (re)capture Imbirt screenshots
npm run figures             # refresh repo-derived numbers in src/data/figures.json
node scripts/make-qr.mjs    # regenerate print QR codes into public/qr/
```

## Project Structure

```
C:\src\portfolio\
  SPEC.md                    this file
  DESIGN.md                  written at finish, from the built world
  astro.config.mjs
  scripts/
    capture-screens.mjs      Playwright capture of the real Imbirt demo rig
    make-qr.mjs              print-grade QR + vCard generation
    collect-figures.mjs      pulls verifiable numbers out of ethio-erp-addons
  src/
    data/figures.json        generated; verified facts only
    content/case-studies/    MDX case studies (Imbirt flagship + verticals)
    components/              Masthead, Folio, RuleTable, Stamp, Serial, …
    layouts/Base.astro
    pages/
      index.astro            home — the dossier cover
      work/imbirt.astro      FLAGSHIP case study — QR target
      work/index.astro       case-study index
      about.astro
      contact.astro
      imbirt.astro           301 redirect → /work/imbirt (the printed QR path)
      cv.astro                print stylesheet, downloadable
      404.astro
    styles/global.css        design tokens + base
  public/
    screens/                 real product screenshots
    qr/                       print-grade QR SVGs
    og/                       social cards
```

## The Route Map (QR-critical)

| Route | Purpose |
|---|---|
| `/imbirt` | **The printed QR target.** Short, typeable, stable. 301 → `/work/imbirt` |
| `/work/imbirt` | Flagship case study. Persists a `?src=` param into the contact CTA |
| `/` | Cover / home. Links into the case study |
| `/cv` | Print-optimised CV, A4, `@media print` |

## Code Style

- Astro components, one component per file, props typed with `interface Props`.
- No client-side framework. Interactivity is a `<script>` island only where it
  earns its weight (theme toggle, QR/vCard copy button).
- Design tokens live in `@theme` in `src/styles/global.css` — never raw hex in
  components.
- Tailwind arbitrary values only when a token genuinely does not exist.
- All numeric claims in `src/data/figures.json` carry a `source` field.

```astro
---
interface Props { serial: string; label: string; }
const { serial, label } = Astro.props;
---
<div class="flex items-baseline gap-3 font-body">
  <span class="text-ink-500 text-xs tracking-[0.2em] uppercase tabular">{serial}</span>
  <span class="text-ink-900 text-sm">{label}</span>
</div>
```

## Testing Strategy

| Level | Tool | Concern |
|---|---|---|
| Build | `npm run build` must exit 0 | no broken imports, all content resolves |
| Link check | `npm run check` + a link sweep script | every internal route resolves; `/imbirt` 301s |
| Visual | Playwright capture at 1440 / 768 / 390 | desktop, tablet, mobile — screenshot evidence |
| A11y | axe-core via Playwright | zero critical violations |
| Performance | Playwright timing + Lighthouse | LCP < 2.5s on a throttled 4G profile |
| Content accuracy | every figure re-derivable from `scripts/collect-figures.mjs` | no invented claims |

## Boundaries

**Always**
- Run `npm run build` before reporting done.
- Screenshot the built site at desktop + mobile before presenting it.
- Keep every published number traceable to a command in
  `scripts/collect-figures.mjs` or to a repo document.
- Keep the QR target route (`/imbirt`) working even if the case study is
  reorganised.

**Ask first**
- Publishing anything not yet verified (customer names, revenue, logos).
- Adding an npm dependency.
- Changing the contact channels on the site.

**Never**
- Commit secrets. `docs/CREDENTIALS.md` in the ERP repo is gitignored and must
  stay that way.
- Put a `*.pages.dev` or `*.vercel.app` URL on a printed QR code.
- Ship a page whose screenshots are of a product state that is not reachable
  from the public repo.
- Use `fonts.googleapis.com` or any third-party font host.

## Success Criteria

- [ ] `npm run build` exits clean; `dist/` has no broken internal links.
- [ ] `/imbirt` returns a 301 to `/work/imbirt`.
- [ ] The Imbirt case study renders ≥8 real screenshots captured from the demo rig.
- [ ] Every figure on the site appears in `figures.json` with a `source`.
- [ ] Lighthouse mobile: Performance ≥ 95, Accessibility ≥ 95, Best Practices ≥ 95.
- [ ] Zero axe critical violations at 1440 / 768 / 390.
- [ ] Deployed to Cloudflare Pages; `wrangler pages deploy` or Git integration
      verified green.
- [ ] QR SVGs generated at print resolution with H-level error correction and a
      tested scan distance.

## Open Questions

- Custom domain name + who registers it (deferred by decision — free tier first).
- Whether the brochure is printed locally in Addis or abroad (paper stock
  availability changes the QR contrast guidance).
- LinkedIn profile URL — not yet supplied.
