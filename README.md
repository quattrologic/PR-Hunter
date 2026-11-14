# PR-Hunter 🎁

**PR-Hunter** is an open-source, iPad-first progressive web app for discovering and tracking public product-testing, giveaway, and brand-collaboration opportunities.

**Status: Phase 9 – Free-Product-Hunter with product testing, creator collaborations and giveaways.** The dashboard and scheduled public-feed scanner are implemented. No Instagram account is connected, no real application is submitted, and no products are guaranteed.

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


## Phase 5 – Integration Hub (preparation, not OAuth yet)

The iPad \`Integrationen\` tab (previously the "About" entry) adds:
- A **truthful connection status**: Instagram is **not connected**. No login buttons that imply authorization and no secret/token fields in the public PWA.
- A Meta platform setup checklist (Creator/Business, developer app, confidential HTTPS backend, scopes/app review). The checkboxes are **self-reported preparation only**. Even completing the checklist **does not create a Meta connection**.
- Separate, documented **Instagram Login** and **Facebook Login** routes. Instagram Login can manage authorized professional accounts but has no general hashtag search; Facebook Login needs a Page-linked professional account and offers limited hashtag / Business Discovery endpoints with approved permissions and rate limits.
- The existing Brand Radar is matched to actual existing public RSS/editorially reviewed entries by brand title/organizer. Results appear only if the source contains a matching item. External search links are offered for manual exploration and do not imply the source is indexed or currently running a giveaway.
- A public-source diagnostics panel shows real GitHub Actions RSS success counts and latest matching feed items from the catalog.
- Setup preferences are persisted device-locally, included in the existing JSON backup, and sanitized upon restore. Other stored state remains unchanged.

**Not implemented**: real Meta OAuth, token exchange, webhook verification, secure token vault, reading foreign Instagram Reels, automatic comments/likes/follows/DMs, or 20-account simultaneous connections. These require a configured Meta developer app, redirect domain and **non-static backend**. No personal account access is available without explicit owner authorization.

### Setup principles for future OAuth backend

1. The user connects **only their own authorized professional account** in a separate Meta consent screen; neither the PWA nor GitHub repository collects an Instagram password.
2. A private HTTPS backend creates and validates one-time OAuth state/PKCE (where supported), handles Meta's code exchange, stores encrypted tokens server-side, and sets secure HttpOnly SameSite session cookies.
3. The backend enforces per-account permissions, opt-in, rate limits, webhook signature checks, and token revocation and deletion.
4. Use only documented APIs. Even comment-management permissions do **not** mean unrestricted commenting on other brands' giveaway Reels.
5. The first real integration deployment must be separately validated on an actual iPad and requires the user's explicit authorization.

Official background: https://developers.facebook.com/docs/instagram/platform/instagram-api/changelog/ and https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login


## Phase 6 – Local notifications and encrypted portable backups

### Implemented

- A new notification center (bell in the iPad header) for **newly seen public catalog hints** and **existing opportunities with known deadlines in the next 72 hours**. The initial catalog load is a baseline; its existing results are not misrepresented as newly discovered giveaways.
- Alerts are local, de-duplicated, marked read individually or all at once, with controls for new-offer/deadline notifications. An optional Home Screen badge can show an unread count while the PWA is open if Safari supports Badging API.
- **No background Web Push, no scheduled device notifications, no Instagram message or winner monitoring.** GitHub Pages has no private push server or backend subscription database; the app checks and updates notices **when opened or the public catalog is refreshed**.
- The Link-Inbox backup section can now export **AES-256-GCM encrypted backups** using a passphrase of at least 12 characters; keys are derived with PBKDF2-SHA-256 (250,000 rounds, random salt and IV). Encryption/decryption is **local on-device using Web Crypto**; the passphrase is never saved in GitHub, localStorage, or the backup.
- Files use \`.prh\` format. They can be carried manually through the iPad Files app, AirDrop or iCloud Drive, and imported with the user's passphrase. The existing plaintext JSON export/import remains for backwards compatibility but exposes private data if shared.
- Backup restoration still requires explicit confirmation before replacing local state and validates data as in Phase 4; the local unread notification inbox, preferences and known public-offer IDs are included in backups.
- The app retains the same \`pr-hunter-state-v1\` storage key and maintains offline caching of all new JavaScript modules.

### Deferred until the user configures a private backend

- **Automatic cloud synchronization** across multiple devices (requires account authentication, private database, encrypted transport and a credential-handling backend).
- **Web Push when the PWA is closed** (requires Push API subscription with user gesture, server-side push delivery, and service-worker push notification handling). Supported by iPadOS Home Screen PWAs; this implementation deliberately does not claim to provide it.
- Automatically detecting Instagram winnings, replies, DMs or auto-entering other people's giveaways. An authorized, supported provider integration must be separately configured.

Apple Web Push information: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ and https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers


## Phase 7 — iPad Ultimate-Finish (2026-11)

- **Performance:** the discovery feed and personal saved list render only 18 cards initially and progressively load more on demand (up to the configured 1000 local limit). Search rebuilds are debounced by 120 ms, lowering repeated layout work when typing on iPad.
- **Motion & iPad usability:** smoother entry/hover animations, card interactions and responsive touch targets (~44 CSS px or more). Optional **System / Lebendig / Reduziert** modes under Link-Inbox settings. iPadOS **Reduce Motion** always takes priority. Narrower screens use horizontally scrollable bottom navigation.
- **Verification clarity:** badges distinguish unverified manually imported posts/RSS hints from manually reviewed organizer rules. Unknown delivery costs, source legitimacy or shipping are flagged and no product-quality or win-rate guarantees are made. Users still must verify each original organizer's conditions.
- **Accessibility:** skip-to-content link, keyboard focus outlines, reduced-motion fallback, connectivity status, visible result counts and accessible modal behavior.
- **Offline reliability:** versioned app-shell cache v10, network-first navigation with cached fallback, offline-friendly public catalog, only PR-Hunter-owned caches are removed on upgrades. Local data and encrypted exports are not cached in the public service worker.
- **Data portability:** the selected motion mode travels in locally exported encrypted/plaintext backups and is sanitized during restore. The existing \`pr-hunter-state-v1\` key remains unchanged.

### Still requires separate infrastructure

This is a complete *local and publicly hosted iPad UX polish iteration*, **not** the end of all Ultimate ambitions. Automatic private cloud sync and true background Web Push require a secure backend; approved Meta account connections need explicit authorization. Instagram does not permit generic mass commenting or auto-following on arbitrary third-party Reels. Final hardware acceptance requires opening Phase 7 in Safari/Home Screen on a real iPad, testing touch, screen rotation, saved state, reduced motion and import/export. CI validates source logic and static page structure, not an actual Safari WebKit device.


## Phase 8 – Auto-Hunter for websites (no Instagram or TikTok bots)

**Goal:** maximize the amount of useful work done unattended while *not* fabricating entries or violating organizer conditions.

### Works automatically now

- Existing GitHub Actions scans supported public RSS/Atom sources every six hours. A new \`npm run auto-scan\` stage produces the **public \`docs/auto-hunter.json\` report** from that scan. This contains **only public offer metadata**, never user names, contact details or entry credentials.
- The new **Auto-Hunter** iPad tab automatically ranks website opportunities, prioritizes fashion, optionally includes technology, excludes social media and expired contests, and separates hard exclusions from offers with missing rules, Germany shipping or costs.
- The engine does not turn missing data into claims. "0 € purchase", "keep the prize", Germany eligibility, shipping ≤ €5, a recent review of terms and **explicit organizer permission for automated entries** are all independently required.
- The local user dashboard can filter and open each item's **original website** and existing participation checklist; it never submits or marks participation on its own.
- Auto-Hunter preferences are device-local and travel with encrypted or plaintext backups.

### Private-server entry adapter — prepared but not configured

\`scripts/allowed-entry-runner.mjs\` provides a guarded integration point. It **only** sends entries if:
1. The organizer explicitly allows scripts/automatic entry, evidenced by a recent official rules URL.
2. The user has specifically opted in and identity/one-entry-per-person conditions are checked.
3. A reviewed **official provider API** adapter exists on the same host as the organizer, with authenticated, documented permissions.
4. Purchase-free participation, permanent prize ownership, Germany delivery, shipping ≤ €5 and a valid deadline are confirmed.
5. A private transactional receipt store atomically prevents repeat entries. Only a real provider receipt is recorded as submitted; unknown network outcomes are not retried blindly.

There are **zero approved live provider adapters** currently. The public GitHub Pages site cannot securely keep form credentials, run background browser automation on third-party websites or receive reliable API receipts. It is **not** a working auto-entry bot yet. We will need an expressly cooperating giveaway provider with a participant submission API, a private backend and user-authorized identity to make real unattended entries possible. This is particularly important because many German organizers expressly exclude contest bots and multi-account entries, including REWE Produkttests (https://produkttests.rewe.de/teilnahmebedingungen) and RTL (https://www.rtl.de/cms/service/gewinnspielbeschreibung-id30316485.html).

Never put participant PII, session cookies, provider passwords or API tokens into GitHub source code, static Pages, public Actions logs or the generated public report. Do not bypass CAPTCHAs or automate entries where the organizer prohibits it.


## Phase 9 – Free-Product-Hunter

PR-Hunter now tracks **three independent routes** to products:

1. **Website product-testing platforms:** trnd, Influenster and ForMe. These are *program portals*, not guaranteed product shipments. Application and eligibility are provider-specific. For trnd, the product may sometimes have to be returned; for ForMe the featured test-products may be kept subject to campaign rules.
2. **Fashion / Streetwear Creator programs:** SEAME, HUMBLE ORIGINAL, YFM and HEY MARLY. Each has an official first-party application/program URL, an evidence review date, explicit social/age/follower requirements when stated, and a prominent warning that a collaboration is **not guaranteed**. For new creators, programs stating no minimum follower requirement are prioritized over programs requiring 1,000–2,000 followers.
3. **Existing RSS / curated giveaway leads:** automatically classified from the public scanner's actual, time-filtered catalog. A product testing article is not conflated with a creator deal or a promised shipment.

### What is automated

- GitHub Actions continues to scan public RSS sources every 6 hours and now generates a dedicated public \`docs/free-products-report.json\` beside \`docs/auto-hunter.json\`. Directory records are reviewed **on their stated check dates**: regenerating the report **does not** claim a new live check of a brand's website.
- The iPad **Free Products** screen prioritizes fashion and presents official program links, stated follower requirements, content obligations, keeping/return rules, and costs/shipping that require verification.
- Dynamic offer classification distinguishes tests, creator programs and giveaways. It never converts a directory entry into a confirmed currently open campaign.
- An optional manual outreach text can be copied and edited; it makes no fabricated promises about followers, views or creator experience and is **never sent automatically**.
- Program progress is only user-reported: Interested / Applied / Accepted / Received / Rejected. The totals show these as **self-reported**, not as provider-verified events.
- Program progress and category preferences are encrypted along with existing local data in the prior passphrase-protected backup workflow; \`pr-hunter-state-v1\` remains unchanged.

### Limitations and compliance

No automatic signing up to third-party portals, logging in, submitting personal surveys, mass messaging brands, Instagram/TikTok engagement automation, or claiming products. The user must complete provider onboarding and applications and satisfy eligibility, age, any content-labeling requirements, and campaign-specific return / shipping terms. For example, HEY MARLY states **18+**; YFM requires at least 2,000 followers, HUMBLE roughly 1,000 followers. No unverified shipping or ownership claim is silently treated as qualified.

The official directory is an independently reviewed list, not a list of guaranteed offers. Providers may change terms or close applications; read the original before submitting. Only 7 programs were added initially; 90/10 fashion-vs-tech is a **ranking preference**, not an invented distribution of real active offers.

Official sources: 
- https://de.seame-brand.com/pages/ambassador
- https://www.humbleoriginal.com/de/pages/brand-ambassador-werden
- https://youngfashionmind.de/pages/brand-ambassador
- https://www.heymarly.com/pages/anmeldung-ambassador-programm
- https://www.trnd.com/de/ueber-trnd/faq
- https://www.influenster.com/de
- https://www.for-me-online.de/testen-und-gewinnen

Physical iPad Safari behavior and sign-in workflows at each provider are not included in CI and require separate user acceptance; real automatic submission remains gated by documented provider permission, secure hosting and identity verification.
