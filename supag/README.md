# SUPAG — the dashboard's weekly update-and-repair agent

Every Monday at 06:00 IST, SUPAG:

1. **Refreshes** the dashboard's figures from approved sources (NPCI, RBI, AMFI, StartupFox, job boards).
2. **Checks** the page in a real browser: does it load, do all charts draw, do links work, is anything stale,
   does it fit a phone, are the link-preview tags there.
3. **Ranks** what it found, P0 to P3.
4. **Fixes** what is safe to fix (the data), and lists the rest.
5. **Opens a pull request** with every change, its source, and the sentence each number came from.
   You merge it (live about two minutes later) or close it. Nothing reaches the site without your merge.

If there's nothing to update, the report goes to a standing GitHub issue labelled `supag-health` instead.

## One-time setup (about five minutes)

1. **API key.** Create a key at platform.claude.com. In the repo: *Settings → Secrets and variables →
   Actions → New repository secret*, name `ANTHROPIC_API_KEY`. It's billed to that API account, separately
   from a Claude subscription. Expect cents per run: a run is about ten model calls on Sonnet.
2. **Let Actions open pull requests.** *Settings → Actions → General → Workflow permissions* → tick
   **Allow GitHub Actions to create and approve pull requests**.
3. **First run, as a dry run.** *Actions → SUPAG weekly update → Run workflow* → mode `dry-run`. Read the report
   on the run page. Nothing is committed. When it looks right, run it once with mode `run`.

Optional repository variables (*Settings → Secrets and variables → Actions → Variables*):

| Variable | Effect |
|---|---|
| `SUPAG_ENABLED` | `false` pauses every scheduled run. Delete it, or set `true`, to resume. |
| `SUPAG_MODEL` | Claude model ID. Default `claude-sonnet-5-5`. |

## What it covers

| Family | Source | Updates | When it looks |
|---|---|---|---|
| `upi_monthly` | NPCI product statistics; StartupFox, MediaNama as fallback | UPI volume and value series, two headline tiles | from the 2nd of each month |
| `upi_app_share` | NPCI ecosystem statistics; MediaNama | PhonePe, Google Pay, Paytm shares; duopoly tile | from the 18th |
| `amfi_monthly` | AMFI monthly note | MF AUM and SIP tiles | from the 12th |
| `rbi_credit` | RBI press releases | credit growth and the credit–deposit gap | every ~2 weeks |
| `rbi_policy` | RBI press releases | repo rate, stance, GDP/CPI projections, timeline | after each MPC |
| `news` | StartupFox fintech listing | up to 8 new stories, own-words headlines | weekly |
| `hirings` | Greenhouse job-board APIs (Razorpay, Groww) | open roles by function — keyword rules, no AI | weekly |

**Not automated yet:** share prices and P/E (13 Jul), funding rounds, company financials, microfinance,
broker clients. The page flags them amber or red when they go stale, and so does SUPAG's report. PhonePe's
job board isn't on a public API, so that row stays manual.

Every fetched page, every model call and every figure lands in `supag/runs/YYYY-MM-DD.json`.

## Guardrails (all enforced in code, all tested in `supag/tests/`)

| Guardrail | What it stops |
|---|---|
| **Source allowlist** — `sources.json`; exact host, https only; every redirect hop checked | reading anything outside the approved sources |
| **Untrusted-content fence** — fetched text is wrapped as data and the model is told never to follow it; a page that tries is reported as P1 | prompt injection from a web page |
| **Evidence check** — every number must come with the exact sentence it appeared in; code confirms the sentence is on that page and the number is in that sentence | invented or rounded numbers |
| **Right-period check** — the month has to be named in or just before the quoted sentence | last month's figure passed off as this month's |
| **Sanity bounds** — e.g. UPI volume within ±15% MoM; app shares can't jump more than 3 pp | misreads and unit errors; held for you instead |
| **Own-words check** — every number in a news line or the weekly brief must appear in the source | the AI embellishing |
| **Atomic families** — a family either updates completely or not at all | half-written data |
| **Validation gate** — schema, column counts, series lengths, bounds; any failure restores all data | publishing a broken file |
| **Write scope** — a run may only change `dashboard/data/*.json` and `supag/runs/`; anything else aborts the run | the agent touching code, workflows or the page |
| **Budget ceiling** — at most 40 fetches and 10 model calls per run | runaway cost |
| **Human merge** — SUPAG opens a PR, never pushes to `main` | anything going live unseen |
| **Smoke test + auto-revert PR** — after a merge, the live page is re-tested; if it's broken, a revert PR is opened at once | a bad deploy staying up |
| **Kill switch** — `SUPAG_ENABLED=false`, or a file named `supag/PAUSE` | — |
| **No personal tokens** — runs on the workflow's own short-lived `GITHUB_TOKEN`; the only secret is the API key | a leaked token with power over your account |

## Running it yourself

```bash
pip install -r supag/requirements.txt && python -m playwright install chromium
python -m pytest supag/tests -q            # 20 tests, no network or key needed
python -m supag.validate                   # check the data files
python -m supag.run --mode scan            # browser health check of your working copy
ANTHROPIC_API_KEY=... python -m supag.run --mode dry-run   # full run, then puts everything back
```

## Workflows

| File | When | Does |
|---|---|---|
| `.github/workflows/supag.yml` | Mondays 06:00 IST; manual; `repository_dispatch` | the weekly run → PR or health issue |
| `.github/workflows/supag-check.yml` | any PR touching the dashboard or SUPAG | tests + validation + browser check; blocks on P0 |
| `.github/workflows/supag-smoke.yml` | after a dashboard change reaches `main` | waits for Pages, tests the live page, opens a revert PR if broken |

## Talking to SUPAG from chat (planned)

`supag.yml` already accepts `repository_dispatch` events of type `supag-command`, with
`client_payload.command` one of `run`, `dry-run`, `scan`, `status`. Anything else is refused. A chat front
end — WhatsApp through Meta's Cloud API, or Telegram — would sit in n8n: it checks the message came from
your number, maps the message to one of those commands, triggers the workflow, and posts the report back.
Chat can trigger runs; it can't edit data or change code. Merging stays in GitHub.
