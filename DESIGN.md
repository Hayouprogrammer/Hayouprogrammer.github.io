# DESIGN — The Operations Dossier

> Written from the built world, not before it. Every token below is in
> `src/styles/global.css` and every rule was applied to the shipped site.

## The direction

The portfolio is a **printed, serial-numbered business document rendered on
screen**: plate numbers, ruled tables, dimension lines, a masthead, a colophon.
It reads like the best-run business in Addis printed you something.

It is deliberately not the three looks every AI interface lands on: no warm cream
paper with a terracotta accent and an italic serif; no near-black with one neon
accent and glowing edges; no broadsheet hairline with tracked mono labels. The
differentiation is structural first — the page is a document, with ruled tables
and serials, not a stack of cards.

Two faces of one document, resolved before first paint and persisted:

- **Sheet** (light) — the printed page. Cool stone-paper ground, ink, brass.
- **Binding** (dark) — the leather ledger cover the sheet sits in. Deep
  green-black ground, bone ink, brass.

Light and dark are not chosen by category. The sheet is the default because the
audience reads documents on paper and in daylight; the binding exists because an
engineer reads at 2 a.m.

## Colour

| Token | Light | Dark | Role |
|---|---|---|---|
| `paper` | `#e9e5dc` | `#0b1412` | Ground. Cool neutral stone, not cream |
| `paper-raised` | `#f2efe8` | `#11201c` | Plates, cards |
| `paper-sunk` | `#ded9cf` | `#070d0c` | Recessed bands |
| `ink-900` | `#15181a` | `#ece8de` | Primary text |
| `ink-700` | `#33393c` | `#c4c0b6` | Body secondary |
| `ink-500` | `#5d6467` | `#8b9089` | Labels, captions |
| `ink-300` | `#5e6567` | `#88908a` | Footer and measure notes |
| `ledger-900` | `#0d332d` | `#05100d` | Committed regions |
| `bone` | `#f1eee5` | `#f1eee5` | Text on ledger |
| `brass-600` | `#7d5716` | `#d8ab52` | The one accent. Serials, rules, spines |
| `brass-400` | `#d2a44c` | `#e6c179` | Accent on ledger ground |
| `brass-200` | `#e8cf9a` | `#3a2f18` | Highlight, selection |
| `oxblood` | `#8c2b23` | `#de7263` | Exceptions only, never decoration |

**Colour strategy: Committed.** `ledger-*` owns whole regions — the contact band,
the section plates — rather than one accent scattered over a neutral ground.

**Every pair clears 4.5:1.** `scripts/contrast.mjs` reads the tokens out of
`global.css` and fails the build on a regression. It is not a separate palette
that can drift.

Banned here: gradients, colour as the sole carrier of meaning, and any accent
colour outside the eight above.

## Type

| Face | Source | Role |
|---|---|---|
| **Bodoni Moda** | `@fontsource/bodoni-moda`, self-hosted | Display, masthead, H1–H3 |
| **Archivo Variable** | `@fontsource-variable/archivo`, self-hosted | Everything else |
| **Noto Sans Ethiopic** | `@fontsource/noto-sans-ethiopic`, self-hosted | One brand wordmark, እምብርብት |

Three faces, each with one job. No `fonts.googleapis.com` request — the fonts
ship beside the page, which is faster, private, and survives an offline load.

- Display is set **tight and upright**, never italic. The engraved authority is
  in the letterform, not a slant.
- Every number on the site is **tabular** (`font-variant-numeric: tabular-nums`).
  Ledgers align; unaligned figures in a dossier look like a mistake.
- Body measure is held at `max-w-prose` (~65–75 ch).
- Scale: body `1rem`, lede `1.125rem`, section heads `clamp(1.75rem → 2.75rem)`,
  display `clamp(2.25rem → 4.5rem)`.

## Component language

| Component | What it is |
|---|---|
| `.dossier` | The document frame — a centred column with a hard edge rule each side |
| `.dim-rule` | A hairline with end ticks. Used to close a section head |
| `.label` | 11 px, `0.16em` tracked, uppercase, tabular. The workhorse |
| `.stamp` | A rubber stamp. **States a verified fact only** |
| `RuleTable` | Ruled table with `Entry / Value / Note` columns |
| `FigurePlate` | A screenshot presented as an engineering plate, with a serial and a measurement |
| `SectionHead` | Serial + kicker + head + lede, closed by a dim rule |
| `ContactBand` | The committed ledger-green close |
| `SiteHeader` | Two rows on a phone, one from `sm` up. Sheet/Binding toggle |
| `AiGovernanceFigure` | The AI figure. A measured drawing, not a product mock |

Refused outright: cards as the page structure, icon tiles, hero-metric blocks,
gradient text, glass and blur as decoration, a coloured `border-left` above 1 px,
hard offset shadows, sparklines and progress rings, monospace as costume for
"technical".

## The figures

Two of them carry the page, and both are **measured drawings rather than
screenshots**:

- **The platform section** (`ArchitectureSection.astro`) — three planes with a
  dimension gutter, drawn from the module graph. It is labelled "drawn from the
  module graph", so it is a diagram and never mistaken for a screenshot.
- **The governed write** (`AiGovernanceFigure.astro`) — the risk ladder, the
  preview payload, and the pending record. Field names, risk tiers, the masking
  rule and the TTL are read from `addons/imbirt_ai`. The values are illustrative
  and the figure says so on its face, because no LLM endpoint existed on the
  capture machine and nothing is faked.

Product screenshots are real captures of a reachable state. A plate that could
not be captured renders an explicit "not captured" panel naming the missing file
— an honest gap, never a stock image.

## Motion

One authored moment per surface, exponential ease-out, and everything is visible
by default. `prefers-reduced-motion: reduce` collapses transitions and disables
smooth scrolling site-wide. There is no entrance-animation cascade and no scroll
parallax; the page is a document and documents do not animate.

## Accessibility

- All 25 token pairs ≥ 4.5:1 in both schemes (`scripts/contrast.mjs`).
- Zero axe violations on the `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` tags
  across every route, light and dark, at 1440 and 390 (`scripts/audit.mjs`).
- Visible focus everywhere; the theme toggle is a real `<button>` with a visible
  label and `aria-pressed`.
- Theme resolves before first paint — no flash of the wrong sheet.
- Never colour alone: every status carries a word (stamps, state badges, the
  risk ladder).

## Verified against

| Route | Light | Dark | Mobile |
|---|---|---|---|
| `/` | 0 violations, no overflow | 0 violations, no overflow | 0 violations, no overflow |
| `/work/imbirt` | 0 / no | 0 / no | 0 / no |
| `/work` | 0 / no | 0 / no | 0 / no |
| `/about` | 0 / no | 0 / no | 0 / no |
| `/contact` | 0 / no | 0 / no | 0 / no |
| `/cv` | 0 / no | 0 / no | 0 / no |

Reproduce: `npm run build && npx astro preview`, then `node scripts/audit.mjs`.
