"""Turn a run into the pull-request description (or issue body) you read on your phone."""
from __future__ import annotations

from .triage import counts

ICON = {"P0": "🔴 P0", "P1": "🟠 P1", "P2": "🟡 P2", "P3": "⚪ P3"}


def _cell(s, n=140):
    s = str(s or "").replace("|", "\\|").replace("\n", " ")
    return s if len(s) <= n else s[: n - 1] + "…"


def build(*, today, mode, results, findings, brief_notes, fetch_log, budget, usage, aborted=None) -> tuple[str, str]:
    c = counts(findings)
    changed = sum(len(r.changes) for r in results if r.status == "updated")
    title = (f"SUPAG {today.isoformat()}: {changed} value(s) refreshed"
             + (f", {c['P0']} P0" if c["P0"] else "") + (f", {c['P1']} P1" if c["P1"] else ""))
    L = [f"## SUPAG weekly run — {today.isoformat()}" + (" (dry run)" if mode == "dry-run" else ""), ""]
    if aborted:
        L += [f"> **Run stopped:** {aborted}", ""]
    if c["P0"]:
        L += ["> **Do not merge.** A P0 issue was found — see below.", ""]
    L += [f"**{changed} value(s) refreshed** · issues: {c['P0']} P0 · {c['P1']} P1 · {c['P2']} P2 · {c['P3']} P3", ""]

    L += ["### Data refreshed", ""]
    rows = [(r.family, ch) for r in results if r.status == "updated" for ch in r.changes]
    if rows:
        L += ["| Metric | Was | Now | Source | Evidence |", "|---|---|---|---|---|"]
        for fam, ch in rows:
            src = f"[link]({ch['url']})" if ch.get("url") else ""
            L.append(f"| {_cell(ch['metric'])} | {_cell(ch['old'], 60)} | **{_cell(ch['new'], 60)}** | {src} | {_cell(ch.get('quote'), 160)} |")
    else:
        L.append("Nothing new this week.")
    L.append("")

    L += ["### Sources this week", "", "| Family | Result | Detail |", "|---|---|---|"]
    for r in results:
        detail = "; ".join(r.rejected + r.notes) or "—"
        L.append(f"| {r.family} | {r.status} | {_cell(detail, 220)} |")
    L.append("")

    L += ["### Issues found, by priority", ""]
    shown = [f for f in findings if f.code != "refreshed"]
    if shown:
        for f in shown:
            L.append(f"- **{ICON[f.priority]}** {f.msg}" + (f" — _{f.fix}_" if f.fix else "") + (" ✅ fixed in this PR" if f.auto else ""))
    else:
        L.append("None.")
    L.append("")

    if brief_notes:
        L += ["### What changed this week (brief)", ""] + [f"- {n}" for n in brief_notes] + [""]

    ok = sum(1 for x in fetch_log if x["ok"])
    L += ["<details><summary>Guardrails and run log</summary>", "",
          f"- Pages read: {ok} ok / {len(fetch_log)} attempted — every one on the allowlist in `supag/sources.json`",
          f"- Model calls: {budget.llm_used} (tokens in {usage.get('input_tokens', 0):,} · out {usage.get('output_tokens', 0):,})",
          "- Every refreshed number was matched to a sentence on the cited page, and checked against sanity bounds",
          "- Files changed are limited to `dashboard/data/*.json` and `supag/runs/` — enforced before commit",
          "", "| URL | OK | Note |", "|---|---|---|"]
    for x in fetch_log:
        L.append(f"| {_cell(x['url'], 90)} | {'yes' if x['ok'] else 'no'} | {_cell(x['note'], 80)} |")
    L += ["", "</details>", "",
          "Merge to publish (live in about two minutes). Close to discard. "
          "To pause SUPAG, set the repository variable `SUPAG_ENABLED` to `false`."]
    return title, "\n".join(L)
