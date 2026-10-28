"""Health scan: open the dashboard in a real browser and check what a visitor would hit."""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, asdict
from urllib.parse import urlparse

from .validate import freshness_status

MIN_CHARTS = {"payments": 6, "lending": 4, "wealthtech": 4}
THIRD_PARTY = ("accounts.google.com", "clarity.ms", "gsi_logger", "[gsi", "googletagmanager")   # compared lower-case
AUTOMATED = {"UPI monthly", "App shares", "Hiring", "Bank credit", "Policy rate", "AMFI flows", "Latest story"}


@dataclass
class Finding:
    priority: str       # P0 … P3
    code: str
    msg: str
    fix: str = ""
    auto: bool = False  # True when SUPAG fixes it itself in this run

    def dict(self): return asdict(self)


def scan(url: str, *, check_links: bool = True, page_hook=None, today: dt.date | None = None) -> list[Finding]:
    from playwright.sync_api import sync_playwright
    today = today or dt.date.today()
    out: list[Finding] = []
    add = lambda *a, **k: out.append(Finding(*a, **k))
    host = urlparse(url).hostname

    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 900})
        if page_hook: page_hook(pg)
        errors, console = [], []
        pg.on("pageerror", lambda e: errors.append(str(e)[:200]))
        pg.on("console", lambda m: console.append(m.text[:200]) if m.type == "error" else None)
        try:
            resp = pg.goto(url, wait_until="networkidle", timeout=60000)
            if not resp or resp.status >= 400:
                add("P0", "site-down", f"{url} responded {resp.status if resp else 'nothing'}", "Check GitHub Pages status and the last deploy.")
                b.close(); return out
        except Exception as e:
            add("P0", "site-down", f"could not open {url}: {str(e)[:120]}", "Check GitHub Pages status and the last deploy.")
            b.close(); return out
        pg.wait_for_timeout(1200)

        if pg.locator(".loadcard").count():
            add("P0", "data-load", "the page shows its 'couldn't load the data' card: " + pg.inner_text(".loadcard")[:160],
                "A data file is missing or invalid — revert the last data change.")
        for e in errors:
            add("P0", "js-error", f"JavaScript error on load: {e}", "Revert the last change to fintech_dashboard.html.")
        for c in console:
            if not any(t in c.lower() for t in THIRD_PARTY) and "Failed to load resource" not in c:
                add("P2", "console-error", c, "Inspect in the browser console.")

        meta = pg.evaluate("typeof META==='object' ? META : null")
        tabs = pg.eval_on_selector_all("nav#nav button", "els=>els.map(e=>e.dataset.tab)")
        if meta:
            missing = [t["id"] for t in meta.get("tabs", []) if t["id"] not in tabs]
            if missing: add("P0", "tab-missing", "tabs not rendered: " + ", ".join(missing), "Check render() for those tab ids.")
            stamp = pg.inner_text("#stamp")
            if meta.get("lastUpdated") and meta["lastUpdated"] not in stamp:
                add("P1", "stamp", f"page stamp '{stamp}' doesn't match data ({meta['lastUpdated']})", "Usually deploy lag; re-scan in 10 minutes.")
            for tab, entries in (meta.get("freshness") or {}).items():
                for e in entries:
                    st = freshness_status(e, today)
                    if st == "stale":
                        add("P1", "stale", f"{tab} · {e['label']} is overdue (as of {e['shown']})",
                            "SUPAG retries this every week; if it keeps failing, update it by hand." if e["label"] in AUTOMATED
                            else "Not automated yet — update by hand, or add a source family for it.")
                    elif st == "aging":
                        add("P2", "aging", f"{tab} · {e['label']} — a newer release is due (as of {e['shown']})", "Due in the next run.")
        for t in tabs:
            pg.click(f"nav#nav button[data-tab='{t}']"); pg.wait_for_timeout(500)
            n = pg.evaluate("window.Chart ? Object.keys(Chart.instances).length : -1")
            if n == -1:
                add("P0", "chartjs", "Chart.js did not load", "The CDN or its integrity hash changed; check the <script> tag."); break
            need = MIN_CHARTS.get(t, 0)
            if need and n < need:
                add("P0", "charts", f"{t}: only {n} charts exist after opening the tab (expected ≥ {need})", "A data series is malformed.")
        if not pg.evaluate("!document.getElementById('brief').hidden"):
            add("P2", "brief", "'What changed this week' isn't showing", "meta.json → brief is empty or malformed.")

        tags = pg.evaluate("""() => { const q = s => document.querySelector(s);
            return {title: q('meta[property="og:title"]')?.content, desc: q('meta[property="og:description"]')?.content,
                    image: q('meta[property="og:image"]')?.content, card: q('meta[name="twitter:card"]')?.content,
                    icon: q('link[rel="icon"]')?.href, canonical: q('link[rel="canonical"]')?.href,
                    description: q('meta[name="description"]')?.content} }""")
        for k, v in tags.items():
            if not v: add("P2", "meta-tags", f"missing <head> tag: {k}", "Link previews and search results need it.")
        if tags.get("image") and host and host not in ("127.0.0.1", "localhost"):
            try:
                r = pg.request.get(tags["image"], timeout=20000)
                if r.status >= 400: add("P2", "og-image", f"preview image responds {r.status}", "Re-upload dashboard/og.png.")
            except Exception as e:
                add("P2", "og-image", f"preview image unreachable: {str(e)[:80]}", "Re-upload dashboard/og.png.")

        links = pg.eval_on_selector_all("a[href^='http']", "els=>[...new Set(els.map(a=>a.href.split('#')[0]))]")
        pg.close()

        m = b.new_page(viewport={"width": 390, "height": 844})
        if page_hook: page_hook(m)
        m.goto(url, wait_until="networkidle", timeout=60000); m.wait_for_timeout(800)
        if m.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"):
            add("P2", "mobile-overflow", "the page scrolls sideways on a 390px phone", "Find the element wider than the screen.")
        m.close()

        if check_links:
            unverifiable = 0
            ctx = b.new_context(user_agent="Mozilla/5.0 SUPAG-linkcheck/1.0")
            for href in links[:150]:
                try:
                    r = ctx.request.head(href, timeout=15000, max_redirects=5)
                    if r.status in (405, 501): r = ctx.request.get(href, timeout=15000, max_redirects=5)
                    if r.status in (404, 410) or r.status >= 500:
                        add("P2", "broken-link", f"{href} responds {r.status}", "Replace the source link in dashboard/data.")
                    elif r.status in (401, 403, 429): unverifiable += 1
                except Exception:
                    unverifiable += 1
            if unverifiable:
                add("P3", "links-unverified", f"{unverifiable} of {min(len(links),150)} external links block automated checks (normal for news sites)", "")
            ctx.close()
        b.close()
    return out
