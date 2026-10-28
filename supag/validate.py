"""Validate dashboard/data/*.json. Used by every SUPAG run before publishing, and by the PR check on any
pull request that touches the data — including ones you make by hand."""
from __future__ import annotations

import datetime as dt
import json
import sys
from dataclasses import dataclass

from .config import DATA

FILES = ["meta", "payments", "lending", "wealthtech", "news", "insurance", "crypto", "funding", "publicmkts"]
TAB_IDS = {"payments", "lending", "wealthtech", "news", "insurance", "crypto", "funding", "publicmkts"}


@dataclass
class Issue:
    level: str          # error | warn
    code: str
    msg: str

    def __str__(self):
        return f"[{self.level}] {self.code}: {self.msg}"


def freshness_status(entry: dict, today: dt.date) -> str:
    """Same rule the page uses to colour its dots: ok, aging (a release is due), stale (overdue)."""
    age = (today - dt.date.fromisoformat(entry["asOf"])).days
    ok = entry["cadenceDays"] + entry.get("lagDays", 0)
    return "ok" if age <= ok else "aging" if age <= ok + entry["cadenceDays"] else "stale"


def validate(today: dt.date | None = None, data: dict | None = None) -> list[Issue]:
    today = today or dt.date.today()
    issues: list[Issue] = []
    E = lambda c, m: issues.append(Issue("error", c, m))
    W = lambda c, m: issues.append(Issue("warn", c, m))

    if data is None:
        data = {}
        for f in FILES:
            p = DATA / f"{f}.json"
            if not p.exists():
                E("missing-file", f"dashboard/data/{f}.json is missing"); continue
            try:
                data[f] = json.loads(p.read_text(encoding="utf-8"))
            except json.JSONDecodeError as e:
                E("bad-json", f"{f}.json does not parse: {e}")
    if any(i.level == "error" for i in issues):
        return issues

    meta, pay = data["meta"], data["payments"]["pay"]

    # meta
    for k in ("lastUpdated", "lastUpdatedISO", "tabs", "freshness"):
        if k not in meta: E("meta", f"meta.json lacks '{k}'")
    try:
        lu = dt.date.fromisoformat(meta.get("lastUpdatedISO", ""))
        if lu > today: E("meta-date", "lastUpdatedISO is in the future")
        elif (today - lu).days > 14: W("not-updated", f"dashboard last updated {(today - lu).days} days ago")
    except ValueError:
        E("meta-date", "lastUpdatedISO is not YYYY-MM-DD")
    for t in meta.get("tabs", []):
        if t.get("id") not in TAB_IDS: E("tab", f"unknown tab id {t.get('id')}")
        for s in t.get("srcs", []):
            if not (isinstance(s, list) and len(s) == 2 and str(s[1]).startswith("https://")):
                E("source", f"tab {t.get('id')}: malformed source {s}")
    for tab, entries in meta.get("freshness", {}).items():
        for e in entries:
            try:
                st = freshness_status(e, today)
            except Exception:
                E("freshness", f"{tab}/{e.get('label')}: bad asOf/cadence"); continue
            if dt.date.fromisoformat(e["asOf"]) > today: E("freshness", f"{tab}/{e['label']} asOf is in the future")
            if st == "stale": W("stale", f"{tab} · {e['label']} as of {e['shown']} is overdue")
            elif st == "aging": W("aging", f"{tab} · {e['label']} as of {e['shown']} — a newer release is due")
    if "brief" in meta:
        for it in meta["brief"].get("items", []):
            if it.get("tab") not in TAB_IDS or not it.get("text"): E("brief", "brief item malformed")

    # tiles everywhere
    for f in ("payments", "lending", "wealthtech"):
        tiles = data[f]["tiles"]
        if not tiles: E("tiles", f"{f} has no tiles")
        if sum(1 for t in tiles if t.get("hero")) > 3: E("tiles", f"{f} has more than 3 headline tiles")
        for t in tiles:
            if not t.get("l") or not str(t.get("v", "")).strip(): E("tiles", f"{f}: a tile lacks a label or value")
            if t.get("dir") not in (None, "up", "down"): E("tiles", f"{f}: bad dir {t.get('dir')}")

    # payments series
    vol, val = pay.get("vol", []), pay.get("val", [])
    if len(vol) != len(val): E("series", f"UPI volume has {len(vol)} months but value has {len(val)}")
    if not all(isinstance(x, (int, float)) and x > 0 for x in vol + val): E("series", "UPI series has non-positive or non-numeric points")
    if len(vol) >= 13:
        mom, yoy = vol[-1] / vol[-2] - 1, vol[-1] / vol[-13] - 1
        if abs(mom) > 0.15: E("bounds", f"latest UPI volume moved {mom:+.1%} MoM — outside ±15%")
        if not -0.05 <= yoy <= 0.6: E("bounds", f"latest UPI volume YoY {yoy:+.1%} is implausible")
    anchors = pay.get("shareAnchors", [])
    if [a[0] for a in anchors] != sorted(a[0] for a in anchors): E("anchors", "share anchors are out of order")
    for a in anchors:
        if not (0 < a[1] < 100 and 0 < a[2] < 100 and a[1] + a[2] < 100): E("anchors", f"share anchor {a} is impossible")
    s = sum(a["volPct"] for a in pay.get("apps", []))
    if not 97 <= s <= 103: E("apps", f"app shares sum to {s:.1f}%")

    # news
    items = data["news"].get("items", [])
    if not items: E("news", "no news items")
    for it in items:
        if not (isinstance(it, list) and len(it) == 5 and str(it[4]).startswith("https://")):
            E("news", f"malformed news row {str(it)[:80]}")
    if len({it[4] for it in items if isinstance(it, list) and len(it) == 5}) != len(items):
        E("news", "duplicate news URLs")

    # tables with fixed columns
    for name, rows, n in (("merchants", pay.get("merchants", []), 8), ("fundingRounds", pay.get("fundingRounds", []), 14),
                          ("hirings", pay.get("hirings", []), 12), ("banks", data["lending"].get("banks", []), 10)):
        for r in rows:
            if len(r) != n: E("columns", f"{name}: a row has {len(r)} columns, expected {n}")
    return issues


def main() -> int:
    issues = validate()
    for i in issues: print(i)
    errors = [i for i in issues if i.level == "error"]
    print(f"\n{len(errors)} errors, {len(issues) - len(errors)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
