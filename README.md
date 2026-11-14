# PR-Hunter 🎁

**PR-Hunter** is an open-source, iPad-first progressive web app for discovering and tracking public product-testing, giveaway, and brand-collaboration opportunities.

**Status: Ultimate Phase 4 – local Instagram link inbox, account labels and private backups.** The dashboard and scheduled public-feed scanner are implemented. No Instagram account is connected, no real application is submitted, and no products are guaranteed.

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

## Ultimate Phase 2: verified Streetwear sources (2026-11)

A mixed Streetwear Scout now combines public RSS/Atom feeds with a curated list of **real, date-scoped offers** from official/organizer terms in `config/curated-offers.json`.

- Scanned RSS hints are still explicitly **unverified**.
- Curated listings link to both the official action and the terms, include a known deadline, participation method, shipping verification and any unknown costs.
- An offer is curated only if **no purchase is required** and **the winner keeps the prize**. Unknown delivery costs/regions are labeled rather than presented as fully qualified.
- The scanner automatically removes expired curated offers at the next run, while the client also hides expired items immediately in the main feed.
- Curated items appear first, with the 90/10 fashion-to-tech ranking preference preserved when enough genuine inventory exists.
- A new source candidate, Beyond Pixels' publicly syndicated RSS feed, is monitored. Feed health is shown honestly in the dashboard. If it is blocked, it is not scraped or bypassed.
- On iPad, tap **Instagram-Link einfügen** to import a copied public giveaway URL into a local manual entry. This action requires a tap and reads clipboard data locally only. Hashtag shortcuts also open Instagram for manual discovery.

**Not yet available:** Automatic scanning of public Instagram Reels for user-supplied brands. Meta's official discovery capabilities require a separately authorized professional account, app registration, review and permissions; this repo does not have those credentials or permission. No automated third-party likes, follows, comments or DMs have been added.

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



## Phase 3 – Local-first participation assistant

The iPad dashboard includes a private guided workflow to prepare, verify, confirm, and track real giveaway opportunities without automating unsupported actions:

- **Teilnahme** tab prioritizes known deadlines and shows per-offer checklists. No deadline is invented.
- Read organizer rules, verify Germany eligibility, shipping costs (maximum €5), no purchase and no return obligation. The checkbox confirms the user checked these conditions, not that the app independently verified them.
- Curated organizer terms may require newsletter, Double-Opt-In, an external form or WhatsApp. Instagram tasks (follow, like, comment, tag, story) are manually selected and never presumed to be part of the rules.
- Three comment suggestions can be copied for the user to personalize and post by hand. Nothing is submitted to Instagram.
- Entry confirmation is a second deliberate action, with a local activity log. Double confirmation of the same giveaway is blocked, including across account labels; no duplicate-entry encouragement.
- Discovery filters support **reviewed source rules** and **ending within 72 hours**; reviewed conditions do not imply verified eligibility or delivery.
- An account-label filter helps search the existing local activity history; it does not connect Instagram accounts.
- The existing \`pr-hunter-state-v1\` key is preserved so earlier bookmarks and entries remain available in Safari.

### Instagram API boundary

Meta's official Instagram APIs chiefly manage authorised professional account media, comments on owned media, and some documented discovery cases. This is not unrestricted permission to scrape Instagram, like or comment on unrelated giveaways. There is no account connection, login automation, scraping, mass posting, messaging, or credentials in this public repository. Official OAuth integration would need specific Meta permissions, app review and a secure service.

This phase is covered by Node.js regression tests. Physical iPad modal, scrolling and keyboard testing is a separate final acceptance step.


## Phase 4 — Streetwear Link Inbox + local resilience

- **Link Inbox** accepts up to 40 distinct HTTPS URLs per batch, including URLs extracted from copied Instagram captions/messages. Instagram \`/p/\`, \`/reel/\` and \`/tv/\` references are canonicalized and tracking parameters removed. This **does not** read reel captions, scrape accounts or confirm that a giveaway actually exists.
- Imported posts are tagged **"Instagram-Beitrag – Gewinnspiel selbst prüfen"**. They appear as manually collected, **unverified** fashion hints rather than invented active contests.
- User may assign a single self-reported brand name per batch, which is not verified from Instagram.
- **Account labels (max 20)** help organize locally documented entries. These are NOT linked Instagram accounts. PR-Hunter does not perform repeat entries or mass interaction across accounts.
- **Private JSON backup/export and restore**: stored bookmarks, saved offer snapshots, manually collected links, custom brands, checklists, account labels, and participation logs are all included. Import limits, data validation, URL validation and explicit replacement confirmation prevent accidental corruption and risky links. All processing happens locally; do not upload personal JSON backups to GitHub.
- Same \`pr-hunter-state-v1\` storage key for migration compatibility. The new PWA shell cache includes \`phase4-core.mjs\`.

### Important platform boundary

On iPadOS Safari, a Home Screen PWA cannot reliably register as a native **Web Share Target** for Instagram, so **copy & paste** is used instead. Meta's Instagram APIs require appropriate professional accounts, explicit app authorization and approved scopes. They do not allow bulk posting of giveaway comments on arbitrary third-party reels. No Instagram account credentials, API tokens or background posting have been added. Future official integration needs a secure backend and separate user authorization.

Security: backups contain personal account labels, offer URLs and self-reported activities. Export only onto devices or storage the user controls. A restore **replaces** the current device-local data after confirmation; take a separate backup first.
