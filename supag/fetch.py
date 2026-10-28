"""Fetch pages from allowlisted hosts only. Every hop of every redirect is checked; anything off-list
is refused before its text can reach the model."""
from __future__ import annotations

import io
import time
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlparse

import requests

from .config import host_allowed
from .guard import Budget, GuardError

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 SUPAG/1.0 (+https://fintech.pelicanx.in/fintech_dashboard.html)"


@dataclass
class Doc:
    url: str                                   # the URL we asked for (the id the model must cite)
    final_url: str
    text: str
    links: list[tuple[str, str]] = field(default_factory=list)   # (link text, absolute href), allowlisted only


class Fetcher:
    def __init__(self, budget: Budget, allowed: set[str], max_chars: int = 60000):
        self.budget, self.allowed, self.max_chars = budget, allowed, max_chars
        self._pw = self._browser = self._ctx = None
        self.log: list[dict] = []              # every fetch attempt, for the run report
        self._cache: dict[str, Doc] = {}

    # ---------- lifecycle ----------
    def __enter__(self):
        from playwright.sync_api import sync_playwright
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch()
        self._ctx = self._browser.new_context(user_agent=UA, java_script_enabled=True)
        return self

    def __exit__(self, *exc):
        for x in (self._ctx, self._browser):
            try: x.close()
            except Exception: pass
        if self._pw: self._pw.stop()

    # ---------- checks ----------
    def _require(self, url: str) -> None:
        if not host_allowed(url, self.allowed):
            raise GuardError(f"Allowlist guard: {urlparse(url).hostname or url} is not an approved source.")

    def _record(self, url, ok, note=""):
        self.log.append({"url": url, "ok": ok, "note": note, "t": time.strftime("%H:%M:%S")})

    # ---------- fetchers ----------
    def get(self, url: str) -> Doc:
        self._require(url)
        if url in self._cache:
            return self._cache[url]
        self.budget.take_fetch()
        try:
            if urlparse(url).path.lower().endswith(".pdf"):
                doc = self._pdf(url)
            else:
                doc = self._page(url)
            self._record(url, True, f"{len(doc.text)} chars")
            self._cache[url] = doc
            return doc
        except GuardError as e:
            self._record(url, False, str(e)); raise
        except Exception as e:                  # network trouble is reported, not fatal
            self._record(url, False, f"{type(e).__name__}: {str(e)[:160]}")
            raise

    def _page(self, url: str) -> Doc:
        page = self._ctx.new_page()
        try:
            resp = page.goto(url, wait_until="domcontentloaded", timeout=45000)
            if resp is None:
                raise RuntimeError("no response")
            req, hops = resp.request, []
            while req is not None:               # walk the redirect chain back to the start
                hops.append(req.url); req = req.redirected_from
            for hop in hops:
                self._require(hop)
            if resp.status >= 400:
                raise RuntimeError(f"HTTP {resp.status}")
            page.wait_for_timeout(1500)           # let client-side tables render
            text = page.inner_text("body")[: self.max_chars]
            raw = page.eval_on_selector_all("a[href]", "els => els.map(a => [a.innerText.trim().slice(0,200), a.href])")
            links = [(t, h) for t, h in raw if host_allowed(h, self.allowed)]
            return Doc(url=url, final_url=page.url, text=text, links=links)
        finally:
            page.close()

    def _pdf(self, url: str) -> Doc:
        from pypdf import PdfReader
        cur = url
        for _ in range(5):                       # follow redirects by hand so every hop is checked
            self._require(cur)
            r = requests.get(cur, headers={"User-Agent": UA}, timeout=45, allow_redirects=False)
            if r.is_redirect:
                cur = urljoin(cur, r.headers["Location"]); continue
            r.raise_for_status()
            if len(r.content) > 15_000_000:
                raise RuntimeError("PDF larger than 15 MB")
            reader = PdfReader(io.BytesIO(r.content))
            text = "\n".join((p.extract_text() or "") for p in reader.pages[:40])
            return Doc(url=url, final_url=cur, text=text[: self.max_chars])
        raise RuntimeError("too many redirects")

    def json(self, url: str):
        cur = url
        self.budget.take_fetch()
        for _ in range(5):
            self._require(cur)
            r = requests.get(cur, headers={"User-Agent": UA, "Accept": "application/json"}, timeout=30, allow_redirects=False)
            if r.is_redirect:
                cur = urljoin(cur, r.headers["Location"]); continue
            r.raise_for_status()
            self._record(url, True, "json")
            return r.json()
        raise RuntimeError("too many redirects")
