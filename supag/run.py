"""SUPAG entry point.

  python -m supag.run --mode run       refresh, scan, write report  (the weekly job)
  python -m supag.run --mode dry-run   the same, but restore the data afterwards — nothing is committed
  python -m supag.run --mode scan      health scan only (no fetching, no model)
  python -m supag.run --mode smoke     scan the live site after a deploy
"""
from __future__ import annotations

import argparse
import contextlib
import copy
import datetime as dt
import functools
import http.server
import json
import os
import socketserver
import sys
import threading

from . import families as F
from .brief import draft as draft_brief
from .config import DASHBOARD_URL_LIVE, RUNS, ROOT, allowlist, budgets, load_sources, read_json, write_json
from .fetch import Fetcher
from .guard import Budget, GuardError, check_write_scope, kill_switch
from .llm import LLM
from .report import build as build_report
from .scan import scan
from .triage import from_families, from_validation, triage, counts
from .validate import validate

DATA_FILES = ["meta.json", "payments.json", "lending.json", "wealthtech.json", "news.json"]


@contextlib.contextmanager
def serve_repo():
    """Serve the working tree on localhost so the scan sees exactly what this PR would publish."""
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a, **k: None
    with socketserver.ThreadingTCPServer(("127.0.0.1", 0), handler) as httpd:
        t = threading.Thread(target=httpd.serve_forever, daemon=True); t.start()
        try:
            yield f"http://127.0.0.1:{httpd.server_address[1]}/fintech_dashboard.html"
        finally:
            httpd.shutdown()


class Ctx:
    def __init__(self, today, fetcher, llm):
        self.today, self.fetcher, self.llm = today, fetcher, llm
        self.data = {f: read_json(f) for f in DATA_FILES}


def gh_output(**kv):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            for k, v in kv.items(): f.write(f"{k}={v}\n")


def refresh(today, mode, page_hook=None):
    src, bud = load_sources(), budgets()
    budget = Budget(bud["maxFetchesPerRun"], bud["maxLLMCallsPerRun"])
    snapshot = {f: read_json(f) for f in DATA_FILES}
    results, brief_notes, usage, aborted = [], [], {}, None
    fetch_log = []

    llm = None
    try:
        llm = LLM(budget, max_tokens=bud.get("maxOutputTokens", 2000))
    except GuardError as e:
        brief_notes.append(str(e))

    try:
        with Fetcher(budget, allowlist(), bud["maxCharsPerPage"]) as fetcher:
            ctx = Ctx(today, fetcher, llm)
            for fam in src["families"]:
                name = fam["name"]
                if not fam.get("enabled", True):
                    results.append(F.Result(name, "skipped", notes=["disabled in sources.json"])); continue
                if name in F.NEEDS_MODEL and llm is None:
                    results.append(F.Result(name, "skipped", notes=["no API key"])); continue
                before = copy.deepcopy(ctx.data)
                try:
                    r = F.FAMILIES[name](ctx, fam)
                except GuardError as e:
                    ctx.data = before; r = F.Result(name, "failed", notes=[str(e)])
                except Exception as e:
                    ctx.data = before; r = F.Result(name, "failed", notes=[f"{type(e).__name__}: {str(e)[:200]}"])
                if r.status != "updated":
                    ctx.data = before                      # never keep half an update
                results.append(r)
            fetch_log = fetcher.log
            if any(r.status == "updated" for r in results):
                ctx.data["meta.json"]["lastUpdated"] = f"{today.day} {today.strftime('%b')} {today.year}"
                ctx.data["meta.json"]["lastUpdatedISO"] = today.isoformat()
                ctx.data["meta.json"]["updatedBy"] = "SUPAG"
                if llm:
                    try:
                        brief_notes += draft_brief(llm, results, ctx.data["meta.json"], today)
                    except Exception as e:
                        brief_notes.append(f"brief not redrafted: {str(e)[:120]}")
            for f, obj in ctx.data.items():
                write_json(f, obj)
    except GuardError as e:
        aborted = str(e)
        for f, obj in snapshot.items(): write_json(f, obj)
    if llm: usage = llm.usage

    # validate what we wrote; any error → put everything back
    v = validate(today)
    if any(i.level == "error" for i in v):
        for f, obj in snapshot.items(): write_json(f, obj)
        aborted = (aborted or "") + " Validation failed after the update, so all data was restored: " + \
                  "; ".join(i.msg for i in v if i.level == "error")
    return results, brief_notes, fetch_log, budget, usage, aborted, snapshot, v


def _page_hook():
    """Sandbox testing only: SUPAG_PAGE_HOOK=module:function lets a test serve CDN assets offline."""
    spec = os.environ.get("SUPAG_PAGE_HOOK")
    if not spec: return None
    import importlib
    mod, fn = spec.split(":")
    return getattr(importlib.import_module(mod), fn)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["run", "dry-run", "scan", "smoke"], default="run")
    ap.add_argument("--report", default=os.path.join(os.environ.get("RUNNER_TEMP", "/tmp"), "supag-report.md"))
    ap.add_argument("--today", help="YYYY-MM-DD (testing)")
    ap.add_argument("--no-links", action="store_true", help="skip the external link check")
    a = ap.parse_args(argv)
    today = dt.date.fromisoformat(a.today) if a.today else dt.date.today()

    stop = kill_switch()
    if stop and a.mode in ("run", "dry-run"):
        print(stop); gh_output(changed="false", p0="false", title="SUPAG paused")
        open(a.report, "w").write(f"## SUPAG\n\n{stop}\n"); return 0

    results, brief_notes, fetch_log, usage, aborted, snapshot = [], [], [], {}, None, None
    budget = Budget(0, 0)
    v = []
    if a.mode in ("run", "dry-run"):
        results, brief_notes, fetch_log, budget, usage, aborted, snapshot, v = refresh(today, a.mode)
    else:
        v = validate(today)

    findings = from_validation(v) + from_families(results)
    if a.mode == "smoke":
        findings += scan(DASHBOARD_URL_LIVE, check_links=False, today=today, page_hook=_page_hook())
    else:
        with serve_repo() as url:
            findings += scan(url, check_links=not a.no_links, today=today, page_hook=_page_hook())
    findings = triage(findings)

    changed = any(r.status == "updated" for r in results) and not aborted
    if a.mode in ("run", "dry-run") and changed:
        RUNS.mkdir(exist_ok=True)
        (RUNS / f"{today.isoformat()}.json").write_text(json.dumps({
            "date": today.isoformat(), "results": [r.__dict__ for r in results],
            "findings": [x.dict() for x in findings], "fetches": fetch_log, "usage": usage}, ensure_ascii=False, indent=1))
    blocked = None
    if a.mode == "run":
        try:
            check_write_scope()
        except GuardError as e:
            blocked = str(e); aborted = (aborted + " " if aborted else "") + blocked
            for fname, obj in (snapshot or {}).items(): write_json(fname, obj)
            for p in RUNS.glob(f"{today.isoformat()}.json"): p.unlink()
            changed = False
    if a.mode == "dry-run" and snapshot:
        for fname, obj in snapshot.items(): write_json(fname, obj)
        for p in RUNS.glob(f"{today.isoformat()}.json"): p.unlink()
        changed = False

    title, body = build_report(today=today, mode=a.mode, results=results, findings=findings, brief_notes=brief_notes,
                               fetch_log=fetch_log, budget=budget, usage=usage, aborted=aborted)
    with open(a.report, "w", encoding="utf-8") as f: f.write(body)
    if blocked:
        print(blocked); gh_output(changed="false", p0="true", title="SUPAG blocked by the write-scope guard"); return 1

    c = counts(findings)
    gh_output(changed=str(changed).lower(), p0=str(c["P0"] > 0).lower(), title=title)
    print(title)
    print(f"report: {a.report}")
    return 1 if (a.mode == "smoke" and c["P0"]) else 0


if __name__ == "__main__":
    sys.exit(main())
