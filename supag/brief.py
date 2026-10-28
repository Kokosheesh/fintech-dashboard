"""Draft the "What changed this week" block from this run's verified changes. The draft lands in the PR for
you to edit; every number in it must already appear in the verified changes, or that item is dropped."""
from __future__ import annotations

from .verify import numbers_grounded

TAB_OF = {"upi_monthly": "payments", "upi_app_share": "payments", "hirings": "payments",
          "rbi_credit": "lending", "rbi_policy": "lending", "amfi_monthly": "wealthtech"}
TAG_OF = {"payments": "Payments", "lending": "Lending", "wealthtech": "Wealth"}


class _Doc:
    def __init__(self, url, text): self.url, self.text = url, text


def draft(llm, results, meta: dict, today) -> list[str]:
    """Update meta['brief'] in place. Returns notes for the report."""
    by_tab: dict[str, list[dict]] = {}
    for r in results:
        tab = TAB_OF.get(r.family)
        if r.status == "updated" and tab:
            by_tab.setdefault(tab, []).extend(r.changes)
    if not by_tab:
        return ["No verified changes this week, so the brief was left as it was."]
    evidence = "\n".join(f"[{tab}] {c['metric']}: {c['old']} → {c['new']}. Source sentence: {c.get('quote','')}"
                         for tab, cs in by_tab.items() for c in cs)
    old = {i["tab"]: i for i in meta.get("brief", {}).get("items", [])}
    ans = llm.ask_json(
        "Write the 'What changed this week' brief for an India fintech dashboard read by fintech recruiters and "
        "operators. One item per tab listed in the evidence, each 2–3 sentences, under 420 characters: lead with "
        "what moved and why it matters, plainly and without hype. Use only numbers that appear in the evidence. "
        "For reference, last week's items were:\n" + "\n".join(f"- {i['tab']}: {i['text']}" for i in old.values()),
        [_Doc("evidence", evidence)],
        '{"items": [{"tab": "payments|lending|wealthtech", "text": str}], "warnings": [str]}')
    notes, done = [], []
    for it in ans.get("items", []):
        tab, text = it.get("tab"), (it.get("text") or "").strip()
        if tab not in by_tab or not text or len(text) > 480:
            notes.append(f"brief item for {tab} dropped (off-topic or too long)"); continue
        missing = numbers_grounded(text, evidence + " " + " ".join(c["metric"] for cs in by_tab.values() for c in cs))
        if missing:
            notes.append(f"brief item for {tab} dropped — numbers not in the evidence: {', '.join(missing)}"); continue
        old[tab] = {"tab": tab, "tag": TAG_OF[tab], "text": text}; done.append(tab)
    order = ["payments", "lending", "wealthtech"]
    if done:
        meta["brief"] = {"asOf": f"{today.day} {today.strftime('%b')} {today.year}",
                         "items": [old[t] for t in order if t in old]}
        notes.append("Brief redrafted for: " + ", ".join(done) + " — edit freely in the PR before merging.")
    else:
        notes.append("No brief item passed the checks, so last week's brief was kept. Worth rewriting by hand.")
    return notes
