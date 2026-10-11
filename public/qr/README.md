# QR codes for print — 2026-10-11

## Encoded targets

| File | Payload |
|---|---|
| `imbirt-brochure.svg` | https://hayouprogrammer.github.io/imbirt |
| `imbirt-brochure.png` | https://hayouprogrammer.github.io/imbirt (3 cm @ 300 dpi proof) |
| `vcard.svg` | vCard — Hayelom Gebrewahid |
| `vcard.png` | vCard (proof raster) |

## Print specification (hand this to the print shop)

| Property | Value | Why |
|---|---|---|
| Error correction | **Level H** (~30% recoverable) | A folded, creased or scuffed leaflet still scans |
| Quiet zone | **≥ 4 modules** on every side | Scanners refuse codes without the margin |
| Printed size | **≥ 3 × 3 cm**, target 4 × 4 cm | Below ~2 cm, phone cameras fail at arm's length |
| Colour | **Dark modules on light ground** | Light-on-dark fails on many cameras |
| Logo | optional, **≤ 20% of area**, only because we use level H | More than that and recovery breaks |
| Resolution | vector SVG, or ≥ 300 dpi PNG | Never upscale a raster |
| Paper | **matte / uncoated** | Gloss laminate creates glare and failed scans |
| Placement | flat, never across a fold or a crease line | a crease through the code is a dead code |

## The rule that makes this safe

The QR encodes **`https://hayouprogrammer.github.io/imbirt`**. That is a redirect, not the content. When the
domain changes:

1. Buy and point the new domain at the same host.
2. `QR_TARGET=https://<new-domain>/imbirt node scripts/make-qr.mjs`
3. Reprint.

**Do not print a code that points at a hosting subdomain.** If the host
changes, every leaflet already handed out is dead.

## Tracking (recommended, free)

Give each print run its own target so you know what worked:

```text
QR_TARGET="https://<domain>/imbirt?utm_source=brochure&utm_medium=print&utm_campaign=<event>-2026-10"
```

The case study persists the source and can show it back to you.
Cloudflare Web Analytics (cookieless, free) records the visits — no consent
banner, which matters because a scanner is already one tap from leaving.

## Test before the print run

Scan on three different phones, at arm's length and at 30 cm, in daylight and
under office lighting. If any of the six attempts fails, the code is too small,
the contrast is wrong, or the laminate is too glossy.
