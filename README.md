# PR-Hunter 🎁

**PR-Hunter** is an open-source, iPad-first progressive web app for discovering and tracking public product-testing, giveaway, and brand-collaboration opportunities.

**Status: Ultimate Phase 1, evolving from the v0.1 MVP.** The dashboard and scheduled public-feed scanner are implemented. No Instagram account is connected, no real application is submitted, and no products are guaranteed.

## Discovery priority

**Clothing and technology are the default filtered view.** PR-Hunter prioritizes streetwear, sneakers, hoodies, tracksuits, fashion, headphones, smartphones, gaming hardware, tablets, and other consumer electronics. Other categories can be shown by selecting "Alle Kategorien" in the iPad dashboard.

Prioritization does **not** mean those brands are currently offering products: real public opportunities only appear when legitimate sources are configured.

## Features

- Responsive, touch-friendly German dashboard, installable from Safari as a PWA
- Discover, filter, bookmark and manually add offers
- Track each offer: saved, contacted, accepted or received
- Prepare and copy a personal application draft (you decide whether to send it)
- Import publicly available RSS/Atom opportunities with a GitHub Actions job every six hours
- Local-only personal tracking data in the browser; no API keys or passwords required

## Start locally

Requires Node.js 22 or later. No third-party packages are needed.

```sh
npm run dev
```

Open http://localhost:4173 on your computer. Run `npm test` for scanner tests.

## Live discovery sources

The default `config/sources.json` now uses three public RSS feeds tested in GitHub Actions:

- **freitest.de** – product-testing listings
- **Testpiloten.de** – product-testing news
- **Pfennigfuchs** – product-testing and technology


The fourth source, Gewinnspielefinder, returned HTTP 403 during live testing and was removed instead of bypassing site restrictions. These three sites publish RSS/Atom endpoints for subscription. PR-Hunter reads them **at most every six hours**, uses short excerpts and links back to the publisher. Availability, participation conditions, deadlines and whether a product can be kept **must be verified at the actual action**. No offer is claimed to be guaranteed. Some feeds may occasionally fail, block automated requests or contain no matching entries; the dashboard shows scan health and will never invent offers.

The workflow runs on changes to source configuration or scanner code, as well as a six-hour schedule, and writes the resulting public catalog into `docs/opportunities.json`. GitHub Pages then serves the updated catalog. Every successful scan replaces the previous public catalog so false positives and outdated entries are not retained indefinitely. Scheduled runs may be delayed; the dashboard displays scan timestamps and source health.

**Important:** The official MediaMarkt Testpiloten page is linked inside the app for manual checking, not secretly scraped or automatically enrolled. Some programs require an account, reviews, or returning the product.

## Enable automated discovery

1. Four sources are already configured. Optionally edit `config/sources.json` to add publicly accessible **HTTPS RSS or Atom feeds** intended for automated subscriptions, e.g. `{"name":"My allowed feed","url":"https://example.org/feed.xml"}`. Follow each publisher's reuse conditions.
2. Commit that configuration to your branch. **Do not put authentication tokens or private feed URLs in this public repository.**
3. GitHub Actions → **PR-Hunter public feed scan** → **Run workflow**. It also runs every six hours. The workflow requires Actions **read/write** repository contents permission to commit updated `docs/opportunities.json`.
4. The collector filters for relevant giveaway, product-testing and collaboration terms. Its matches are suggestions, not verified free-product entitlements. Always read each source's terms.

If all configured feeds are temporarily unavailable, the current public catalog is preserved. If no qualifying entries have been found yet, use **Angebot hinzufügen** to track a public offer manually. Its data stays on your device.

## Put it on iPad

In GitHub Settings → Pages, select **Deploy from a branch**, branch `main`, folder `/docs` after merging the PR. Then visit the GitHub Pages URL in iPad Safari → Share → Add to Home Screen. The repository being public **does not automatically mean Pages is enabled**.

## Scope and safety

This is **not** an Instagram DM spam bot. Meta's official messaging capabilities do not grant permission to send unsolicited messages to arbitrary accounts. PR-Hunter intentionally does not scrape Instagram, impersonate people, mass-message brands, or auto-fill protected forms. A future application integration requires an official supported endpoint, consent from the receiving service, and explicit opt-in. There is currently **no automatic sending**.

This repo is public. Never commit addresses, account credentials, API secrets, private contact details, or personal application responses. Browser data is local to the current device, and clearing Safari storage removes it. GitHub Pages will make the public opportunity catalog readable by everyone.

MIT licensed. This app is independent and not affiliated with Instagram or Meta.

## Ultimate Phase 1: Fashion-first iPad experience (2026-11)

The first Ultimate iteration replaces the old dark dashboard with a **light iPad-first streetwear discovery interface** (inspired by the layout patterns of social and Apple apps, not a copied UI). It adds:

- A real public feed presented in swipe-friendly vertical-style cards (cards are **not** fabricated Instagram videos or product photos).
- A configurable **90% fashion / 10% technology feed preference**. This is a ranking objective; the number and mixture of real offers depend on available inventory. "All" still reveals other categories.
- Brand Radar seeded with the user's five streetwear Instagram references: Suvene, Ranya, 6PM Updates, More Money More Love, and Deputy Department. **These are bookmarked reference profiles, not proof of live giveaways or automated Instagram monitoring.** Add or remove custom Instagram profiles locally.
- A private **activity timeline** to record drafted comments, confirmed manual participation, self-reported wins and product arrival, with optional account labels, notes and HTTPS evidence links.
- Bookmarks now snapshot their original listing so older bookmarked public opportunities remain visible when a new scan replaces the catalog.
- Network-first caching for the public catalog with an offline fallback, and updated iPad PWA theme.

The original \`pr-hunter-state-v1\` browser storage key is retained to preserve existing user bookmarks, manually added opportunities and application statuses. Additional data also stays in browser localStorage and is lost if Safari site data is cleared. The public GitHub Pages site does not store private activity.

**Not implemented yet:** Instagram search/scraping, likes, follows, comments, DMs, multi-account sign-in, cloud storage, push notifications, proof of eligibility, automatic contest entries or guaranteed product delivery. Never add Instagram passwords, session cookies or other personal data to the public repository.

### Validation

\`npm test\` checks the feed scanner and pure Ultimate logic. GitHub Pages serves static files from \`/docs\`; test all interactive flows on a physical iPad before calling the release hardware-verified.

