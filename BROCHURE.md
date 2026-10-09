# The brochure — and the QR code that makes it work

Your instinct is right: for a hotel owner or a landlord in Addis Ababa, a
printed leaflet that they can hand to their accountant, or leave on the front
desk, does something a website link cannot. QR adoption in Ethiopia is high
because mobile money trained the behaviour. This channel is not outdated.

What follows is the best-practice version of that idea, including the parts
that would otherwise cost you a reprint.

---

## 1. The single most important change

**The QR must point at a domain you own — never at a hosting subdomain.**

A printed code is permanent. If it encodes `hayelom.pages.dev` and you later move
the site, every leaflet already in someone's hand is dead, and you will never know
which ones.

So the code encodes:

```
https://<your-domain>/imbirt
```

That is a **redirect**, not the content. The page can be reorganised, the host can
change, the case study can be split in three — the printed code keeps working
because you re-point the domain.

Until the domain is bought, keep the codes in `public/qr/` **unprinted**. Buy the
domain first, then run `node scripts/make-qr.mjs`, then print.

## 2. The second most important change

**The QR must land on the case study, not on the home page.**

The person scanning has just finished reading a leaflet about Imbirt. Sending them
to a portfolio cover forces them to re-orient: who is this, what is this, where is
the thing I just read about. That is one tap of context lost, and phone users do
not spend it.

Instead, the printed path starts where the brochure left off:

```
QR  →  /imbirt  →  301  →  /work/imbirt   (the case study)
```

Short, typeable, stable, and re-pointable without touching the printed code.
`src/pages/imbirt.astro` plus `public/_redirects` implement the redirect.

## 3. What the brochure should actually say

The leaflet is not a biography. It is a **demonstration vehicle**. Its job is to
make the reader believe the QR is worth scanning.

**Front (A5)**
> **Imbirt** — *እምብርትት*
> An ERP your hotel or portfolio can actually afford.
>
> Your reservations, folios, rent roll and owner statements in one system.
> One database per customer. An assistant that cannot change your books
> without asking you first.
>
> **[QR] Scan to see it running**
> `<domain>/imbirt`

**Inside left — the problem, stated as they experience it**
> Your front desk runs on a paper folio. Housekeeping runs on WhatsApp. Revenue
> runs on a spreadsheet that broke once already and nobody has dared fix.
>
> You know it is costing you money. The international platforms want more per
> user than a front-desk clerk earns in a month.

**Inside right — what it does, in their words**
> One system, installed in a day: reservations, folios and night audit for a
> hotel; leases, rent schedules and owner statements for a portfolio.
> Each tenant in its own database, on its own permissions. Accessible from a
> phone in the corridor.

**Back — proof and the ask**
> Built on Odoo 19 Community. No Enterprise licence. 27 custom modules,
> 911 automated tests, one engineer.
>
> **[QR: contact]** Save my details
> **Hayelom Gebrewahid** · Addis Ababa
> hayelomgebrewahid@gmail.com · +251 930 994 308 · Telegram / WhatsApp

Two QR codes, two jobs: the first sells, the second converts. Never one code
doing both — the reader who wants to contact you should not have to hunt
through a case study for your phone number.

## 4. Print specification

| Property | Value | Why |
|---|---|---|
| Format | A5 double-sided (148 × 210 mm) | Fits a breast pocket and a front desk drawer |
| Paper | **Matte / uncoated, 300 gsm** | Gloss laminate creates glare and failed scans |
| Colour | CMYK | A RGB file shifts on a commercial press |
| Bleed | 3 mm, with content 5 mm inside the trim | Nothing important gets guillotined |
| QR | Vector SVG from `public/qr/`, level H, ≥ 3 cm | See `public/qr/README.md` |
| Fallback | `<domain>/imbirt` printed as text next to the code | 15–25% of readers will not scan |

Ask the printer for a **hard-copy proof before the full run** and scan it.

## 5. Tracking — so you learn which run worked

Give each batch its own target. One command regenerates the codes:

```powershell
$env:QR_TARGET = "https://<domain>/imbirt?utm_source=brochure&utm_medium=print&utm_campaign=addis-hotel-expo-2026-11"
node scripts/make-qr.mjs
node scripts/verify-qr.mjs
```

Cloudflare Web Analytics (free, cookieless, no consent banner) then shows you
which campaign drove the visits. The case study also reads the parameter and
stamps it onto the visitor's email and WhatsApp drafts, so a reply tells you
which leaflet it came from even without analytics.

## 6. The upgrade worth considering: NFC

A plain NFC tag costs about $0.30 and points at the same URL. Tap instead of
scan. It removes every failure mode a QR has — glare, distance, a cracked camera
lens, a reader who does not know what to do with a code — and for a software
company handing a leaflet to a hotel owner it is a memorable, on-brand touch.

Print the QR anyway. NFC is the upgrade, not the replacement.

## 7. Test before you print

Six scans, minimum:

- [ ] Three different phones (an old Android, a new Android, an iPhone)
- [ ] Arm's length and 30 cm
- [ ] Daylight and under office lighting
- [ ] On the printed proof, not on screen
- [ ] On a folded copy — the fold crosses the code
- [ ] The text URL typed by hand, once

If any of the six fails, the code is too small, the contrast is wrong, or the
laminate is too glossy. Fix the print, not the code.

## 8. One more thing — use the same link everywhere

The QR, the LinkedIn featured link, the GitHub profile, the email signature and
the WhatsApp status should all point at `https://<domain>/imbirt`. One link,
everywhere, compounds. A brochure is one channel of that, not the whole strategy.
