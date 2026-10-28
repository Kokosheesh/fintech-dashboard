"""Prioritise. A fixed rubric, applied in code, so the ranking is predictable week to week:

  P0  the page is broken or a headline number is wrong      → publishing is blocked
  P1  stale or misleading, or a refresh failed               → fixed in this PR where SUPAG can
  P2  degraded: links, preview tags, mobile, aging data      → fixed if safe, otherwise proposed
  P3  cosmetic or informational                              → batched
"""
from __future__ import annotations

from .scan import Finding
from .validate import Issue

ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}


def from_validation(issues: list[Issue]) -> list[Finding]:
    out = []
    for i in issues:
        if i.level == "error":
            out.append(Finding("P0", "validation", i.msg, "Fix the data file before publishing."))
    return out


def from_families(results) -> list[Finding]:
    out = []
    for r in results:
        if r.status == "failed":
            why = "; ".join(r.rejected or r.notes) or "unknown"
            out.append(Finding("P1", "refresh-failed", f"{r.family}: couldn't refresh — {why}",
                               "Check the source by hand; SUPAG kept the previous figure."))
        for w in r.warnings:
            out.append(Finding("P1", "suspicious-source", f"{r.family}: a fetched page tried to instruct the agent — {w[:160]}",
                               "Ignored by SUPAG. Consider removing that source from the allowlist."))
        if r.status == "updated":
            out.append(Finding("P3", "refreshed", f"{r.family}: {len(r.changes)} value(s) refreshed", "", auto=True))
    return out


def triage(findings: list[Finding]) -> list[Finding]:
    seen, out = set(), []
    for f in sorted(findings, key=lambda f: (ORDER[f.priority], f.code, f.msg)):
        key = (f.code, f.msg)
        if key in seen: continue
        seen.add(key); out.append(f)
    return out


def counts(findings: list[Finding]) -> dict:
    c = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for f in findings: c[f.priority] += 1
    return c
