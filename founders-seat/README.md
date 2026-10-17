# Founder's Seat

A grand-strategy simulation where MBA students, future founders, founder's office and strategy professionals run a post-seed startup for 36 months from a single command dashboard.

**Live: https://fintech.pelicanx.in/founders-seat/**

Everything for the game lives in this folder. GitHub Pages serves it as part of fintech.pelicanx.in, and the site's `build.py` never touches it. There is no build step.

## Layout
| Path | What it is |
|---|---|
| `index.html` | Landing page: waitlist, pricing, PLAY NOW |
| `play/` | The game |
| `admin/` | Owner dashboard: sign-ups, daily logins, games, payments, free-access list |
| `terms/`, `privacy/`, `refunds/`, `contact/` | Policy pages (PhonePe requires these) |
| `supabase/schema.sql` | Tables, row-level security and stats for players, logins and games |
| `supabase/v3_paywall.sql` | Trial, paywall, payments, free-access grants, owner tools |
| `supabase/functions/phonepe/index.ts` | Edge function for PhonePe checkout, status checks and the webhook |
| `Code.gs` | Google Apps Script behind the landing-page waitlist form |

### Game files (`play/`)
- `engine.js`: core simulation.
- `systems.js`: growth channels, experiments, the feature library, operations, partners, enterprise deals, crises, goals, and the P&L, cash-flow and MIS reports.
- `auth.js`: email and Google sign-in, play tracking, the 7-day trial and the ₹269 unlock.
- `ui.js`, `ui2.js`: the interface.
- `simple.js`: the Simple view, which keeps only key numbers visible and folds the rest behind a click.
- `fx.js`: celebration and alert graphics, synthesised sounds, and the mute button.

## Back end (Supabase project `xxdxuuqmftxufvnkkuif`)
- Run `supabase/schema.sql`, then `supabase/v3_paywall.sql`, in the SQL editor. Both are safe to re-run.
- Deploy `supabase/functions/phonepe` as a function named `phonepe` with "Verify JWT" off. The pay and status routes check the player's token themselves, and PhonePe's webhook does not send a Supabase token. The secrets it needs are listed at the top of the file.
- Auth: email and password with "Confirm email" off, plus Google. Google sign-in uses the "Founders Seat" Google Cloud project, which is published to production.
- The Site URL is `https://fintech.pelicanx.in/founders-seat/play/`. Redirect URLs allow `https://fintech.pelicanx.in/**`.

## Accounts, trial and payments
- Every new account gets 7 days of full access. After that, `my_access()` returns `expired` and the game shows the paywall.
- Paying creates a row in `payments`. The edge function marks it `COMPLETED` only after PhonePe's order-status API confirms the payment and the amount.
- Emails in `access_grants` skip the paywall (cohort licences, pilots). Manage them from `/admin/`.
- The owner email, price and trial length live in `app_settings`.
- The paywall is enforced in the browser, so a technical user could bypass it by editing the JavaScript. Real enforcement would need the game served from behind a server.

## Stats
`/admin/` shows sign-ups, logins per day, games, paid players, revenue and free-access emails. Only the owner email in `app_settings` can load it. The raw tables are in the Supabase Table Editor: `players`, `logins`, `games`, `payments`, `access_grants`, and the `daily_stats` view.

## Waitlist
The landing-page form posts to an Apps Script web app (`Code.gs`), which writes one row per email to the `Waitlist` tab of the Sheet and ignores duplicates. To redeploy, paste `Code.gs` into the Apps Script project, then use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.

## History
The project started in the separate `Kokosheesh/founders-seat` repo, whose commit history still has the earlier versions. That repo now only redirects kokosheesh.github.io/founders-seat to this site.
