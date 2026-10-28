"""One function per data family: collect pages → ask the model → verify every figure → check bounds →
apply in deterministic code. The model never writes to a file; it only proposes figures with evidence."""
from __future__ import annotations

import calendar
import copy
import datetime as dt
import re
from dataclasses import dataclass, field

from .config import host_allowed, read_json
from .guard import GuardError
from .verify import norm, numbers_grounded, quote_in_document, verify_figure

MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
        "October", "November", "December"]


# ───────────────────────────── shared helpers ─────────────────────────────
@dataclass
class Result:
    family: str
    status: str = "skipped"            # updated | no-new-data | not-due | failed | skipped
    changes: list = field(default_factory=list)    # {metric, old, new, url, quote}
    rejected: list = field(default_factory=list)   # reasons a proposed figure was refused
    notes: list = field(default_factory=list)
    warnings: list = field(default_factory=list)   # e.g. a page that tried to instruct the model


def mlabel(y: int, m: int) -> str:            # (2026, 9) -> "Sep'26"
    return f"{MON[m-1]}'{str(y)[2:]}"


def parse_mlabel(s: str) -> tuple[int, int]:  # "Sep'26" -> (2026, 9)
    mo, yy = re.match(r"([A-Z][a-z]{2})'(\d{2})", s.strip()).groups()
    return 2000 + int(yy), MON.index(mo) + 1


def next_month(y: int, m: int) -> tuple[int, int]:
    return (y + 1, 1) if m == 12 else (y, m + 1)


def month_end(y: int, m: int) -> dt.date:
    return dt.date(y, m, calendar.monthrange(y, m)[1])


def due(y: int, m: int, today: dt.date, release_day: int) -> bool:
    """A month's figure is due once its release day in the following month has passed."""
    ny, nm = next_month(y, m)
    return today >= dt.date(ny, nm, min(release_day, 28))


def month_near_quote(doc: str, quote: str, y: int, m: int) -> bool:
    """The month must be named in, or just before, the quoted sentence — so last month's figure can't slip in."""
    d, q = norm(doc), norm(quote)
    i = d.find(q) if q in d else -1
    window = d[max(0, i - 500): i + len(q) + 80] if i >= 0 else q
    names = [FULL[m-1].lower(), MON[m-1].lower() + "'" + str(y)[2:], MON[m-1].lower() + " " + str(y),
             MON[m-1].lower() + "-" + str(y)[2:], MON[m-1].lower() + "-" + str(y)]
    return any(n in window for n in names)


def find_tile(tiles: list, label_prefix: str) -> dict:
    for t in tiles:
        if t["l"].lower().startswith(label_prefix.lower()):
            return t
    raise GuardError(f"tile '{label_prefix}' not found — the data layout changed; refusing to guess")


def set_fresh(meta: dict, tab: str, label: str, as_of: dt.date, shown: str) -> None:
    for f in meta["freshness"][tab]:
        if f["label"] == label:
            f["asOf"], f["shown"] = as_of.isoformat(), shown
            return
    raise GuardError(f"freshness entry '{tab}/{label}' missing")


def set_source(meta: dict, tab: str, prefix: str, label: str, url: str) -> None:
    """Keep each tab's source list pointing at the page the latest figure actually came from."""
    for t in meta["tabs"]:
        if t["id"] == tab:
            t["srcs"] = [s for s in t["srcs"] if not s[0].startswith(prefix)]
            t["srcs"].insert(0, [label, url])
            return


def collect(fetcher, fam: dict, res: Result) -> list:
    """Fetch the family's entry pages, then follow at most N allowlisted links whose text matches."""
    docs, seen = [], set()
    pat = re.compile(fam.get("follow", r"$^"), re.I)
    for url in fam["entry"]:
        try:
            d = fetcher.get(url); docs.append(d); seen.add(url)
        except GuardError:
            raise
        except Exception as e:
            res.notes.append(f"could not read {url}: {str(e)[:120]}")
            continue
        picked = 0
        for text, href in d.links:
            if picked >= fam.get("maxFollow", 4): break
            href = href.split("#")[0]
            if href in seen or not pat.search(text + " " + href): continue
            if not host_allowed(href, fetcher.allowed): continue
            try:
                docs.append(fetcher.get(href)); seen.add(href); picked += 1
            except GuardError:
                raise
            except Exception as e:
                res.notes.append(f"could not read {href}: {str(e)[:120]}")
    if not docs:
        raise RuntimeError("none of the approved sources could be read this week")
    return docs


def ground(res: Result, docs: dict, metric: str, value, quote: str, url: str) -> bool:
    why = verify_figure(value, quote or "", url or "", docs)
    if why:
        res.rejected.append(f"{metric}: {why}")
        return False
    return True


def within(res: Result, metric: str, value: float, lo: float, hi: float) -> bool:
    if lo <= value <= hi:
        return True
    res.rejected.append(f"{metric}: {value} is outside the sanity bounds [{lo}, {hi}] — held for a human")
    return False


def pct(a: float, b: float) -> float:
    return (a / b - 1) * 100


def signed(x: float, nd=1, unit="%") -> str:
    s = f"{abs(x):.{nd}f}{unit}"
    return ("+" if x >= 0 else "−") + s


# ───────────────────────────── UPI monthly totals ─────────────────────────────
def upi_monthly(ctx, fam) -> Result:
    res = Result("upi_monthly")
    pay = ctx.data["payments.json"]["pay"]
    y, m = next_month(*parse_mlabel(pay["latest"]["m"]))
    if not due(y, m, ctx.today, fam.get("releaseDay", 2)):
        res.status = "not-due"; res.notes.append(f"{FULL[m-1]} {y} figures are not out yet"); return res
    docs = collect(ctx.fetcher, fam, res)
    by_url = {d.url: d.text for d in docs}
    ans = ctx.llm.ask_json(
        f"Find India's total UPI transaction volume and total UPI transaction value for the full month of "
        f"{FULL[m-1]} {y}. Not a daily average, not a year-to-date figure, not a single app's figure. "
        f"Volume is usually given in billion transactions; value in lakh crore rupees. Report volume in "
        f"billions and value in lakh crore exactly as printed; if printed in other units, set found to false.",
        docs,
        '{"found": bool, "volume_bn": number|null, "volume_quote": str, "volume_url": str, '
        '"value_lakh_cr": number|null, "value_quote": str, "value_url": str, "warnings": [str]}')
    res.warnings += ans.get("warnings") or []
    if not ans.get("found"):
        res.status = "no-new-data"; res.notes.append(f"no source yet states {FULL[m-1]} {y} UPI totals"); return res
    v, val = ans.get("volume_bn"), ans.get("value_lakh_cr")
    ok = (ground(res, by_url, "UPI volume", v, ans.get("volume_quote"), ans.get("volume_url")) and
          ground(res, by_url, "UPI value", val, ans.get("value_quote"), ans.get("value_url")))
    for k, q, u in (("UPI volume", ans.get("volume_quote"), ans.get("volume_url")),
                    ("UPI value", ans.get("value_quote"), ans.get("value_url"))):
        if ok and not month_near_quote(by_url[u], q, y, m):
            res.rejected.append(f"{k}: the quote isn't clearly about {FULL[m-1]} {y}"); ok = False
    if not ok:
        res.status = "failed"; return res
    v, val = float(v), float(val)
    vol_mom, val_mom = pct(v, pay["vol"][-1]), pct(val, pay["val"][-1])
    vol_yoy, val_yoy = pct(v, pay["vol"][-12]), pct(val, pay["val"][-12])
    b = fam["bounds"]
    if not (within(res, "UPI volume MoM %", vol_mom, *b["momPct"]) and within(res, "UPI value MoM %", val_mom, *b["momPct"])
            and within(res, "UPI volume YoY %", vol_yoy, *b["yoyPct"]) and within(res, "UPI value YoY %", val_yoy, *b["yoyPct"])):
        res.status = "failed"; return res

    p, meta, lab = ctx.data["payments.json"], ctx.data["meta.json"], mlabel(y, m)
    tv, tval = find_tile(p["tiles"], "UPI volume"), find_tile(p["tiles"], "UPI value")
    res.changes += [{"metric": f"UPI volume {lab}", "old": f"{tv['v']} ({tv.get('p','')})", "new": f"{v:.2f} B",
                     "url": ans["volume_url"], "quote": ans["volume_quote"]},
                    {"metric": f"UPI value {lab}", "old": f"{tval['v']} ({tval.get('p','')})", "new": f"₹{val:.2f} L cr",
                     "url": ans["value_url"], "quote": ans["value_quote"]}]
    pay["vol"].append(round(v, 2)); pay["val"].append(round(val, 2))
    pay["latest"] = {"m": lab, "volB": round(v, 2), "valL": round(val, 2)}
    tv.update({"p": lab, "v": f"{v:.2f} B", "chg": f"{signed(vol_yoy, 0)} YoY", "dir": "up" if vol_yoy >= 0 else "down",
               "d": f"{signed(vol_mom)} MoM ✓ NPCI"})
    tval.update({"p": lab, "v": f"₹{val:.2f} L cr", "chg": f"{signed(val_yoy, 0)} YoY", "dir": "up" if val_yoy >= 0 else "down",
                 "d": f"{signed(val_mom)} MoM ✓ NPCI"})
    set_fresh(meta, "payments", "UPI monthly", month_end(y, m), lab)
    set_source(meta, "payments", "UPI ", f"UPI {lab}", ans["volume_url"])
    res.status = "updated"
    return res


# ───────────────────────────── UPI app shares ─────────────────────────────
def upi_app_share(ctx, fam) -> Result:
    res = Result("upi_app_share")
    p = ctx.data["payments.json"]; pay = p["pay"]; meta = ctx.data["meta.json"]
    last_idx = pay["shareAnchors"][-1][0]
    y, m = 2021, 7
    for _ in range(last_idx): y, m = next_month(y, m)
    y, m = next_month(y, m); idx = last_idx + 1
    if not due(y, m, ctx.today, fam.get("releaseDay", 15)):
        res.status = "not-due"; res.notes.append(f"{FULL[m-1]} {y} app-wise data is not out yet"); return res
    docs = collect(ctx.fetcher, fam, res); by_url = {d.url: d.text for d in docs}
    ans = ctx.llm.ask_json(
        f"Find PhonePe's, Google Pay's and Paytm's share of UPI transaction VOLUME (percent) for {FULL[m-1]} {y}. "
        f"Only percentages that are printed; if a source gives transaction counts but no percentage, set found to false.",
        docs,
        '{"found": bool, "phonepe_pct": number|null, "phonepe_quote": str, "phonepe_url": str, '
        '"gpay_pct": number|null, "gpay_quote": str, "gpay_url": str, '
        '"paytm_pct": number|null, "paytm_quote": str, "paytm_url": str, "warnings": [str]}')
    res.warnings += ans.get("warnings") or []
    if not ans.get("found"):
        res.status = "no-new-data"; res.notes.append(f"no source yet prints {FULL[m-1]} {y} app shares"); return res
    pp, gp, pt = ans.get("phonepe_pct"), ans.get("gpay_pct"), ans.get("paytm_pct")
    ok = (ground(res, by_url, "PhonePe share", pp, ans.get("phonepe_quote"), ans.get("phonepe_url")) and
          ground(res, by_url, "Google Pay share", gp, ans.get("gpay_quote"), ans.get("gpay_url")))
    if ok and not month_near_quote(by_url[ans["phonepe_url"]], ans["phonepe_quote"], y, m):
        res.rejected.append(f"app shares: the quote isn't clearly about {FULL[m-1]} {y}"); ok = False
    if pt is not None and ok and not ground(res, by_url, "Paytm share", pt, ans.get("paytm_quote"), ans.get("paytm_url")):
        pt = None                                     # Paytm is optional; drop it, keep the rest
    if not ok:
        res.status = "failed"; return res
    pp, gp = float(pp), float(gp)
    prev_pp, prev_gp = pay["shareAnchors"][-1][1], pay["shareAnchors"][-1][2]
    b = fam["bounds"]
    if not (within(res, "PhonePe share %", pp, *b["phonepe"]) and within(res, "Google Pay share %", gp, *b["gpay"])
            and within(res, "PhonePe MoM pp", pp - prev_pp, -b["maxMovePp"], b["maxMovePp"])
            and within(res, "Google Pay MoM pp", gp - prev_gp, -b["maxMovePp"], b["maxMovePp"])):
        res.status = "failed"; return res
    lab = mlabel(y, m)
    duo, prev_duo = pp + gp, prev_pp + prev_gp
    tile = find_tile(p["tiles"], "PhonePe + Google Pay")
    res.changes.append({"metric": f"PhonePe + Google Pay share {lab}", "old": f"{tile['v']} ({tile.get('p','')})",
                        "new": f"{duo:.1f}%", "url": ans["phonepe_url"], "quote": ans["phonepe_quote"]})
    pay["shareAnchors"].append([idx, round(pp, 2), round(gp, 2)])
    apps = {a["n"]: a for a in pay["apps"]}
    apps["PhonePe"]["volPct"], apps["Google Pay"]["volPct"] = round(pp, 2), round(gp, 2)
    if pt is not None: apps["Paytm"]["volPct"] = round(float(pt), 2)
    apps["Others"]["volPct"] = round(100 - sum(a["volPct"] for a in pay["apps"] if a["n"] != "Others"), 1)
    tile.update({"p": lab, "v": f"{duo:.1f}%", "chg": f"{signed(duo - prev_duo, 1, ' pp')} MoM",
                 "dir": "down" if duo < prev_duo else "up", "d": f"{pp:.2f}% + {gp:.2f}% ✓ NPCI app-wise"})
    set_fresh(meta, "payments", "App shares", month_end(y, m), lab)
    set_source(meta, "payments", "UPI app shares", f"UPI app shares {lab}", ans["phonepe_url"])
    res.status = "updated"
    return res


# ───────────────────────────── AMFI monthly ─────────────────────────────
def _num(s: str) -> float:
    return float(re.search(r"\d[\d,]*(?:\.\d+)?", s).group().replace(",", ""))


def amfi_monthly(ctx, fam) -> Result:
    res = Result("amfi_monthly")
    w, meta = ctx.data["wealthtech.json"], ctx.data["meta.json"]
    aum_t, sip_t = find_tile(w["tiles"], "MF industry AUM"), find_tile(w["tiles"], "Monthly SIP")
    y, m = next_month(*parse_mlabel(aum_t["p"]))
    if not due(y, m, ctx.today, fam.get("releaseDay", 12)):
        res.status = "not-due"; res.notes.append(f"AMFI's {FULL[m-1]} {y} data is not out yet"); return res
    docs = collect(ctx.fetcher, fam, res); by_url = {d.url: d.text for d in docs}
    ans = ctx.llm.ask_json(
        f"From AMFI's data for {FULL[m-1]} {y}, find (a) the mutual fund industry's total average or month-end "
        f"assets under management in lakh crore rupees and (b) the month's total SIP contribution/inflow in crore rupees.",
        docs,
        '{"found": bool, "aum_lakh_cr": number|null, "aum_quote": str, "aum_url": str, '
        '"sip_cr": number|null, "sip_quote": str, "sip_url": str, "warnings": [str]}')
    res.warnings += ans.get("warnings") or []
    if not ans.get("found"):
        res.status = "no-new-data"; res.notes.append(f"AMFI {FULL[m-1]} {y} figures not found yet"); return res
    aum, sip = ans.get("aum_lakh_cr"), ans.get("sip_cr")
    ok = (ground(res, by_url, "MF AUM", aum, ans.get("aum_quote"), ans.get("aum_url")) and
          ground(res, by_url, "SIP inflow", sip, ans.get("sip_quote"), ans.get("sip_url")))
    if not ok:
        res.status = "failed"; return res
    aum, sip = float(aum), float(sip)
    aum_mom, sip_mom = pct(aum, _num(aum_t["v"])), pct(sip, _num(sip_t["v"]))
    b = fam["bounds"]
    if not (within(res, "AUM MoM %", aum_mom, *b["aumMomPct"]) and within(res, "SIP MoM %", sip_mom, *b["sipMomPct"])):
        res.status = "failed"; return res
    lab = mlabel(y, m)
    res.changes += [{"metric": f"MF AUM {lab}", "old": f"{aum_t['v']} ({aum_t['p']})", "new": f"₹{aum:.2f} L cr",
                     "url": ans["aum_url"], "quote": ans["aum_quote"]},
                    {"metric": f"SIP inflow {lab}", "old": f"{sip_t['v']} ({sip_t['p']})", "new": f"₹{sip:,.0f} cr",
                     "url": ans["sip_url"], "quote": ans["sip_quote"]}]
    aum_t.update({"p": lab, "v": f"₹{aum:.2f} L cr", "chg": f"{signed(aum_mom)} MoM", "dir": "up" if aum_mom >= 0 else "down",
                  "d": "✓ AMFI"})
    sip_t.update({"p": lab, "v": f"₹{sip:,.0f} cr", "chg": f"{signed(sip_mom)} MoM", "dir": "up" if sip_mom >= 0 else "down",
                  "d": "✓ AMFI"})
    set_fresh(meta, "wealthtech", "AMFI flows", month_end(y, m), lab)
    set_source(meta, "wealthtech", "AMFI", f"AMFI {lab}", ans["aum_url"])
    res.status = "updated"
    return res


# ───────────────────────────── RBI fortnightly credit ─────────────────────────────
def rbi_credit(ctx, fam) -> Result:
    res = Result("rbi_credit")
    L, meta = ctx.data["lending.json"], ctx.data["meta.json"]
    fresh = next(f for f in meta["freshness"]["lending"] if f["label"] == "Bank credit")
    last = dt.date.fromisoformat(fresh["asOf"])
    if (ctx.today - last).days < fam.get("minAgeDays", 20):
        res.status = "not-due"; res.notes.append("no newer fortnight is due yet"); return res
    docs = collect(ctx.fetcher, fam, res); by_url = {d.url: d.text for d in docs}
    ans = ctx.llm.ask_json(
        f"Find the most recent reporting fortnight AFTER {last.isoformat()} for scheduled commercial banks in India, "
        f"and its year-on-year growth (percent) in bank credit and in aggregate deposits. Give the fortnight's "
        f"end date as YYYY-MM-DD.",
        docs,
        '{"found": bool, "as_of": "YYYY-MM-DD", "credit_growth_pct": number|null, "credit_quote": str, "credit_url": str, '
        '"deposit_growth_pct": number|null, "deposit_quote": str, "deposit_url": str, "warnings": [str]}')
    res.warnings += ans.get("warnings") or []
    if not ans.get("found"):
        res.status = "no-new-data"; res.notes.append("no newer fortnight found"); return res
    try:
        as_of = dt.date.fromisoformat(ans["as_of"])
    except Exception:
        res.rejected.append("credit: unreadable fortnight date"); res.status = "failed"; return res
    c, d = ans.get("credit_growth_pct"), ans.get("deposit_growth_pct")
    ok = (as_of > last and as_of <= ctx.today and
          ground(res, by_url, "Credit growth", c, ans.get("credit_quote"), ans.get("credit_url")) and
          ground(res, by_url, "Deposit growth", d, ans.get("deposit_quote"), ans.get("deposit_url")))
    if as_of <= last: res.rejected.append(f"credit: {as_of} is not newer than {last}")
    if not ok:
        res.status = "failed"; return res
    c, d = float(c), float(d)
    tile, gap = find_tile(L["tiles"], "Bank credit growth"), find_tile(L["tiles"], "Credit–deposit")
    old_c = _num(tile["v"]); b = fam["bounds"]
    if not (within(res, "credit growth %", c, *b["creditPct"]) and within(res, "deposit growth %", d, *b["depositPct"])
            and within(res, "credit growth change pp", c - old_c, -b["maxMovePp"], b["maxMovePp"])):
        res.status = "failed"; return res
    shown = f"{as_of.day} {MON[as_of.month-1]}'{str(as_of.year)[2:]}"
    bps = round((c - d) * 100)
    res.changes += [{"metric": f"Bank credit growth {shown}", "old": f"{tile['v']} ({tile.get('p','')})", "new": f"{c:.1f}%",
                     "url": ans["credit_url"], "quote": ans["credit_quote"]},
                    {"metric": f"Deposit growth {shown}", "old": gap.get("d", ""), "new": f"{d:.1f}%",
                     "url": ans["deposit_url"], "quote": ans["deposit_quote"]}]
    tile.update({"p": shown, "v": f"{c:.1f}%", "chg": f"{signed(c - old_c, 1, ' pp')} vs prior", "dir": "up" if c >= old_c else "down",
                 "d": "YoY · scheduled commercial banks ✓ RBI"})
    gap.update({"p": shown, "v": f"≈{bps} bps", "d": f"credit {c:.1f}% vs deposits {d:.1f}% ✓ RBI", "chg": None})
    gap.pop("chg", None)
    set_fresh(meta, "lending", "Bank credit", as_of, shown)
    set_source(meta, "lending", "Credit ", f"Credit {shown}", ans["credit_url"])
    res.status = "updated"
    return res


# ───────────────────────────── RBI policy (MPC) ─────────────────────────────
def rbi_policy(ctx, fam) -> Result:
    res = Result("rbi_policy")
    L, meta = ctx.data["lending.json"], ctx.data["meta.json"]
    fresh = next(f for f in meta["freshness"]["lending"] if f["label"] == "Policy rate")
    last = dt.date.fromisoformat(fresh["asOf"])
    if (ctx.today - last).days < fam.get("minAgeDays", 45):
        res.status = "not-due"; res.notes.append("next MPC decision not due yet"); return res
    docs = collect(ctx.fetcher, fam, res); by_url = {d.url: d.text for d in docs}
    ans = ctx.llm.ask_json(
        f"Find the Reserve Bank of India's most recent Monetary Policy Committee decision AFTER {last.isoformat()}: "
        f"the decision date (YYYY-MM-DD), the policy repo rate in percent, the policy stance in a few words, and the "
        f"current-financial-year projections for real GDP growth and CPI inflation in percent.",
        docs,
        '{"found": bool, "decision_date": "YYYY-MM-DD", "repo_pct": number|null, "repo_quote": str, "repo_url": str, '
        '"stance": str, "gdp_pct": number|null, "gdp_quote": str, "cpi_pct": number|null, "cpi_quote": str, '
        '"projections_url": str, "warnings": [str]}')
    res.warnings += ans.get("warnings") or []
    if not ans.get("found"):
        res.status = "no-new-data"; res.notes.append("no newer MPC decision found"); return res
    try:
        when = dt.date.fromisoformat(ans["decision_date"])
    except Exception:
        res.rejected.append("policy: unreadable decision date"); res.status = "failed"; return res
    r = ans.get("repo_pct")
    ok = (last < when <= ctx.today) and ground(res, by_url, "Repo rate", r, ans.get("repo_quote"), ans.get("repo_url"))
    if not (last < when <= ctx.today): res.rejected.append(f"policy: {when} is not a new decision")
    if not ok:
        res.status = "failed"; return res
    r = float(r)
    tile = find_tile(L["tiles"], "Repo rate"); old = _num(tile["v"])
    if not within(res, "repo change bps", (r - old) * 100, -fam["bounds"]["maxMoveBps"], fam["bounds"]["maxMoveBps"]):
        res.status = "failed"; return res
    shown = f"{when.day} {MON[when.month-1]}'{str(when.year)[2:]}"
    bps = round((r - old) * 100)
    stance = (ans.get("stance") or "").strip()[:40]
    res.changes.append({"metric": f"Repo rate {shown}", "old": tile["v"], "new": f"{r:.2f}%", "url": ans["repo_url"], "quote": ans["repo_quote"]})
    tile.update({"p": shown, "v": f"{r:.2f}%", "chg": "unchanged" if bps == 0 else f"{bps:+d} bps",
                 "dir": "down" if bps > 0 else "up", "d": (f"stance: {stance} ✓ RBI" if stance else "✓ RBI")})
    g, c, pu = ans.get("gdp_pct"), ans.get("cpi_pct"), ans.get("projections_url")
    if g is not None and c is not None and ground(res, by_url, "GDP projection", g, ans.get("gdp_quote"), pu) \
            and ground(res, by_url, "CPI projection", c, ans.get("cpi_quote"), pu):
        f = find_tile(L["tiles"], "FY")
        res.changes.append({"metric": "RBI projections", "old": f["v"], "new": f"GDP {g}% · CPI {c}%", "url": pu, "quote": ans.get("gdp_quote")})
        f.update({"v": f"GDP {g}% · CPI {c}%", "d": f"{MON[when.month-1]}'{str(when.year)[2:]} MPC ✓"})
    L["macro"]["labels"].append(mlabel(when.year, when.month)); L["macro"]["credit"].append(None); L["macro"]["repo"].append(r)
    if bps:
        L["regTimeline"].append([f"{MON[when.month-1]} {when.year}", f"Repo {'raised' if bps > 0 else 'cut'} {abs(bps)} bps to {r:.2f}%",
                                 f"MPC decision of {when.isoformat()}" + (f"; stance: {stance}." if stance else ".")])
    set_fresh(meta, "lending", "Policy rate", when, shown)
    set_source(meta, "lending", "MPC", f"MPC {shown}", ans["repo_url"])
    res.status = "updated"
    return res


# ───────────────────────────── news ─────────────────────────────
TAGS = {"Funding", "Policy", "Regulation", "Markets", "Product", "Results", "M&A", "Expansion"}


def news(ctx, fam) -> Result:
    res = Result("news")
    meta, items = ctx.data["meta.json"], ctx.data["news.json"]["items"]
    fresh = next(f for f in meta["freshness"]["news"] if f["label"] == "Latest story")
    last = dt.date.fromisoformat(fresh["asOf"])
    docs = collect(ctx.fetcher, {**fam, "follow": r"$^"}, res)       # listing pages only; no link-following
    listing = docs[0]; links = {h.split("#")[0] for _, h in listing.links}
    ans = ctx.llm.ask_json(
        f"List fintech stories on this listing published AFTER {last.isoformat()} (newest first, at most "
        f"{fam.get('maxItems', 8)}). For each: the publication date (YYYY-MM-DD), one tag from {sorted(TAGS)}, the "
        f"story's headline copied exactly as printed (orig_headline), the story's own URL, a new short headline in "
        f"your own words (under 90 characters) and a one-line gist in your own words (under 170 characters). "
        f"Use only facts and numbers printed on the listing.",
        docs[:1],
        '{"items": [{"date": "YYYY-MM-DD", "tag": str, "orig_headline": str, "url": str, "headline": str, "gist": str}], "warnings": [str]}')
    res.warnings += ans.get("warnings") or []
    fresh_items = []
    for it in ans.get("items") or []:
        try:
            d = dt.date.fromisoformat(it["date"])
        except Exception:
            res.rejected.append("news: unreadable date"); continue
        url = (it.get("url") or "").split("#")[0]
        why = None
        if d <= last or d > ctx.today: why = f"date {d} outside the new window"
        elif url not in links: why = "URL not on the listing page"
        elif not quote_in_document(it.get("orig_headline", ""), listing.text): why = "headline not on the listing page"
        elif it.get("tag") not in TAGS: why = f"unknown tag {it.get('tag')}"
        elif len(it.get("headline", "")) > 100 or len(it.get("gist", "")) > 190: why = "too long"
        else:
            missing = numbers_grounded(it["headline"] + " " + it["gist"], listing.text)
            if missing: why = "numbers not in the source: " + ", ".join(missing)
        if why:
            res.rejected.append(f"news '{(it.get('orig_headline') or '')[:50]}': {why}"); continue
        fresh_items.append((d, [f"{d.day} {MON[d.month-1]}", it["tag"], it["headline"].strip(), it["gist"].strip(), url]))
    if not fresh_items:
        res.status = "no-new-data"; return res
    fresh_items.sort(key=lambda x: x[0], reverse=True)
    known = {i[4] for i in items}
    new = [row for _, row in fresh_items if row[4] not in known]
    ctx.data["news.json"]["items"] = (new + items)[: fam.get("keep", 24)]
    newest = fresh_items[0][0]
    set_fresh(meta, "news", "Latest story", newest, f"{newest.day} {MON[newest.month-1]}'{str(newest.year)[2:]}")
    res.changes += [{"metric": "News", "old": "", "new": r[2], "url": r[4], "quote": ""} for r in new]
    res.status = "updated" if new else "no-new-data"
    return res


# ───────────────────────────── hiring (no model involved) ─────────────────────────────
FUNCS = [("Tech", r"engineer|developer|sde|devops|data|machine learning|\bml\b|architect|qa|security|sre|android|ios|backend|frontend|platform"),
         ("Product", r"product|design|ux|ui\b"),
         ("Finance", r"financ|account(ing|ant)|tax|treasury|audit|controller|fp&a|investor relations"),
         ("Sales", r"sales|account|business development|\bbd\b|partnership|alliances|relationship manager|merchant acquisition"),
         ("Marketing", r"marketing|brand|growth|content|seo|social|communications|pr\b|video"),
         ("HR", r"\bhr\b|human resources|talent|recruit|people"),
         ("Ops", r"operations|\bops\b|support|service|onboarding|collections|risk|compliance|fraud")]


def classify(title: str) -> str:
    t = title.lower()
    for name, pat in FUNCS:
        if re.search(pat, t): return name
    return "Other"


def hirings(ctx, fam) -> Result:
    res = Result("hirings")
    pay, meta, w = ctx.data["payments.json"]["pay"], ctx.data["meta.json"], ctx.data["wealthtech.json"]
    today = ctx.today; shown = f"{today.day} {MON[today.month-1]}'{str(today.year)[2:]}"
    for b in fam["boards"]:
        try:
            jobs = ctx.fetcher.json(b["api"]).get("jobs", [])
        except GuardError:
            raise
        except Exception as e:
            res.notes.append(f"{b['company']}: board unreadable ({str(e)[:80]})"); continue
        counts = {k: 0 for k in ["Tech", "Product", "Sales", "Finance", "Marketing", "HR", "Ops", "Other"]}
        for j in jobs: counts[classify(j.get("title", ""))] += 1
        total = len(jobs)
        if b["tab"] == "payments":
            row = next((r for r in pay["hirings"] if r[0] == b["company"]), None)
            if row is None: res.notes.append(f"{b['company']}: no row in the hiring table"); continue
            old = row[2]
            row[2:11] = [total] + [counts[k] for k in ["Tech", "Product", "Sales", "Finance", "Marketing", "HR", "Ops", "Other"]]
            row[11] = f"{shown} · live via Greenhouse API"
            res.changes.append({"metric": f"{b['company']} open roles", "old": str(old), "new": str(total), "url": b["api"], "quote": ""})
        else:
            row = next((r for r in w["talent"] if r[0] == b["company"]), None)
            if row is None: continue
            top = ", ".join(f"{v} {k.lower()}" for k, v in sorted(counts.items(), key=lambda x: -x[1]) if v)[:120]
            row[2] = f"{total} live ✓ ({shown}, Greenhouse API): {top}"
            res.changes.append({"metric": f"{b['company']} open roles", "old": "", "new": str(total), "url": b["api"], "quote": ""})
    if res.changes:
        set_fresh(meta, "payments", "Hiring", today, shown)
        res.status = "updated"
    else:
        res.status = "failed" if res.notes else "no-new-data"
    return res


FAMILIES = {"upi_monthly": upi_monthly, "upi_app_share": upi_app_share, "amfi_monthly": amfi_monthly,
            "rbi_credit": rbi_credit, "rbi_policy": rbi_policy, "news": news, "hirings": hirings}
NEEDS_MODEL = {"upi_monthly", "upi_app_share", "amfi_monthly", "rbi_credit", "rbi_policy", "news"}
