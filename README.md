# PR-Hunter 🎁

**PR-Hunter** is an open-source, iPad-first progressive web app for discovering and tracking public product-testing, giveaway, and brand-collaboration opportunities.

**Status: v0.1 MVP.** The dashboard and scheduled public-feed scanner are implemented. No Instagram account is connected, no real application is submitted, and no products are guaranteed.

## Features

- Responsive, touch-friendly German dashboard, installable from Safari as a PWA
- Discover, filter, bookmark and manually add offers
- Track each offer: saved, contacted, accepted or received
- Prepare and copy a personal application draft (you decide whether to send it)
- Import publicly available RSS/Atom opportunities with a GitHub Actions job every six hours
- Local-only personal tracking data in the browser; no API keys or passwords required

## Start locally

Requires Node.js 22 or later. No third-party packages are needed.

\`\`\`sh
npm run dev
\`\`\`

Open http://localhost:4173 on your computer. Run \`npm test\` for scanner tests.

## Enable automated discovery

1. Edit \`config/sources.json\` and add publicly accessible **HTTPS RSS or Atom feeds** that explicitly permit automated access, e.g. \`{"name":"My allowed feed","url":"https://example.org/feed.xml"}\`.
2. Commit that configuration to your branch. **Do not put authentication tokens or private feed URLs in this public repository.**
3. GitHub Actions → **PR-Hunter public feed scan** → **Run workflow**. It also runs every six hours. The workflow requires Actions **read/write** repository contents permission to commit updated \`docs/opportunities.json\`.
4. The collector filters for relevant giveaway, product-testing and collaboration terms. Its matches are suggestions, not verified free-product entitlements. Always read each source's terms.

With no configured feeds, the dashboard begins empty; use **Angebot hinzufügen** to track a public offer manually. Its data stays on that device. The automated scanner is working but cannot discover offers until you configure legitimate sources.

## Put it on iPad

In GitHub Settings → Pages, select **Deploy from a branch**, branch \`main\`, folder \`/docs\` after merging the PR. Then visit the GitHub Pages URL in iPad Safari → Share → Add to Home Screen. The repository being public **does not automatically mean Pages is enabled**.

## Scope and safety

This is **not** an Instagram DM spam bot. Meta's official messaging capabilities do not grant permission to send unsolicited messages to arbitrary accounts. PR-Hunter intentionally does not scrape Instagram, impersonate people, mass-message brands, or auto-fill protected forms. A future application integration requires an official supported endpoint, consent from the receiving service, and explicit opt-in. There is currently **no automatic sending**.

This repo is public. Never commit addresses, account credentials, API secrets, private contact details, or personal application responses. Browser data is local to the current device, and clearing Safari storage removes it. GitHub Pages will make the public opportunity catalog readable by everyone.

MIT licensed. This app is independent and not affiliated with Instagram or Meta.
